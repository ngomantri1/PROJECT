param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($ReleaseRoot).TrimEnd("\")
$verify = Join-Path $root "Verify-Release.ps1"

# Reproduce the launcher shape safely: a directory argument ending in "\.".
& powershell -NoProfile -ExecutionPolicy Bypass -File $verify -InstallRoot "$root\."
if ($LASTEXITCODE -ne 0) {
    throw "Verifier rejected a valid launcher path."
}

$previousVerifyOnly = $env:TOOLBET_LAUNCHER_VERIFY_ONLY
try {
    $env:TOOLBET_LAUNCHER_VERIFY_ONLY = "1"
    & cmd.exe /d /c "call `"$root\ToolBet.bat`""
    if ($LASTEXITCODE -ne 0) {
        throw "ToolBet.bat launcher regression failed."
    }
} finally {
    $env:TOOLBET_LAUNCHER_VERIFY_ONLY = $previousVerifyOnly
}

# It must fail closed for a path without a manifest and must never print OK.
$missing = Join-Path $env:TEMP ("toolbet-verifier-missing-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $missing | Out-Null
try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $verify -InstallRoot "$missing\." 2>&1
    if ($LASTEXITCODE -eq 0) {
        throw "Verifier accepted a directory without manifest."
    }
    if (($output | Out-String) -match "\[OK\]") {
        throw "Verifier printed OK after an integrity failure."
    }
} finally {
    Remove-Item -LiteralPath $missing -Recurse -Force
}

Write-Host "PASS: release verifier path + fail-closed"
