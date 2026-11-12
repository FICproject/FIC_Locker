param(
  [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
$mobileDir = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  $adb = 'adb'
}

function Test-MetroRunning {
  try {
    $res = Invoke-WebRequest -Uri 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 2
    return ($res.StatusCode -eq 200 -and $res.Content -match 'packager-status:running')
  } catch {
    return $false
  }
}

# 1. Ensure visible Metro Bundler window is running on port 8081
if (-not (Test-MetroRunning)) {
  Write-Host 'Starting Metro Bundler in a new terminal window (port 8081)...'
  Start-Process -FilePath 'cmd.exe' -WorkingDirectory $mobileDir -ArgumentList '/k', 'npm start'
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-MetroRunning) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    Write-Warning 'Metro Bundler is still starting; continuing device launch...'
  } else {
    Write-Host 'Metro Bundler is running on http://localhost:8081'
  }
} else {
  Write-Host 'Metro Bundler already running on http://localhost:8081'
}

# 2. Check connected ADB device
Write-Host 'Checking connected Android devices...'
$deviceLines = & $adb devices | Select-String "^\S+\s+device$"
if (-not $deviceLines) {
  Write-Error 'No connected Android device or emulator found. Connect your phone via USB debugging or start an emulator.'
  exit 1
}

$serial = ($deviceLines[0].Line -split "\s+")[0]
$abi = (& $adb -s $serial shell getprop ro.product.cpu.abi | Out-String).Trim()
Write-Host "Target device: $serial (ABI: $abi)"

# 3. Forward backend (5000) and Metro (8081) ports
Write-Host 'Setting up ADB port reverse (5000 & 8081)...'
& $adb -s $serial reverse tcp:5000 tcp:5000 | Out-Null
& $adb -s $serial reverse tcp:8081 tcp:8081 | Out-Null

# 4. Install only if missing or -Rebuild requested (avoids ColorOS USB install hang on JS-only changes)
$pkgCheck = (& $adb -s $serial shell pm list packages com.adminmobile | Out-String).Trim()
if ($Rebuild -or -not ($pkgCheck -match 'package:com\.adminmobile')) {
  Write-Host 'Building Android debug APK (assembleDebug)...'
  Push-Location (Join-Path $mobileDir 'android')
  try {
    if ($abi) {
      & .\gradlew.bat assembleDebug "--warning-mode=none" "-PreactNativeArchitectures=$abi"
    } else {
      & .\gradlew.bat assembleDebug "--warning-mode=none"
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }

  $apk = Join-Path $mobileDir 'android\app\build\outputs\apk\debug\app-debug.apk'
  Write-Host 'Installing APK via ADB (unlock phone and tap Install if ColorOS prompts)...'
  & $adb -s $serial install --no-streaming -r -t $apk
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host 'com.adminmobile is already installed — skipping Gradle/USB reinstall (run "npm run android:rebuild" if native code changed).'
}

# 5. Warm up Metro Android bundle and relaunch app so it fetches JS cleanly
try {
  Invoke-WebRequest -Uri 'http://localhost:8081/index.bundle?platform=android&dev=true&minify=false' -UseBasicParsing -TimeoutSec 25 | Out-Null
} catch {}

Write-Host 'Launching FIC Locker Admin...'
& $adb -s $serial shell am force-stop com.adminmobile | Out-Null
& $adb -s $serial shell am start -n com.adminmobile/.MainActivity
