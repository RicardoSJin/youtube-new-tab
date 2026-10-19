param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    node scripts/check.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Static checks failed' }
    if (-not $SkipTests) {
        npm test
        if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $extensionPath = Join-Path $PSScriptRoot 'extension'
    $manifest = Get-Content (Join-Path $extensionPath 'manifest.json') -Raw | ConvertFrom-Json
    $distPath = Join-Path $PSScriptRoot 'dist'
    New-Item -ItemType Directory -Path $distPath -Force | Out-Null
    $loadZip = Join-Path $distPath "youtube-new-tab-v$($manifest.version).zip"
    $sourceZip = Join-Path $distPath "youtube-new-tab-source-v$($manifest.version).zip"
    foreach ($targetZip in @($loadZip, $sourceZip)) {
        if (Test-Path -LiteralPath $targetZip) {
            Move-Item -LiteralPath $targetZip -Destination "$targetZip.previous-$(Get-Date -Format 'yyyyMMddHHmmssfff')"
        }
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($extensionPath, $loadZip)
    $archive = [System.IO.Compression.ZipFile]::Open($sourceZip, 'Create')
    try {
        $sourceFiles = @('README.md','PRIVACY.md','AGENTS.md','LICENSE','package.json','package-lock.json','package.ps1','package.sh','.gitignore','.gitattributes')
        $sourceFiles += Get-ChildItem -LiteralPath $extensionPath -File -Recurse | ForEach-Object { [System.IO.Path]::GetRelativePath($PSScriptRoot, $_.FullName) }
        foreach ($folder in @('scripts','tests','docs','.github')) {
            $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) -File -Recurse | ForEach-Object { [System.IO.Path]::GetRelativePath($PSScriptRoot, $_.FullName) }
        }
        foreach ($relativeFile in $sourceFiles) {
            $filePath = Join-Path $PSScriptRoot $relativeFile
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $filePath, $relativeFile.Replace('\','/')) | Out-Null
        }
    } finally { $archive.Dispose() }
    Get-FileHash -LiteralPath $loadZip,$sourceZip -Algorithm SHA256 | Format-Table Hash,Path
} finally { Pop-Location }
