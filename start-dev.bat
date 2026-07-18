@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "DEFAULT_ADB=D:\program\Android\SDK\platform-tools\adb.exe"
set "ADB="
set "BACKEND_URL=http://127.0.0.1:8000"
set "HEALTH_URL=%BACKEND_URL%/api/health"

echo.
echo ========================================
echo Novel Reader development startup
echo ========================================
echo Project: %ROOT%
echo Backend: %BACKEND_DIR%
echo.

if not exist "%BACKEND_DIR%\app\main.py" (
  echo.
  echo [ERROR] FastAPI entry not found: %BACKEND_DIR%\app\main.py
  echo.
  goto :finish
)

if not exist "%PYTHON%" (
  echo.
  echo [ERROR] Python venv not found: %PYTHON%
  echo.
  echo Run first:
  echo   cd /d "%BACKEND_DIR%"
  echo   python -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
  goto :finish
)

if exist "%DEFAULT_ADB%" (
  set "ADB=%DEFAULT_ADB%"
) else (
  for /f "delims=" %%I in ('where adb 2^>nul') do (
    if not defined ADB set "ADB=%%I"
  )
)

if not defined ADB (
  echo.
  echo [ERROR] adb command not found. Install Android SDK platform-tools or update DEFAULT_ADB in this script.
  echo.
  goto :finish
)

echo [1/4] Checking FastAPI backend...
call :healthcheck
if errorlevel 1 (
  echo Backend is not running. Starting FastAPI in a new window...
  start "Novel Reader FastAPI" /D "%BACKEND_DIR%" "%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  call :wait_health
  if errorlevel 1 (
    echo.
    echo [ERROR] Backend startup failed or health check timed out: %HEALTH_URL%
    echo.
    goto :finish
  )
) else (
  echo Backend already healthy: %HEALTH_URL%
)

echo.
echo [2/4] Checking adb...
echo adb: %ADB%
"%ADB%" start-server
if errorlevel 1 (
  echo.
  echo [ERROR] adb start-server failed.
  echo.
  goto :finish
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$server = Get-NetTCPConnection -LocalPort 5037 -State Listen -ErrorAction SilentlyContinue; if (-not $server) { exit 2 }"
if errorlevel 2 (
  echo Starting persistent adb server window...
  start "Novel Reader ADB Server" /MIN "%ADB%" nodaemon server
  ping -n 3 127.0.0.1 >nul
)

echo.
echo [3/4] Checking connected Android device...
set "DEVICE="
set "UNAUTHORIZED="
for /l %%I in (1,1,10) do (
  set "DEVICE="
  set "UNAUTHORIZED="
  "%ADB%" devices
  for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
    if "%%B"=="device" if not defined DEVICE set "DEVICE=%%A"
    if "%%B"=="unauthorized" if not defined UNAUTHORIZED set "UNAUTHORIZED=%%A"
  )
  if defined DEVICE goto :device_checked
  if defined UNAUTHORIZED goto :device_checked
  echo Waiting for Android device... %%I/10
  ping -n 2 127.0.0.1 >nul
)

:device_checked

if defined UNAUTHORIZED (
  echo.
  echo [ERROR] Device is unauthorized. Unlock the phone and allow USB debugging, then run start-dev.bat again.
  echo.
  goto :finish
)

if not defined DEVICE (
  echo.
  echo [ERROR] No Android device detected. Connect USB cable, enable USB debugging, then run start-dev.bat again.
  echo.
  goto :finish
)

echo Device ready: %DEVICE%

echo.
echo [4/4] Rebuilding adb reverse tcp:8000...
"%ADB%" reverse --remove-all
if errorlevel 1 (
  echo.
  echo [ERROR] adb reverse --remove-all failed.
  echo.
  goto :finish
)

"%ADB%" reverse tcp:8000 tcp:8000
if errorlevel 1 (
  echo.
  echo [ERROR] adb reverse tcp:8000 tcp:8000 failed.
  echo.
  goto :finish
)

echo.
echo Current adb reverse list:
"%ADB%" reverse --list
powershell -NoProfile -ExecutionPolicy Bypass -Command "$adb = '%ADB%'; for ($i = 1; $i -le 3; $i++) { $list = & $adb reverse --list; if ($list -match 'tcp:8000\s+tcp:8000') { Write-Host 'Reverse confirmed: tcp:8000 tcp:8000'; exit 0 }; Write-Host \"Reverse missing after adb restart, rebuilding... $i/3\"; & $adb reverse tcp:8000 tcp:8000 | Out-Host; Start-Sleep -Seconds 1 }; Write-Host '[WARN] Reverse was not confirmed. Check USB debugging and run start-dev.bat again.'; exit 1"
echo.
echo ========================================
echo Ready.
echo App backend URL: %BACKEND_URL%
echo You can now open the phone App and login.
echo ========================================
goto :finish

:healthcheck
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 }; exit 1 } catch { exit 1 }"
exit /b %ERRORLEVEL%

:wait_health
for /l %%I in (1,1,20) do (
  ping -n 2 127.0.0.1 >nul
  call :healthcheck
  if not errorlevel 1 (
    echo Backend healthy: %HEALTH_URL%
    exit /b 0
  )
  echo Waiting for backend... %%I/20
)
exit /b 1

:finish
echo.
if not "%NOVEL_READER_START_DEV_NO_PAUSE%"=="1" pause
endlocal
