[CmdletBinding()]
param(
    [string]$RuntimeDirectory,
    [string]$InstallRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ChromeExtensionId {
    param([byte[]]$PublicKeyDer)
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $bytes = $hash.ComputeHash($PublicKeyDer) }
    finally { $hash.Dispose() }

    $id = New-Object System.Text.StringBuilder
    for ($i = 0; $i -lt 16; $i++) {
        [void]$id.Append([char](97 + (($bytes[$i] -shr 4) -band 0x0f)))
        [void]$id.Append([char](97 + ($bytes[$i] -band 0x0f)))
    }
    return $id.ToString()
}

if ([string]::IsNullOrWhiteSpace($RuntimeDirectory)) {
    $root = Split-Path -Parent $PSScriptRoot
    $RuntimeDirectory = Join-Path $root 'artifacts\publish\extension'
}

if (-not [string]::IsNullOrWhiteSpace($InstallRoot)) {
    $pointer = Join-Path $InstallRoot 'extension\extension-runtime.json'
    if (-not (Test-Path -LiteralPath $pointer)) { throw "Installed extension pointer is missing: $pointer" }
    $pointerData = Get-Content -LiteralPath $pointer -Raw -Encoding UTF8 | ConvertFrom-Json
    $RuntimeDirectory = Join-Path $InstallRoot ('extension\v' + [string]$pointerData.extensionVersion)
}

$metadataPath = Join-Path $RuntimeDirectory 'extension-runtime.json'
$hashListPath = Join-Path $RuntimeDirectory 'runtime-files.sha256'
$manifestPath = Join-Path $RuntimeDirectory 'manifest.json'
foreach ($path in @($metadataPath, $hashListPath, $manifestPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required runtime file is missing: $path" }
}

$metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$metadata.extensionId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID in extension-runtime.json.' }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$publicKey = [Convert]::FromBase64String([string]$manifest.key)
$actualId = Get-ChromeExtensionId -PublicKeyDer $publicKey
if ($actualId -ne [string]$metadata.extensionId) { throw 'manifest.key does not match extension-runtime.json ID.' }

$hashLines = @(Get-Content -LiteralPath $hashListPath -Encoding UTF8 | Where-Object { $_.Trim() })
if ($hashLines.Count -eq 0) { throw 'runtime-files.sha256 is empty.' }
$calculated = foreach ($line in $hashLines) {
    $parts = $line -split ':', 2
    if ($parts.Count -ne 2 -or $parts[0] -match '(^|[\\/])\.\.([\\/]|$)' -or $parts[0] -match '\.(pem|pfx|key)$') {
        throw "Invalid runtime file entry: $line"
    }
    $file = Join-Path $RuntimeDirectory $parts[0]
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Runtime file missing: $($parts[0])" }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $parts[1].ToLowerInvariant()) { throw "Runtime checksum mismatch: $($parts[0])" }
    "$($parts[0]):$actual"
}
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
    $runtimeHash = (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($calculated | Sort-Object) -join "`n")) | ForEach-Object { $_.ToString('x2') }) -join '')
}
finally { $sha.Dispose() }
if ($runtimeHash -ne [string]$metadata.runtimeSha256) { throw 'Aggregate runtime SHA-256 does not match metadata.' }

$forbidden = Get-ChildItem -LiteralPath $RuntimeDirectory -File -Recurse | Where-Object { $_.Extension -in '.pem', '.pfx', '.key' }
if ($forbidden) { throw "Forbidden private key file in runtime: $($forbidden.FullName -join ', ')" }

if (-not [string]::IsNullOrWhiteSpace($InstallRoot)) {
    $hostManifest = Join-Path $InstallRoot 'nativehost\com.abx.baccarat_chrome_agent.json'
    if (-not (Test-Path -LiteralPath $hostManifest)) { throw "Native Host manifest missing: $hostManifest" }
    $host = Get-Content -LiteralPath $hostManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    $origin = 'chrome-extension://' + [string]$metadata.extensionId + '/'
    if (@($host.allowed_origins) -notcontains $origin) { throw 'Native Host does not allow the packaged extension ID.' }
}

Write-Host "Release verification passed. Extension ID: $actualId; Version: $($metadata.extensionVersion)"
