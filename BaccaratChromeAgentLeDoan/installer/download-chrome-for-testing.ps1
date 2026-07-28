[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot 'artifacts\publish\browser'
}

$metadataUrl = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json'
$metadata = Invoke-RestMethod -Uri $metadataUrl
$stable = $metadata.channels.Stable
if (-not [string]::IsNullOrWhiteSpace($Version) -and $Version -ne $stable.version) {
    throw "Requested Chrome for Testing version $Version is unavailable from the current Stable channel ($($stable.version))."
}

$download = @($stable.downloads.chrome | Where-Object { $_.platform -eq 'win64' } | Select-Object -First 1)
if ($download.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$download[0].url)) {
    throw 'Chrome for Testing win64 download URL was not found.'
}

$browserExe = Join-Path $OutputDirectory 'chrome-win64\chrome.exe'
if (Test-Path -LiteralPath $browserExe) {
    Write-Host "Chrome for Testing already present: $browserExe"
    exit 0
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('baccarat-cft-' + [guid]::NewGuid().ToString('N'))
$archive = Join-Path $tempRoot 'chrome-win64.zip'
try {
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    # curl.exe is shipped with current Windows and handles the large archive more
    # reliably than Invoke-WebRequest on Windows PowerShell 5.1.
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($null -eq $curl) { throw 'curl.exe is required to download Chrome for Testing.' }
    & $curl.Source --fail --location --retry 3 --connect-timeout 30 --output $archive $download[0].url
    if ($LASTEXITCODE -ne 0) { throw "Chrome for Testing download failed with curl exit code $LASTEXITCODE." }
    Expand-Archive -LiteralPath $archive -DestinationPath $tempRoot -Force

    $extracted = Join-Path $tempRoot 'chrome-win64'
    if (-not (Test-Path -LiteralPath (Join-Path $extracted 'chrome.exe'))) {
        throw 'Downloaded archive does not contain chrome-win64\\chrome.exe.'
    }

    if (Test-Path -LiteralPath $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    Move-Item -LiteralPath $extracted -Destination (Join-Path $OutputDirectory 'chrome-win64') -Force

    [ordered]@{
        browser = 'Chrome for Testing'
        version = [string]$stable.version
        platform = 'win64'
        source = [string]$download[0].url
        sha256 = (Get-FileHash -LiteralPath (Join-Path $OutputDirectory 'chrome-win64\chrome.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
        builtAtUtc = [DateTime]::UtcNow.ToString('O')
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'browser-runtime.json') -Encoding UTF8

    Write-Host "Chrome for Testing $($stable.version) prepared: $OutputDirectory"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
