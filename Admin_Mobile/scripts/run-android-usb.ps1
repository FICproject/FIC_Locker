param(
  [switch]$Rebuild,
  [switch]$NoEmulator
)

$ErrorActionPreference = 'Stop'
$mobileDir = Split-Path -Parent $PSScriptRoot

# 1. Locate ADB and Emulator executables across Android SDK locations
$sdkRoots = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
  'C:\Android\Sdk'
) | Where-Object { $_ -and (Test-Path $_) }

$adb = 'adb'
foreach ($root in $sdkRoots) {
  $candidate = Join-Path $root 'platform-tools\adb.exe'
  if (Test-Path $candidate) {
    $adb = $candidate
    break
  }
}

$emulatorExe = 'emulator'
foreach ($root in $sdkRoots) {
  $candidate = Join-Path $root 'emulator\emulator.exe'
  if (Test-Path $candidate) {
    $emulatorExe = $candidate
    break
  }
}

function Test-MetroRunning {
  try {
    $res = Invoke-WebRequest -Uri 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 3
    return ($res.StatusCode -eq 200 -and $res.Content -match 'packager-status:running')
  } catch {
    return $false
  }
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $conns)
  } catch {
    return $false
  }
}

# 2. Ensure Metro Bundler is running cleanly without EADDRINUSE conflicts
if (Test-MetroRunning) {
  Write-Host 'Metro Bundler is already running on http://localhost:8081' -ForegroundColor Green
} elseif (Test-PortInUse -Port 8081) {
  Write-Host 'Port 8081 is in use; checking if Metro is booting...' -ForegroundColor Yellow
  $metroReady = $false
  for ($i = 0; $i -lt 6; $i++) {
    if (Test-MetroRunning) {
      $metroReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if ($metroReady) {
    Write-Host 'Metro Bundler is ready on http://localhost:8081' -ForegroundColor Green
  } else {
    Write-Warning 'Port 8081 is already held by another process. Reusing existing port without spawning duplicate window.'
  }
} else {
  Write-Host 'Starting Metro Bundler in a background terminal (port 8081)...'
  Start-Process -FilePath 'cmd.exe' -WorkingDirectory $mobileDir -ArgumentList '/k', 'npm start'
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-MetroRunning) {
      Write-Host 'Metro Bundler is now running on http://localhost:8081' -ForegroundColor Green
      break
    }
  }
}

# 3. Check connected Android devices or auto-launch emulator
Write-Host 'Checking connected Android devices...'
$rawDevices = @()
try {
  $rawDevices = @(& $adb devices)
} catch {
  Write-Warning 'Could not execute ADB. Please ensure Android SDK platform-tools are installed.'
}

$deviceLines = @($rawDevices | Select-String "^\S+\s+device$")
$unauthLines = @($rawDevices | Select-String "^\S+\s+unauthorized$")

if ($deviceLines.Count -eq 0 -and $unauthLines.Count -gt 0) {
  $unauthSerial = ($unauthLines[0].Line -split "\s+")[0]
  Write-Warning "Device '$unauthSerial' is connected, but USB debugging is not yet authorized on the phone screen."
  Write-Host "Please unlock your phone and tap 'Allow' on the 'Allow USB debugging?' prompt." -ForegroundColor Cyan
  Write-Host "Waiting up to 20 seconds for authorization..."
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    $rawDevices = @(& $adb devices)
    $deviceLines = @($rawDevices | Select-String "^\S+\s+device$")
    if ($deviceLines.Count -gt 0) { break }
  }
}

# 4. If no device found, try auto-launching an installed Android emulator
if ($deviceLines.Count -eq 0 -and (-not $NoEmulator)) {
  $avds = @()
  try {
    $avds = @(& $emulatorExe -list-avds | Where-Object { $_ -and $_.Trim() -ne '' })
  } catch {}

  if ($avds.Count -gt 0) {
    $targetAvd = $avds[0].Trim()
    Write-Host "No connected physical device found. Auto-launching Android Emulator '$targetAvd'..." -ForegroundColor Cyan
    Start-Process -FilePath $emulatorExe -ArgumentList "-avd $targetAvd"
    Write-Host "Waiting for emulator to boot up..."
    & $adb wait-for-device
    $booted = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 2
      $status = (& $adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
      if ($status -eq '1') {
        $booted = $true
        break
      }
    }
    if ($booted) {
      Write-Host "Emulator '$targetAvd' is online and ready!" -ForegroundColor Green
      $rawDevices = @(& $adb devices)
      $deviceLines = @($rawDevices | Select-String "^\S+\s+device$")
    }
  }
}

if ($deviceLines.Count -eq 0) {
  Write-Host ''
  Write-Host '========================================================================' -ForegroundColor Yellow
  Write-Host '           NO CONNECTED ANDROID DEVICE OR EMULATOR DETECTED             ' -ForegroundColor Yellow
  Write-Host '========================================================================' -ForegroundColor Yellow
  Write-Host 'To run on your physical Android phone:' -ForegroundColor Cyan
  Write-Host '  1. Plug your phone into your computer with a USB cable.'
  Write-Host '  2. On your phone, change USB mode from "Charging only" to "File Transfer" (MTP).'
  Write-Host '  3. In Phone Settings -> Developer options -> Turn ON "USB Debugging".'
  Write-Host '  4. Unlock your phone and tap "Allow" when prompted "Allow USB debugging?".'
  Write-Host ''
  Write-Host 'Or start an emulator manually:' -ForegroundColor Cyan
  Write-Host '  Run: emulator -avd Pixel_7a'
  Write-Host '========================================================================' -ForegroundColor Yellow
  exit 1
}

$serial = ($deviceLines[0].Line -split "\s+")[0]
$abi = (& $adb -s $serial shell getprop ro.product.cpu.abi | Out-String).Trim()
Write-Host "Target device: $serial (ABI: $abi)" -ForegroundColor Green

# 5. Reverse backend (5000) and Metro (8081) ports
Write-Host 'Setting up ADB port reverse (5000 & 8081)...'
& $adb -s $serial reverse tcp:5000 tcp:5000 | Out-Null
& $adb -s $serial reverse tcp:8081 tcp:8081 | Out-Null

# 6. Install APK if missing or -Rebuild requested
$pkgCheck = (& $adb -s $serial shell pm list packages com.adminmobile | Out-String).Trim()
$apk = Join-Path $mobileDir 'android\app\build\outputs\apk\debug\app-debug.apk'

if ($Rebuild -or -not ($pkgCheck -match 'package:com\.adminmobile') -or -not (Test-Path $apk)) {
  Write-Host 'Building Android debug APK (assembleDebug)...' -ForegroundColor Cyan
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

  Write-Host 'Installing APK via ADB onto device...' -ForegroundColor Cyan
  & $adb -s $serial install --no-streaming -r -t $apk
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host 'com.adminmobile is already installed — skipping reinstall.' -ForegroundColor Green
}

# 7. Warm up Metro Android bundle and launch app
try {
  Invoke-WebRequest -Uri 'http://localhost:8081/index.bundle?platform=android&dev=true&minify=false' -UseBasicParsing -TimeoutSec 15 | Out-Null
} catch {}

Write-Host 'Launching FIC Locker Admin Mobile...' -ForegroundColor Green
& $adb -s $serial shell am force-stop com.adminmobile | Out-Null
& $adb -s $serial shell am start -n com.adminmobile/.MainActivity
Write-Host 'FIC Locker Admin Mobile launched successfully!' -ForegroundColor Green
