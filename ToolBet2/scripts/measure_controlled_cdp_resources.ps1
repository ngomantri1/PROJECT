[CmdletBinding()]
param(
    [ValidateRange(5, 900)]
    [int]$DurationSeconds = 60,

    [ValidateRange(1, 30)]
    [int]$IntervalSeconds = 2
)

$ErrorActionPreference = "Stop"
$pythonPath = (Resolve-Path ".venv\Scripts\python.exe").Path
$projectRoot = (Get-Location).Path
$stdoutPath = Join-Path $env:TEMP "toolbet2-controlled-cdp.stdout.log"
$stderrPath = Join-Path $env:TEMP "toolbet2-controlled-cdp.stderr.log"

$runner = Start-Process `
    -FilePath $pythonPath `
    -ArgumentList "scripts\controlled_cdp_validation.py", "--hold-seconds", $DurationSeconds `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

$samples = [System.Collections.Generic.List[object]]::new()
while (-not $runner.HasExited) {
    Start-Sleep -Seconds $IntervalSeconds
    $runner.Refresh()
    $processes = @(Get-CimInstance Win32_Process)
    $ownedIds = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ownedIds.Add($runner.Id)
    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($process in $processes) {
            if (
                $ownedIds.Contains([int]$process.ParentProcessId) -and
                -not $ownedIds.Contains([int]$process.ProcessId)
            ) {
                [void]$ownedIds.Add([int]$process.ProcessId)
                $changed = $true
            }
        }
    }
    $python = $processes | Where-Object {
        $_.ProcessId -eq $runner.Id
    }
    $chrome = $processes | Where-Object {
        $_.Name -eq "chrome.exe" -and
        $ownedIds.Contains([int]$_.ProcessId)
    }
    $targets = @($python) + @($chrome)
    if ($targets.Count -gt 0) {
        $pythonCpuTicks = (@($python | ForEach-Object {
            [int64]$_.KernelModeTime + [int64]$_.UserModeTime
        } | Measure-Object -Sum).Sum)
        $chromeCpuTicks = (@($chrome | ForEach-Object {
            [int64]$_.KernelModeTime + [int64]$_.UserModeTime
        } | Measure-Object -Sum).Sum)
        $samples.Add([pscustomobject]@{
            Timestamp = Get-Date
            PythonWorkingSetMB = [math]::Round((@($python) | Measure-Object WorkingSetSize -Sum).Sum / 1MB, 1)
            ChromeWorkingSetMB = [math]::Round((@($chrome) | Measure-Object WorkingSetSize -Sum).Sum / 1MB, 1)
            PythonCpuSeconds = [math]::Round($pythonCpuTicks / 10000000, 2)
            ChromeCpuSeconds = [math]::Round($chromeCpuTicks / 10000000, 2)
            ProcessCount = $targets.Count
        })
    }
}

$runner.Refresh()
if ($samples.Count -gt 0) {
    $pythonPeak = ($samples | Measure-Object PythonWorkingSetMB -Maximum).Maximum
    $chromePeak = ($samples | Measure-Object ChromeWorkingSetMB -Maximum).Maximum
    $pythonCpu = ($samples | Measure-Object PythonCpuSeconds -Maximum).Maximum
    $chromeCpu = ($samples | Measure-Object ChromeCpuSeconds -Maximum).Maximum
    $processPeak = ($samples | Measure-Object ProcessCount -Maximum).Maximum
    Write-Output "controlled_cdp_resource_baseline: PASS"
    Write-Output "duration_seconds=$DurationSeconds samples=$($samples.Count)"
    Write-Output "python_peak_working_set_mb=$pythonPeak chrome_peak_working_set_mb=$chromePeak python_cpu_seconds=$pythonCpu chrome_cpu_seconds=$chromeCpu process_count_peak=$processPeak"
}
else {
    Write-Error "No controlled CDP process samples were collected."
}

Get-Content $stdoutPath -Tail 4
Get-Content $stderrPath -Tail 4
if ($runner.ExitCode -ne 0) {
    exit $runner.ExitCode
}
