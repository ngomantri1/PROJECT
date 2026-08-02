# Dung cac process ToolBet/main.py cu trong thu muc project.
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$root = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction SilentlyContinue).Path
if (-not $root) {
    $root = $ProjectRoot
}
$rootLower = $root.ToLowerInvariant()
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$venvLower = $venvPython.ToLowerInvariant()

$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    ForEach-Object {
        $cmd = [string]$_.CommandLine
        $exe = [string]$_.ExecutablePath
        $cmd = $cmd.ToLowerInvariant()
        $exe = $exe.ToLowerInvariant()
        if ($cmd -notmatch "main\.py") { return }
        $inProject = $cmd.Contains($rootLower) -or $exe.StartsWith($rootLower) -or $exe -eq $venvLower
        if (-not $inProject) { return }
        Write-Host "  Dung PID $($_.ProcessId): $($_.CommandLine)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $script:stopped++
    }

if ($stopped -eq 0) {
    Write-Host "  Khong co ToolBet nao dang chay."
} else {
    Write-Host "  Da dung $stopped process - cho 1 giay ..."
    Start-Sleep -Seconds 1
}

exit 0
