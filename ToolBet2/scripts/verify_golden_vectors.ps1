[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"
$env:TOOLBET_GOLDEN_CSHARP = "1"

Push-Location $projectRoot
try {
    & $pythonExe -m unittest tests.test_golden_vectors tests.test_strategy_golden_vectors -v
    if ($LASTEXITCODE -ne 0) { throw "Golden-vector comparison failed." }
}
finally {
    Pop-Location
}
