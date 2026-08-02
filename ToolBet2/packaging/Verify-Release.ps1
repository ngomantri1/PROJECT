param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"
try {
    if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
        throw "InstallRoot rong."
    }
    $root = [System.IO.Path]::GetFullPath($InstallRoot).TrimEnd("\", "/")
    $rootPrefix = $root + [System.IO.Path]::DirectorySeparatorChar
    $manifestPath = Join-Path $root "release-manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Thieu release-manifest.json"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($null -eq $manifest.files) {
        throw "Manifest khong co danh sach files."
    }
    foreach ($property in $manifest.files.PSObject.Properties) {
        $relative = [string]$property.Name
        $expected = [string]$property.Value
        if ([string]::IsNullOrWhiteSpace($relative) -or [string]::IsNullOrWhiteSpace($expected)) {
            throw "Manifest co entry rong."
        }
        $target = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Manifest co duong dan khong hop le: $relative"
        }
        if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
            throw "Thieu file: $relative"
        }
        $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected.ToLowerInvariant()) {
            throw "Sai checksum: $relative"
        }
    }
} catch {
    Write-Host "[BLOCK] Release integrity: $($_.Exception.Message)"
    exit 2
}
Write-Host "[OK] Release integrity"
exit 0
