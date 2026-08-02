param(
    [string]$Version = "0.8.0",
    [ValidateSet("internal", "customer")]
    [string]$Channel = "internal",
    [string]$LicenseApiUrl = "",
    [string]$LicensePublicKey = "",
    [string]$SigningThumbprint = "",
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    throw "Thiếu .venv. Chạy ToolBet.bat hoặc tạo venv trước."
}
if ($Channel -eq "customer") {
    if (-not $LicenseApiUrl.StartsWith("https://")) {
        throw "Bản customer yêu cầu -LicenseApiUrl HTTPS."
    }
    if (-not (Test-Path -LiteralPath $LicensePublicKey -PathType Leaf)) {
        throw "Bản customer yêu cầu -LicensePublicKey hợp lệ."
    }
    if ([string]::IsNullOrWhiteSpace($SigningThumbprint)) {
        throw "Bản customer yêu cầu chứng thư code signing (-SigningThumbprint)."
    }
}

Push-Location $root
try {
    if (-not $SkipTests) {
        & (Join-Path $root "scripts\run_tests.ps1")
        if ($LASTEXITCODE -ne 0) { throw "Test thất bại." }
    }

    & $python -m pip install -r requirements-build.txt
    if ($LASTEXITCODE -ne 0) { throw "Không cài được dependency build." }

    $work = Join-Path $root "build\release"
    $distBase = Join-Path $root "dist"
    $releaseName = "ToolBet2-$Version-$Channel-win-x64"
    $releaseRoot = Join-Path $distBase $releaseName
    if (Test-Path -LiteralPath $work) {
        Remove-Item -LiteralPath $work -Recurse -Force
    }
    if (Test-Path -LiteralPath $releaseRoot) {
        Remove-Item -LiteralPath $releaseRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $work, $releaseRoot | Out-Null

    $separator = [System.IO.Path]::PathSeparator
    $uiData = "$(Join-Path $root 'src\ui')${separator}src\ui"
    & $python -m PyInstaller `
        --noconfirm `
        --clean `
        --onedir `
        --console `
        --name ToolBet2 `
        --distpath $releaseRoot `
        --workpath (Join-Path $work "pyinstaller") `
        --specpath (Join-Path $work "spec") `
        --add-data $uiData `
        --collect-all ddddocr `
        --collect-all playwright `
        (Join-Path $root "main.py")
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller build thất bại." }
    & (Join-Path $releaseRoot "ToolBet2\ToolBet2.exe") --self-check
    if ($LASTEXITCODE -ne 0) { throw "Packaged executable self-check thất bại." }

    $templates = Join-Path $releaseRoot "templates"
    New-Item -ItemType Directory -Path $templates | Out-Null
    & $python scripts\make_release_config.py `
        --source config.example.yaml `
        --output (Join-Path $templates "config.example.yaml") `
        --channel $Channel `
        "--license-url=$LicenseApiUrl"
    if ($LASTEXITCODE -ne 0) { throw "Không tạo được release config." }
    Copy-Item credentials.example.yaml (Join-Path $templates "credentials.example.yaml")
    if ($LicensePublicKey) {
        Copy-Item -LiteralPath $LicensePublicKey -Destination (Join-Path $templates "license_public.pem")
    }
    Copy-Item packaging\ToolBet.bat $releaseRoot
    Copy-Item packaging\Verify-Release.ps1 $releaseRoot
    Copy-Item packaging\STOP-LIVE-BET.bat $releaseRoot
    Copy-Item packaging\ALLOW-LIVE-BET.bat $releaseRoot
    Copy-Item packaging\EXPORT-DIAGNOSTICS.bat $releaseRoot
    # cmd.exe parses batch files reliably only with CRLF. apply_patch/source
    # files may use LF, so normalize every shipped launcher mechanically.
    Get-ChildItem -LiteralPath $releaseRoot -Filter "*.bat" -File |
        ForEach-Object {
            $content = [System.IO.File]::ReadAllText($_.FullName)
            $content = [Regex]::Replace($content, "\r?\n", "`r`n")
            [System.IO.File]::WriteAllText(
                $_.FullName,
                $content,
                [System.Text.UTF8Encoding]::new($false)
            )
        }
    Copy-Item PILOT_RUNBOOK.md $releaseRoot
    Copy-Item HUONG_DAN_CAI_DAT.md (Join-Path $releaseRoot "HUONG_DAN.md")

    $releaseInfo = [ordered]@{
        product = "ToolBet2"
        version = $Version
        channel = $Channel
        built_at_utc = [DateTime]::UtcNow.ToString("o")
        data_root = "%LOCALAPPDATA%\ToolBet2"
    }
    $releaseInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot "release-info.json") -Encoding UTF8

    if ($SigningThumbprint) {
        $signtool = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source
        if (-not $signtool) { throw "Không tìm thấy signtool.exe trong PATH." }
        & $signtool sign /sha1 $SigningThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
            (Join-Path $releaseRoot "ToolBet2\ToolBet2.exe")
        if ($LASTEXITCODE -ne 0) { throw "Code signing thất bại." }
    }

    $files = [ordered]@{}
    Get-ChildItem -LiteralPath $releaseRoot -File -Recurse |
        Where-Object { $_.Name -ne "release-manifest.json" } |
        Sort-Object FullName |
        ForEach-Object {
            $relative = $_.FullName.Substring($releaseRoot.Length).TrimStart("\").Replace("\", "/")
            $files[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    [ordered]@{
        schema_version = 1
        version = $Version
        channel = $Channel
        files = $files
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $releaseRoot "release-manifest.json") -Encoding UTF8

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $releaseRoot "Verify-Release.ps1") -InstallRoot $releaseRoot
    if ($LASTEXITCODE -ne 0) { throw "Release integrity verification thất bại." }

    $archive = Join-Path $distBase "$releaseName.zip"
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    Compress-Archive -LiteralPath $releaseRoot -DestinationPath $archive -CompressionLevel Optimal
    Write-Host "RELEASE_DIR=$releaseRoot"
    Write-Host "RELEASE_ZIP=$archive"
} finally {
    Pop-Location
}
