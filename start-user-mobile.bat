@echo off
echo ===================================================
echo   FIC Locker - User Mobile App Launcher
echo ===================================================

REM Ensure ADB is accessible from Android SDK if installed
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"
)

echo [1/3] Setting up ADB port forwarding (Metro 8081, Backend 5000)...
adb reverse tcp:8081 tcp:8081 2>nul
adb reverse tcp:5000 tcp:5000 2>nul

echo [2/3] Starting Metro Bundler in new window...
start "User App Metro" cmd /k "cd /d %~dp0user && npm start"

echo [3/3] Installing and launching app on connected device...
cd /d %~dp0user
call npx react-native run-android

pause

