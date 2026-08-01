param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath
)

$ErrorActionPreference = 'Stop'
$targetPath = Join-Path $PSScriptRoot '..\src\BaccaratChromeAgent.Extension\legacy-v4_js_xoc_dia_live.js'
$source = (Resolve-Path -LiteralPath $SourcePath).Path
$target = (Resolve-Path -LiteralPath $targetPath).Path
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash

if ($sourceHash -ne $targetHash) {
    throw "legacy-v4_js_xoc_dia_live.js differs from source. source=$sourceHash target=$targetHash"
}

Write-Host "legacy JS synchronized: $sourceHash"
