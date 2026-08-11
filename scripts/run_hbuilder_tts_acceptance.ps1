[CmdletBinding()]
param(
    [string]$BackendUrl = "http://127.0.0.1:8765",
    [ValidateRange(1, 65535)]
    [int]$DevicePort = 8765,
    [string]$PackageName = "io.dcloud.HBuilder",
    [string]$AdbPath = "",
    [string]$ArtifactRoot = "",
    [ValidateRange(30, 1800)]
    [int]$TimeoutSeconds = 600,
    [switch]$NoPrompt,
    [switch]$AllowUpstreamTts
)

$ErrorActionPreference = "Stop"
if (-not $AllowUpstreamTts) {
    throw "Real TTS acceptance may synthesize uncached text. Re-run with -AllowUpstreamTts only after explicitly approving provider usage."
}
$markerPrefix = "TTS_ACCEPTANCE:"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $ArtifactRoot) {
    $ArtifactRoot = Join-Path $repoRoot "artifacts\tts-acceptance"
}
$artifactDir = Join-Path $ArtifactRoot $timestamp
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
$logcatPath = Join-Path $artifactDir "device-logcat.txt"
$markerLogPath = Join-Path $artifactDir "tts-markers.txt"
$summaryPath = Join-Path $artifactDir "orchestration-report.json"
$screenshotPath = Join-Path $artifactDir "device-final.png"

function Resolve-Adb {
    param([string]$RequestedPath)
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $command = Get-Command adb -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += (Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe")
    }
    if ($env:ANDROID_HOME) {
        $candidates += (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe")
    }
    $candidates += "D:\program\Android\SDK\platform-tools\adb.exe"
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw "adb.exe not found. Pass -AdbPath or configure ANDROID_SDK_ROOT."
}

function Invoke-Adb {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string]$Serial,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    $output = & $Executable "-s" $Serial @Arguments 2>&1
    if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
        throw "adb command failed: adb -s $Serial $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine).Trim()
}

function Invoke-BackendJson {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $parameters = @{
        Method      = $Method
        Uri         = $Uri
        Headers     = $Headers
        TimeoutSec  = 15
        ErrorAction = "Stop"
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        $parameters.Body = $Body | ConvertTo-Json -Depth 10 -Compress
    }
    return Invoke-RestMethod @parameters
}

function New-AcceptanceAccessToken {
    param([string]$BaseUrl)
    $configuredUsername = [string]$env:TTS_ACCEPTANCE_USERNAME
    $configuredPassword = [string]$env:TTS_ACCEPTANCE_PASSWORD
    if ($configuredUsername) {
        if (-not $configuredPassword) {
            throw "TTS_ACCEPTANCE_PASSWORD is required when TTS_ACCEPTANCE_USERNAME is set."
        }
        $loginBody = @{ username = $configuredUsername; password = $configuredPassword }
    }
    else {
        $suffix = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString())
        $suffix = $suffix.Substring([Math]::Max(0, $suffix.Length - 10))
        $temporaryUsername = "tts_auto_$suffix"
        $temporaryPassword = "TtsAuto-$([Guid]::NewGuid().ToString('N').Substring(0, 18))"
        $registerBody = @{
            username = $temporaryUsername
            email    = "$temporaryUsername@example.com"
            password = $temporaryPassword
        }
        Invoke-BackendJson -Method "POST" -Uri "$BaseUrl/api/auth/register" -Body $registerBody | Out-Null
        $loginBody = @{ username = $temporaryUsername; password = $temporaryPassword }
    }
    $login = Invoke-BackendJson -Method "POST" -Uri "$BaseUrl/api/auth/login" -Body $loginBody
    if (-not $login.access_token) {
        throw "Backend login did not return an access token."
    }
    return [string]$login.access_token
}

function Get-MarkerPayloads {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return @()
    }
    $payloads = @()
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue) {
        $markerIndex = $line.IndexOf($markerPrefix, [System.StringComparison]::Ordinal)
        if ($markerIndex -lt 0) {
            continue
        }
        $json = $line.Substring($markerIndex + $markerPrefix.Length).Trim()
        try {
            $payloads += ($json | ConvertFrom-Json -ErrorAction Stop)
        }
        catch {
            # Preserve malformed markers in logcat; do not treat them as results.
        }
    }
    return @($payloads)
}

$resolvedAdb = Resolve-Adb -RequestedPath $AdbPath
$logcatProcess = $null
$report = [ordered]@{
    schema_version = 1
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    backend_url = $BackendUrl
    device_port = $DevicePort
    package_name = $PackageName
    adb_path = $resolvedAdb
    device_serial = ""
    readiness = $null
    tts_status = $null
    reverse = ""
    app_was_running = $false
    app_launched = $false
    background_resume_triggered = $false
    marker_count = 0
    device_result = $null
    passed = $false
    error = ""
}

