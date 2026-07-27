[CmdletBinding()]
param(
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ChromeExtensionId {
    param([byte[]]$PublicKeyDer)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha256.ComputeHash($PublicKeyDer) }
    finally { $sha256.Dispose() }

    $letters = New-Object System.Text.StringBuilder
    for ($index = 0; $index -lt 16; $index++) {
        [void]$letters.Append([char](97 + (($hash[$index] -shr 4) -band 0x0f)))
        [void]$letters.Append([char](97 + ($hash[$index] -band 0x0f)))
    }
    return $letters.ToString()
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $projectRoot 'src\BaccaratChromeAgent.Extension'
$allowListPath = Join-Path $PSScriptRoot 'extension-files.txt'
$templatePath = Join-Path $PSScriptRoot 'extension-runtime.template.json'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot 'artifacts\publish\extension'
}
$outputParent = Split-Path -Parent $OutputDirectory
$stagingDirectory = Join-Path $outputParent ('.extension-staging-' + [guid]::NewGuid().ToString('N'))
$backupDirectory = Join-Path $outputParent ('.extension-previous-' + [guid]::NewGuid().ToString('N'))

$files = @(
    Get-Content -LiteralPath $allowListPath -Encoding UTF8 |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and -not $_.StartsWith('#') }
)
if ($files.Count -eq 0 -or $files -notcontains 'manifest.json') {
    throw 'The allow-list must contain manifest.json and at least one runtime file.'
}

$invalid = $files | Where-Object {
    [IO.Path]::IsPathRooted($_) -or $_.Contains('..') -or $_ -match '\.(pem|pfx|key)$'
}
if ($invalid) { throw "Invalid allow-list entries: $($invalid -join ', ')" }

foreach ($relativePath in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $extensionRoot $relativePath) -PathType Leaf)) {
        throw "Missing runtime file: $relativePath"
    }
}

$manifestText = Get-Content -LiteralPath (Join-Path $extensionRoot 'manifest.json') -Raw -Encoding UTF8
try { $manifest = $manifestText | ConvertFrom-Json }
catch { throw "manifest.json is not valid JSON: $($_.Exception.Message)" }

if ($manifest.manifest_version -ne 3) { throw 'Only Manifest V3 is supported.' }
if (-not ($manifest.PSObject.Properties.Name -contains 'key') -or
    [string]::IsNullOrWhiteSpace([string]$manifest.key)) {
    throw 'manifest.json has no public key. Run extension-key.ps1 -Generate first.'
}

try { $publicKeyDer = [Convert]::FromBase64String([string]$manifest.key) }
catch { throw 'manifest.key is not valid Base64.' }
$extensionId = Get-ChromeExtensionId -PublicKeyDer $publicKeyDer

$manifestScripts = @([string]$manifest.background.service_worker)
foreach ($contentScript in @($manifest.content_scripts)) {
    foreach ($script in @($contentScript.js)) { $manifestScripts += [string]$script }
}
$missing = $manifestScripts | Where-Object { $_ -and $files -notcontains $_ } | Select-Object -Unique
if ($missing) { throw "Allow-list misses scripts declared by manifest: $($missing -join ', ')" }

New-Item -ItemType Directory -Path $outputParent -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

try {
    foreach ($relativePath in $files) {
        $destination = Join-Path $stagingDirectory $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $extensionRoot $relativePath) -Destination $destination -Force
    }

    $hashLines = foreach ($relativePath in ($files | Sort-Object)) {
        $hash = (Get-FileHash -LiteralPath (Join-Path $stagingDirectory $relativePath) -Algorithm SHA256).Hash.ToLowerInvariant()
        "$relativePath`:$hash"
    }
    $runtimeHash = [System.Security.Cryptography.SHA256]::Create()
    try {
        $runtimeSha256 = (($runtimeHash.ComputeHash([Text.Encoding]::UTF8.GetBytes(($hashLines -join "`n"))) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally { $runtimeHash.Dispose() }

    $publicKeyHash = [System.Security.Cryptography.SHA256]::Create()
    try {
        $publicKeySha256 = (($publicKeyHash.ComputeHash($publicKeyDer) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally { $publicKeyHash.Dispose() }

    $runtime = Get-Content -LiteralPath $templatePath -Raw -Encoding UTF8 |
        ConvertFrom-Json
    $runtime.extensionId = $extensionId
    $runtime.extensionVersion = [string]$manifest.version
    $runtime.publicKeySha256 = $publicKeySha256
    $runtime.runtimeSha256 = $runtimeSha256
    $runtime.builtAtUtc = [DateTime]::UtcNow.ToString('O')
    $runtime | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stagingDirectory 'extension-runtime.json') -Encoding UTF8
    $hashLines | Set-Content -LiteralPath (Join-Path $stagingDirectory 'runtime-files.sha256') -Encoding UTF8

    $publishedFiles = @(
        Get-ChildItem -LiteralPath $stagingDirectory -File -Recurse |
            ForEach-Object { $_.FullName.Substring($stagingDirectory.Length + 1) }
    )
    $expectedFiles = @($files + 'extension-runtime.json' + 'runtime-files.sha256')
    $unexpectedFiles = $publishedFiles | Where-Object { $expectedFiles -notcontains $_ }
    $missingFiles = $expectedFiles | Where-Object { $publishedFiles -notcontains $_ }
    if ($unexpectedFiles -or $missingFiles) {
        throw "Runtime output does not match allow-list. Missing: $($missingFiles -join ', '). Unexpected: $($unexpectedFiles -join ', ')"
    }

    if (Test-Path -LiteralPath $OutputDirectory) {
        Move-Item -LiteralPath $OutputDirectory -Destination $backupDirectory
    }
    Move-Item -LiteralPath $stagingDirectory -Destination $OutputDirectory
    if (Test-Path -LiteralPath $backupDirectory) {
        Remove-Item -LiteralPath $backupDirectory -Recurse -Force
    }

    Write-Host "Extension runtime created: $OutputDirectory"
    Write-Host "Stable Extension ID: $extensionId"
    Write-Host "Runtime SHA-256: $runtimeSha256"
}
catch {
    if (Test-Path -LiteralPath $backupDirectory -and -not (Test-Path -LiteralPath $OutputDirectory)) {
        Move-Item -LiteralPath $backupDirectory -Destination $OutputDirectory
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
