[CmdletBinding()]
param(
    [ValidateRange(5, 3600)]
    [int]$DurationSeconds = 60,

    [ValidateRange(1, 60)]
    [int]$IntervalSeconds = 1,

    [string]$Scenario = "unspecified",

    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectRootNormalized = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd("\")
$chromeProfile = Join-Path $projectRootNormalized "data\cdp_profile"
$logicalProcessors = [Math]::Max(
    1,
    [int](Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
)

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRootNormalized "reports"
}
elseif (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRootNormalized $OutputDirectory
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

function Get-ProcessSnapshot {
    @(Get-CimInstance Win32_Process | ForEach-Object {
        [PSCustomObject]@{
            ProcessId = [int]$_.ProcessId
            ParentProcessId = [int]$_.ParentProcessId
            Name = [string]$_.Name
            CommandLine = [string]$_.CommandLine
            ExecutablePath = [string]$_.ExecutablePath
            WorkingSetBytes = [long]$_.WorkingSetSize
            PrivateBytes = [long]$_.PrivatePageCount
            CpuTicks = [long]$_.KernelModeTime + [long]$_.UserModeTime
        }
    })
}

function Get-DescendantIds {
    param(
        [object[]]$Processes,
        [int[]]$RootIds
    )

    $selected = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($rootId in $RootIds) {
        [void]$selected.Add($rootId)
    }

    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($process in $Processes) {
            if (
                $selected.Contains([int]$process.ParentProcessId) -and
                -not $selected.Contains([int]$process.ProcessId)
            ) {
                [void]$selected.Add([int]$process.ProcessId)
                $changed = $true
            }
        }
    }
    @($selected)
}

function Select-TargetGroups {
    param([object[]]$Processes)

    $escapedProject = [Regex]::Escape($projectRootNormalized)
    $escapedProfile = [Regex]::Escape($chromeProfile)

    $pythonRoots = @(
        $Processes | Where-Object {
            $_.Name -match "^python(?:w)?\.exe$" -and
            (
                $_.CommandLine -match $escapedProject -or
                $_.ExecutablePath -match $escapedProject
            ) -and
            $_.CommandLine -match "(^|\s|[\\/])main\.py(?:\s|$)"
        } | ForEach-Object { $_.ProcessId }
    )

    $chromeRoots = @(
        $Processes | Where-Object {
            $_.Name -eq "chrome.exe" -and
            $_.CommandLine -match "--remote-debugging-port(?:=|\s)" -and
            $_.CommandLine -match $escapedProfile
        } | ForEach-Object { $_.ProcessId }
    )

    @{
        toolbet_python = @(Get-DescendantIds -Processes $Processes -RootIds $pythonRoots)
        toolbet_chrome = @(Get-DescendantIds -Processes $Processes -RootIds $chromeRoots)
    }
}

function Get-Percentile {
    param(
        [double[]]$Values,
        [double]$Percentile
    )
    if ($Values.Count -eq 0) {
        return 0.0
    }
    $sorted = @($Values | Sort-Object)
    $index = [Math]::Ceiling(($Percentile / 100.0) * $sorted.Count) - 1
    $index = [Math]::Max(0, [Math]::Min($sorted.Count - 1, $index))
    [double]$sorted[$index]
}

function Get-MetricSummary {
    param(
        [object[]]$Rows,
        [string]$Property
    )
    $values = @($Rows | ForEach-Object { [double]($_.$Property) })
    if ($values.Count -eq 0) {
        return [ordered]@{ min = 0.0; mean = 0.0; p95 = 0.0; max = 0.0 }
    }
    $measure = $values | Measure-Object -Minimum -Maximum -Average
    [ordered]@{
        min = [Math]::Round([double]$measure.Minimum, 3)
        mean = [Math]::Round([double]$measure.Average, 3)
        p95 = [Math]::Round((Get-Percentile -Values $values -Percentile 95), 3)
        max = [Math]::Round([double]$measure.Maximum, 3)
    }
}

$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($DurationSeconds)
$previousCpuTicks = @{}
$previousAt = $null
$samples = [System.Collections.Generic.List[object]]::new()
$sampleNumber = 0

$initialProcesses = Get-ProcessSnapshot
$initialGroups = Select-TargetGroups -Processes $initialProcesses
if (@($initialGroups.toolbet_python).Count -eq 0) {
    throw (
        "No running ToolBet2 Python process was found. Start ToolBet2 first, " +
        "then run the measurement again."
    )
}
if (@($initialGroups.toolbet_chrome).Count -eq 0) {
    Write-Warning (
        "The ToolBet2 Chrome process tree was not found. Python will still be " +
        "measured, but the Chrome group will contain zero values."
    )
}

Write-Host "Measuring ToolBet2 for $DurationSeconds seconds every $IntervalSeconds second(s)."
Write-Host "Project: $projectRootNormalized"

while ((Get-Date) -lt $deadline) {
    $sampleAt = Get-Date
    $processes = Get-ProcessSnapshot
    $groups = Select-TargetGroups -Processes $processes
    $elapsed = if ($null -eq $previousAt) {
        0.0
    } else {
        [Math]::Max(0.001, ($sampleAt - $previousAt).TotalSeconds)
    }

    foreach ($groupName in @("toolbet_python", "toolbet_chrome")) {
        $ids = @($groups[$groupName])
        $members = @($processes | Where-Object { $ids -contains $_.ProcessId })
        $cpuDeltaTicks = 0L
        foreach ($member in $members) {
            $key = "$groupName/$($member.ProcessId)"
            if ($elapsed -gt 0 -and $previousCpuTicks.ContainsKey($key)) {
                $delta = [long]$member.CpuTicks - [long]$previousCpuTicks[$key]
                if ($delta -gt 0) {
                    $cpuDeltaTicks += $delta
                }
            }
            $previousCpuTicks[$key] = [long]$member.CpuTicks
        }

        $cpuPercent = if ($elapsed -le 0) {
            0.0
        } else {
            (($cpuDeltaTicks / 10000000.0) / $elapsed / $logicalProcessors) * 100.0
        }

        $workingSet = ($members | Measure-Object -Property WorkingSetBytes -Sum).Sum
        $privateBytes = ($members | Measure-Object -Property PrivateBytes -Sum).Sum
        if ($null -eq $workingSet) { $workingSet = 0 }
        if ($null -eq $privateBytes) { $privateBytes = 0 }

        $samples.Add([PSCustomObject]@{
            timestamp = $sampleAt.ToString("o")
            sample = $sampleNumber
            group = $groupName
            process_count = $members.Count
            cpu_percent = [Math]::Round($cpuPercent, 3)
            working_set_mb = [Math]::Round(([double]$workingSet / 1MB), 3)
            private_mb = [Math]::Round(([double]$privateBytes / 1MB), 3)
            process_ids = ($ids | Sort-Object) -join ";"
        })
    }

    $previousAt = $sampleAt
    $sampleNumber += 1
    $remaining = ($deadline - (Get-Date)).TotalSeconds
    if ($remaining -gt 0) {
        Start-Sleep -Milliseconds ([int]([Math]::Min($IntervalSeconds, $remaining) * 1000))
    }
}

$endedAt = Get-Date
$pythonRowsWithProcesses = @(
    $samples | Where-Object {
        $_.group -eq "toolbet_python" -and $_.process_count -gt 0
    }
)
if ($pythonRowsWithProcesses.Count -eq 0) {
    throw "ToolBet2 exited before any valid resource sample was collected."
}

$stamp = $startedAt.ToString("yyyyMMdd-HHmmss")
$csvPath = Join-Path $OutputDirectory "resource-baseline-$stamp.csv"
$jsonPath = Join-Path $OutputDirectory "resource-baseline-$stamp.json"
$samples | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$groupSummaries = [ordered]@{}
foreach ($groupName in @("toolbet_python", "toolbet_chrome")) {
    $rows = @($samples | Where-Object { $_.group -eq $groupName -and $_.sample -gt 0 })
    $groupSummaries[$groupName] = [ordered]@{
        samples = $rows.Count
        process_count = Get-MetricSummary -Rows $rows -Property "process_count"
        cpu_percent = Get-MetricSummary -Rows $rows -Property "cpu_percent"
        working_set_mb = Get-MetricSummary -Rows $rows -Property "working_set_mb"
        private_mb = Get-MetricSummary -Rows $rows -Property "private_mb"
    }
}

$os = Get-CimInstance Win32_OperatingSystem
$summary = [ordered]@{
    schema_version = 1
    project = "ToolBet2"
    project_root = $projectRootNormalized
    scenario = $Scenario
    started_at = $startedAt.ToString("o")
    ended_at = $endedAt.ToString("o")
    requested_duration_seconds = $DurationSeconds
    interval_seconds = $IntervalSeconds
    logical_processors = $logicalProcessors
    environment = [ordered]@{
        os = [string]$os.Caption
        os_version = [string]$os.Version
        os_build = [string]$os.BuildNumber
        total_memory_mb = [Math]::Round([double]$os.TotalVisibleMemorySize / 1024.0, 1)
    }
    groups = $groupSummaries
    samples_csv = [System.IO.Path]::GetFileName($csvPath)
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

Write-Host ""
Write-Host "Baseline complete."
Write-Host "JSON: $jsonPath"
Write-Host "CSV : $csvPath"
foreach ($groupName in $groupSummaries.Keys) {
    $group = $groupSummaries[$groupName]
    Write-Host (
        "{0}: CPU mean={1}% p95={2}% | WS mean={3} MB p95={4} MB | processes mean={5}" -f
        $groupName,
        $group.cpu_percent.mean,
        $group.cpu_percent.p95,
        $group.working_set_mb.mean,
        $group.working_set_mb.p95,
        $group.process_count.mean
    )
}
