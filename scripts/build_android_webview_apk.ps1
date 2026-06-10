param(
    [string]$SdkRoot = "D:\program\Android\SDK",
    [string]$BuildToolsVersion = "37.0.0",
    [string]$PlatformVersion = "android-36.1",
    [string]$NodePath = "D:\HBuilderX\plugins\node\node.exe"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir ".."))
$ShellRoot = Join-Path $RepoRoot "android-webview-shell"
$H5Root = Join-Path $RepoRoot "unpackage\dist\build\h5"
$BuildRoot = Join-Path $ShellRoot "build"
$AssetsRoot = Join-Path $ShellRoot "assets\www"
$ReleaseRoot = Join-Path $RepoRoot "release\android-v2"
$Keystore = Join-Path $RepoRoot "release\novel-reader-update.keystore"
$LegacyUpdateKeystore = Join-Path $RepoRoot "release\android-v1\novel-reader-v1-test.keystore"

function Assert-RepoPath([string]$Path) {
    $full = [System.IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify path outside repository: $full"
    }
}

function Require-File([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }
}

function Invoke-Checked([scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command"
    }
}

function Add-ZipDirectory([string]$ZipPath, [string]$SourceRoot, [string]$EntryRoot) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        $sourcePrefix = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
        Get-ChildItem -Path $SourceRoot -File -Recurse | ForEach-Object {
            $fileFullName = [System.IO.Path]::GetFullPath($_.FullName)
            $relative = $fileFullName.Substring($sourcePrefix.Length)
            $entryName = ($EntryRoot.TrimEnd("/") + "/" + ($relative -replace "\\", "/")).TrimStart("/")
            $existing = $zip.GetEntry($entryName)
            if ($existing) {
                $existing.Delete()
            }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip,
                $_.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $zip.Dispose()
    }
}

function Assert-ApkAsset([string]$ApkPath, [string]$EntryName) {
    $entries = & jar.exe tf $ApkPath
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to list APK entries: $ApkPath"
    }
    if ($entries -notcontains $EntryName) {
        throw "APK asset missing: $EntryName"
    }
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

$BuildToolsRoot = Join-Path $SdkRoot "build-tools\$BuildToolsVersion"
$AndroidJar = Join-Path $SdkRoot "platforms\$PlatformVersion\android.jar"
$Aapt2 = Join-Path $BuildToolsRoot "aapt2.exe"
$D8 = Join-Path $BuildToolsRoot "d8.bat"
$Zipalign = Join-Path $BuildToolsRoot "zipalign.exe"
$Apksigner = Join-Path $BuildToolsRoot "apksigner.bat"

Require-File (Join-Path $H5Root "index.html")
Require-File $AndroidJar
Require-File $Aapt2
Require-File $D8
Require-File $Zipalign
Require-File $Apksigner
Require-File $NodePath

Assert-RepoPath $BuildRoot
Assert-RepoPath $AssetsRoot
Assert-RepoPath $ReleaseRoot
Assert-RepoPath $Keystore
Assert-RepoPath $LegacyUpdateKeystore

foreach ($path in @($BuildRoot, $AssetsRoot)) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

New-Item -ItemType Directory -Force -Path $BuildRoot, $AssetsRoot, $ReleaseRoot | Out-Null
Copy-Item -Path (Join-Path $H5Root "*") -Destination $AssetsRoot -Recurse -Force

$indexPath = Join-Path $AssetsRoot "index.html"
$indexHtml = Read-Utf8 $indexPath
$indexHtml = $indexHtml -replace "href=/", "href="
$indexHtml = $indexHtml -replace "src=/", "src="
Write-Utf8NoBom $indexPath $indexHtml

Get-ChildItem -Path (Join-Path $AssetsRoot "static\js") -Filter "*.js" -Recurse | ForEach-Object {
    $js = Read-Utf8 $_.FullName
    $js = $js -replace 's\.p="/"', 's.p=""'
    $js = $js -replace 'publicPath="/"', 'publicPath=""'
    Write-Utf8NoBom $_.FullName $js
    Invoke-Checked { & $NodePath --check $_.FullName }
}

$CompiledRes = Join-Path $BuildRoot "compiled-res.zip"
$GenRoot = Join-Path $BuildRoot "gen"
$ClassesRoot = Join-Path $BuildRoot "classes"
$DexRoot = Join-Path $BuildRoot "dex"
$UnsignedApk = Join-Path $BuildRoot "novel-reader-unsigned.apk"
$AlignedApk = Join-Path $BuildRoot "novel-reader-aligned.apk"
$FinalApk = Join-Path $ReleaseRoot "V2.apk"

New-Item -ItemType Directory -Force -Path $GenRoot, $ClassesRoot, $DexRoot | Out-Null

Invoke-Checked { & $Aapt2 compile --dir (Join-Path $ShellRoot "res") -o $CompiledRes }
Invoke-Checked { & $Aapt2 link `
        -o $UnsignedApk `
        -I $AndroidJar `
        --manifest (Join-Path $ShellRoot "AndroidManifest.xml") `
        --java $GenRoot `
        --min-sdk-version 23 `
        --target-sdk-version 36 `
        -A (Join-Path $ShellRoot "assets") `
        $CompiledRes }
Add-ZipDirectory -ZipPath $UnsignedApk -SourceRoot (Join-Path $ShellRoot "assets") -EntryRoot "assets"
Assert-ApkAsset -ApkPath $UnsignedApk -EntryName "assets/www/index.html"

$JavaFiles = Get-ChildItem -Path (Join-Path $ShellRoot "src") -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
Invoke-Checked { & javac.exe -encoding UTF-8 -source 8 -target 8 -bootclasspath $AndroidJar -d $ClassesRoot $JavaFiles }
Invoke-Checked { & $D8 --min-api 23 --lib $AndroidJar --output $DexRoot (Get-ChildItem -Path $ClassesRoot -Filter "*.class" -Recurse | ForEach-Object { $_.FullName }) }

Push-Location $DexRoot
try {
    Invoke-Checked { & jar.exe uf $UnsignedApk "classes.dex" }
}
finally {
    Pop-Location
}

if ((-not (Test-Path $Keystore -PathType Leaf)) -and (Test-Path $LegacyUpdateKeystore -PathType Leaf)) {
    Copy-Item -LiteralPath $LegacyUpdateKeystore -Destination $Keystore -Force
}

if (-not (Test-Path $Keystore -PathType Leaf)) {
    Invoke-Checked { & keytool.exe -genkeypair `
            -keystore $Keystore `
            -storepass android `
            -keypass android `
            -alias novelreader `
            -keyalg RSA `
            -keysize 2048 `
            -validity 10000 `
            -dname "CN=Novel Reader,O=Local,C=CN" `
            -noprompt }
}

Invoke-Checked { & $Zipalign -p -f 4 $UnsignedApk $AlignedApk }
Invoke-Checked { & $Apksigner sign `
        --ks $Keystore `
        --ks-pass pass:android `
        --key-pass pass:android `
        --out $FinalApk `
        $AlignedApk }
Invoke-Checked { & $Apksigner verify --verbose --print-certs $FinalApk }

Write-Host "APK written: $FinalApk"
