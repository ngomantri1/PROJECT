[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PrivateKeyPath,
    [switch]$Generate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Add-DerLength {
    param([System.Collections.Generic.List[byte]]$Target, [int]$Length)
    if ($Length -lt 128) {
        $Target.Add([byte]$Length)
        return
    }

    $lengthBytes = New-Object System.Collections.Generic.List[byte]
    $value = $Length
    while ($value -gt 0) {
        $lengthBytes.Insert(0, [byte]($value -band 0xff))
        $value = $value -shr 8
    }
    $Target.Add([byte](0x80 -bor $lengthBytes.Count))
    $Target.AddRange($lengthBytes)
}

function New-DerValue {
    param([byte]$Tag, [byte[]]$Content)
    $result = New-Object System.Collections.Generic.List[byte]
    $result.Add($Tag)
    Add-DerLength -Target $result -Length $Content.Length
    $result.AddRange($Content)
    return $result.ToArray()
}

function ConvertTo-DerInteger {
    param([byte[]]$Value)
    $first = 0
    while ($first -lt ($Value.Length - 1) -and $Value[$first] -eq 0) { $first++ }
    $unsigned = [byte[]]$Value[$first..($Value.Length - 1)]
    if (($unsigned[0] -band 0x80) -ne 0) {
        $unsigned = [byte[]]@(0) + $unsigned
    }
    return New-DerValue -Tag 0x02 -Content $unsigned
}

function Join-DerValues {
    param([byte[][]]$Values)
    $content = New-Object System.Collections.Generic.List[byte]
    foreach ($value in $Values) { $content.AddRange($value) }
    return $content.ToArray()
}

function Get-RsaPublicKeyDer {
    param($Parameters)
    $content = Join-DerValues -Values @(
        (ConvertTo-DerInteger -Value $Parameters.Modulus),
        (ConvertTo-DerInteger -Value $Parameters.Exponent)
    )
    return New-DerValue -Tag 0x30 -Content $content
}

function Get-SubjectPublicKeyInfoDer {
    param($Parameters)
    # rsaEncryption AlgorithmIdentifier: 1.2.840.113549.1.1.1 + NULL
    [byte[]]$algorithmIdentifier = 0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00
    $rsaPublicKey = Get-RsaPublicKeyDer -Parameters $Parameters
    [byte[]]$bitString = @(0) + $rsaPublicKey
    $subjectPublicKey = New-DerValue -Tag 0x03 -Content $bitString
    return New-DerValue -Tag 0x30 -Content (Join-DerValues -Values @($algorithmIdentifier, $subjectPublicKey))
}

function Get-Pkcs1PrivateKeyDer {
    param($Parameters)
    [byte[]]$zero = 0
    $content = Join-DerValues -Values @(
        (New-DerValue -Tag 0x02 -Content $zero),
        (ConvertTo-DerInteger -Value $Parameters.Modulus),
        (ConvertTo-DerInteger -Value $Parameters.Exponent),
        (ConvertTo-DerInteger -Value $Parameters.D),
        (ConvertTo-DerInteger -Value $Parameters.P),
        (ConvertTo-DerInteger -Value $Parameters.Q),
        (ConvertTo-DerInteger -Value $Parameters.DP),
        (ConvertTo-DerInteger -Value $Parameters.DQ),
        (ConvertTo-DerInteger -Value $Parameters.InverseQ)
    )
    return New-DerValue -Tag 0x30 -Content $content
}

function ConvertTo-Pem {
    param([string]$Label, [byte[]]$Der)
    $base64 = [Convert]::ToBase64String($Der)
    $lines = for ($offset = 0; $offset -lt $base64.Length; $offset += 64) {
        $base64.Substring($offset, [Math]::Min(64, $base64.Length - $offset))
    }
    return "-----BEGIN $Label-----`r`n$($lines -join "`r`n")`r`n-----END $Label-----`r`n"
}

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

function Read-Utf8Text {
    param([string]$Path)
    $bytes = [IO.File]::ReadAllBytes($Path)
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xef -and $bytes[1] -eq 0xbb -and $bytes[2] -eq 0xbf
    $offset = if ($hasBom) { 3 } else { 0 }
    $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes, $offset, $bytes.Length - $offset)
    return [pscustomobject]@{ Text = $text; HasBom = $hasBom }
}

