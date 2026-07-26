param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
    [string]$ExtensionUrl = '',
    [string]$InnoSetupCompiler = "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$publish = Join-Path $root 'artifacts\publish'
$desktop = Join-Path $root 'src\BaccaratChromeAgent.Desktop\BaccaratChromeAgent.Desktop.csproj'
$nativeHost = Join-Path $root 'src\BaccaratChromeAgent.NativeHost\BaccaratChromeAgent.NativeHost.csproj'

dotnet publish $desktop -c Release -r win-x64 --self-contained true -o (Join-Path $publish 'desktop')
dotnet publish $nativeHost -c Release -r win-x64 --self-contained true -o (Join-Path $publish 'nativehost')

if (-not (Test-Path -LiteralPath $InnoSetupCompiler)) {
    throw "Không tìm thấy ISCC.exe. Hãy cài Inno Setup 6 hoặc truyền -InnoSetupCompiler."
}

& $InnoSetupCompiler "/DExtensionId=$ExtensionId" "/DExtensionUrl=$ExtensionUrl" (Join-Path $PSScriptRoot 'BaccaratChromeAgent.iss')
if ($LASTEXITCODE -ne 0) { throw "Inno Setup build thất bại." }
