[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Python virtual environment was not found: $pythonExe"
}

Push-Location $projectRoot
try {
    & $pythonExe -m unittest discover -s tests -p "test_*.py" -v
    if ($LASTEXITCODE -ne 0) {
        throw "Unit tests failed with exit code $LASTEXITCODE."
    }

    & $pythonExe -m compileall -q main.py src tests
    if ($LASTEXITCODE -ne 0) {
        throw "Python compile check failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