function Write-Utf8TextPreservingBom {
    param([string]$Path, [string]$Text, [bool]$HasBom)
    $utf8 = [Text.UTF8Encoding]::new($HasBom)
    [IO.File]::WriteAllBytes($Path, $utf8.GetBytes($Text))
}

if (-not $Generate) {
    throw 'Run this script with -Generate and a private key path outside source control.'
}

if (Test-Path -LiteralPath $PrivateKeyPath) {
    throw "Private key already exists; refusing to overwrite: $PrivateKeyPath"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'src\BaccaratChromeAgent.Extension\manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Manifest was not found: $manifestPath"
}

$privateDirectory = Split-Path -Parent $PrivateKeyPath
if ([string]::IsNullOrWhiteSpace($privateDirectory)) {
    throw 'PrivateKeyPath must be an absolute path outside source control.'
}
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null

$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(2048)
try {
    $parameters = $rsa.ExportParameters($true)
    $publicKeyDer = Get-SubjectPublicKeyInfoDer -Parameters $parameters
    $publicKeyBase64 = [Convert]::ToBase64String($publicKeyDer)
    $extensionId = Get-ChromeExtensionId -PublicKeyDer $publicKeyDer
    $privatePem = ConvertTo-Pem -Label 'RSA PRIVATE KEY' -Der (Get-Pkcs1PrivateKeyDer -Parameters $parameters)
    [IO.File]::WriteAllText($PrivateKeyPath, $privatePem, [Text.UTF8Encoding]::new($false))
}
finally {
    $rsa.Dispose()
}

$manifestFile = Read-Utf8Text -Path $manifestPath
try { $null = $manifestFile.Text | ConvertFrom-Json }
catch { throw "manifest.json is invalid before adding the public key: $($_.Exception.Message)" }

$existingKey = [regex]::Match($manifestFile.Text, '"key"\s*:\s*"([^"]+)"')
if ($existingKey.Success) {
    throw 'manifest.json already has a key field; refusing to change the existing Extension ID.'
}

$lineEnding = if ($manifestFile.Text.Contains("`r`n")) { "`r`n" } else { "`n" }
$keyLine = "  `"key`": `"$publicKeyBase64`","
$updatedManifest = [regex]::Replace(
    $manifestFile.Text,
    '(?m)^(\s*"manifest_version"\s*:\s*3\s*,\s*)$',
    ('$1' + $lineEnding + $keyLine),
    1)
if ($updatedManifest -eq $manifestFile.Text) {
    throw 'Could not find manifest_version: 3 to insert the public key safely.'
}

try { $null = $updatedManifest | ConvertFrom-Json }
catch { throw "manifest.json is invalid after adding the public key: $($_.Exception.Message)" }
Write-Utf8TextPreservingBom -Path $manifestPath -Text $updatedManifest -HasBom $manifestFile.HasBom

$metadata = [ordered]@{
    extensionId = $extensionId
    publicKeyBase64 = $publicKeyBase64
    publicKeySha256 = (([System.Security.Cryptography.SHA256]::Create().ComputeHash($publicKeyDer) | ForEach-Object { $_.ToString('x2') }) -join '')
}
$metadataPath = "$PrivateKeyPath.public.json"
$metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Host "Public key was added to manifest.json."
Write-Host "Stable Extension ID: $extensionId"
Write-Host "Private key (never copy to source or installer): $PrivateKeyPath"
Write-Host "Metadata public: $metadataPath"
