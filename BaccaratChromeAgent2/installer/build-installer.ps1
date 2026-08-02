[CmdletBinding()]
param(
    [string]$InnoSetupCompiler = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$publish = Join-Path $root 'artifacts\publish'
$desktop = Join-Path $root 'src\BaccaratChromeAgent.Desktop\BaccaratChromeAgent.Desktop.csproj'
$nativeHost = Join-Path $root 'src\BaccaratChromeAgent.NativeHost\BaccaratChromeAgent.NativeHost.csproj'
$extensionBuild = Join-Path $PSScriptRoot 'build-extension-package.ps1'
$browserBuild = Join-Path $PSScriptRoot 'download-chrome-for-testing.ps1'
$extensionMetadata = Join-Path $publish 'extension\extension-runtime.json'
$template = Join-Path $PSScriptRoot 'com.abx.baccarat_chrome_agent.json.template'
$releaseVerifier = Join-Path $PSScriptRoot 'verify-release.ps1'

# Create the allow-listed local extension runtime first. It obtains its stable ID
# from manifest.key; no private .pem is needed or accepted by this build.
& powershell -NoProfile -ExecutionPolicy Bypass -File $extensionBuild
if ($LASTEXITCODE -ne 0) { throw 'Extension runtime build failed.' }

# Google Chrome 137+ ignores --load-extension. Bundle Chrome for Testing so the
# customer does not have to install or manually enable an unpacked extension.
& powershell -NoProfile -ExecutionPolicy Bypass -File $browserBuild -OutputDirectory (Join-Path $publish 'browser')
if ($LASTEXITCODE -ne 0) { throw 'Chrome for Testing runtime build failed.' }
if (-not (Test-Path -LiteralPath (Join-Path $publish 'browser\chrome-win64\chrome.exe'))) {
    throw 'Chrome for Testing executable is missing from the browser runtime.'
}

if (-not (Test-Path -LiteralPath $extensionMetadata)) {
    throw "Extension runtime metadata is missing: $extensionMetadata"
}

$runtime = Get-Content -LiteralPath $extensionMetadata -Raw -Encoding UTF8 | ConvertFrom-Json
$extensionId = [string]$runtime.extensionId
$appVersion = [string]$runtime.extensionVersion
if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Extension runtime has an invalid stable extension ID.' }
if ([string]::IsNullOrWhiteSpace($appVersion) -or $appVersion -notmatch '^\d+\.\d+\.\d+') {
    throw 'Extension runtime has an invalid version.'
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $releaseVerifier -RuntimeDirectory (Join-Path $publish 'extension')
if ($LASTEXITCODE -ne 0) { throw 'Extension runtime release verification failed.' }

# Keep the template checked in as the documented manifest contract. The actual
# manifest is rendered by Inno Setup with the installed native-host path.
$templateText = Get-Content -LiteralPath $template -Raw -Encoding UTF8
if ($templateText -notmatch 'REPLACE_WITH_EXTENSION_ID' -or $templateText -notmatch 'REPLACE_WITH_NATIVE_HOST_PATH') {
    throw 'Native Host manifest template has invalid placeholders.'
}

dotnet publish $desktop -c Release -r win-x64 --self-contained true -o (Join-Path $publish 'desktop')
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }

dotnet publish $nativeHost -c Release -r win-x64 --self-contained true -o (Join-Path $publish 'nativehost')
if ($LASTEXITCODE -ne 0) { throw 'Native Host publish failed.' }

if (-not (Test-Path -LiteralPath $InnoSetupCompiler)) {
    throw 'ISCC.exe was not found. Install Inno Setup 6 or pass -InnoSetupCompiler.'
}

& $InnoSetupCompiler "/DExtensionId=$extensionId" "/DAppVersion=$appVersion" (Join-Path $PSScriptRoot 'BaccaratChromeAgent.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup build failed.' }

Write-Host "Setup created for extension ID: $extensionId"
Write-Host "Setup version: $appVersion"