try {
    $deviceLines = & $resolvedAdb "devices" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "adb devices failed: $($deviceLines -join [Environment]::NewLine)"
    }
    $devices = @(
        $deviceLines |
            Where-Object { $_ -match "^([^\s]+)\s+device(?:\s|$)" } |
            ForEach-Object { $Matches[1] }
    )
    if ($devices.Count -ne 1) {
        throw "Exactly one authorized Android device is required; found $($devices.Count)."
    }
    $serial = $devices[0]
    $report.device_serial = $serial

    $packagePath = Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "shell", "pm", "path", $PackageName
    )
    if (-not $packagePath.StartsWith("package:")) {
        throw "$PackageName is not installed on device $serial."
    }
    $pidBefore = Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "shell", "pidof", $PackageName
    ) -AllowFailure
    $report.app_was_running = [bool]$pidBefore

    $baseUri = [Uri]$BackendUrl
    if ($baseUri.Scheme -notin @("http", "https")) {
        throw "BackendUrl must use http or https."
    }
    $backendPort = if ($baseUri.IsDefaultPort) {
        if ($baseUri.Scheme -eq "https") { 443 } else { 80 }
    } else {
        $baseUri.Port
    }
    $report.reverse = Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "reverse", "tcp:$DevicePort", "tcp:$backendPort"
    )

    $normalizedBackendUrl = $BackendUrl.TrimEnd("/")
    $readiness = Invoke-BackendJson -Method "GET" -Uri "$normalizedBackendUrl/api/health/ready"
    $report.readiness = $readiness
    $token = New-AcceptanceAccessToken -BaseUrl $normalizedBackendUrl
    $ttsStatus = Invoke-BackendJson -Method "GET" -Uri "$normalizedBackendUrl/api/tts/status" -Headers @{
        Authorization = "Bearer $token"
    }
    $report.tts_status = $ttsStatus
    if ($ttsStatus.PSObject.Properties.Name -contains "enabled" -and -not $ttsStatus.enabled) {
        throw "Cloud TTS is disabled. Configure backend/.env before device acceptance."
    }
    if ($ttsStatus.PSObject.Properties.Name -contains "configured" -and -not $ttsStatus.configured) {
        throw "Cloud TTS credentials are incomplete. Configure backend/.env before device acceptance."
    }

    & $resolvedAdb "-s" $serial "logcat" "-c" | Out-Null
    $logcatProcess = Start-Process `
        -FilePath $resolvedAdb `
        -ArgumentList @("-s", $serial, "logcat", "-v", "time") `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logcatPath `
        -RedirectStandardError (Join-Path $artifactDir "adb-logcat-error.txt") `
        -PassThru

    Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "shell", "monkey", "-p", $PackageName, "-c", "android.intent.category.LAUNCHER", "1"
    ) | Out-Null
    $report.app_launched = $true
    Write-Host "HBuilderX Android base is ready on device $serial." -ForegroundColor Green
    if (-not $NoPrompt) {
        Write-Host "If the acceptance page is not already open, enter Debug -> TTS Auto Acceptance now."
        Read-Host "Press Enter after the page starts running" | Out-Null
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $backgroundTriggered = $false
    $completePayload = $null
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $payloads = Get-MarkerPayloads -Path $logcatPath
        if (-not $backgroundTriggered) {
            $startPayload = $payloads | Where-Object {
                $_.phase -eq "background_ready" -or (
                    $_.step -eq "background_stop" -and $_.status -eq "waiting_background"
                )
            } | Select-Object -First 1
            if ($startPayload) {
                Start-Sleep -Seconds 2
                Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
                    "shell", "input", "keyevent", "KEYCODE_HOME"
                ) | Out-Null
                Start-Sleep -Seconds 2
                Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
                    "shell", "monkey", "-p", $PackageName, "-c", "android.intent.category.LAUNCHER", "1"
                ) | Out-Null
                $backgroundTriggered = $true
                $report.background_resume_triggered = $true
            }
        }
        $completePayload = $payloads | Where-Object {
            $_.phase -eq "complete"
        } | Select-Object -Last 1
        if ($completePayload) {
            break
        }
    }

    if ($logcatProcess -and -not $logcatProcess.HasExited) {
        Stop-Process -Id $logcatProcess.Id -Force
        $logcatProcess.WaitForExit()
    }
    $logcatProcess = $null

    $allPayloads = Get-MarkerPayloads -Path $logcatPath
    $report.marker_count = @($allPayloads).Count
    $markerLines = Select-String -LiteralPath $logcatPath -SimpleMatch $markerPrefix -ErrorAction SilentlyContinue
    @($markerLines | ForEach-Object { $_.Line }) |
        Set-Content -LiteralPath $markerLogPath -Encoding UTF8

    $remoteScreenshot = "/sdcard/tts-acceptance-$timestamp.png"
    Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "shell", "screencap", "-p", $remoteScreenshot
    ) | Out-Null
    Invoke-Adb -Executable $resolvedAdb -Serial $serial -Arguments @(
        "pull", $remoteScreenshot, $screenshotPath
    ) | Out-Null

    if (-not $completePayload) {
        throw "Timed out waiting for the $markerPrefix complete marker."
    }
    $report.device_result = $completePayload
    $reportedPassed = $false
    if ($completePayload.PSObject.Properties.Name -contains "passed") {
        $reportedPassed = [bool]$completePayload.passed
    }
    elseif ($completePayload.PSObject.Properties.Name -contains "result") {
        $reportedPassed = [string]$completePayload.result -eq "passed"
    }
    $report.passed = $reportedPassed
    if (-not $reportedPassed) {
        throw "The device acceptance page completed with a failed result."
    }
}
catch {
    $report.error = $_.Exception.Message
    Write-Error $_.Exception.Message
}
finally {
    if ($logcatProcess -and -not $logcatProcess.HasExited) {
        Stop-Process -Id $logcatProcess.Id -Force -ErrorAction SilentlyContinue
    }
    $report.generated_at = (Get-Date).ToUniversalTime().ToString("o")
    $report | ConvertTo-Json -Depth 20 |
        Set-Content -LiteralPath $summaryPath -Encoding UTF8
    Write-Host "Acceptance artifacts: $artifactDir"
}

if (-not $report.passed) {
    exit 1
}
Write-Host "HBuilderX real TTS acceptance passed." -ForegroundColor Green
