# CafeCash deployment script (PowerShell)
# Usage:
#   .\deploy.ps1          — build + deploy everything (admin + APK)
#   .\deploy.ps1 admin    — admin Docker only
#   .\deploy.ps1 apk      — tablet APK only (release)
#   .\deploy.ps1 apk debug — debug APK

param(
    [string]$Target  = "all",
    [string]$ApkType = "release"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# ── Colors ───────────────────────────────────────────────────────────────────
function Log   { param($msg) Write-Host "[deploy] $msg" -ForegroundColor Cyan }
function Ok    { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Warn  { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Fail  { param($msg) Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }
function Header{ param($msg) Write-Host "`n── $msg ──" -ForegroundColor White }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
Header "Pre-flight checks"

# Check Docker
try {
    docker info 2>&1 | Out-Null
    Ok "Docker running"
} catch {
    Fail "Docker is not running"
}

# Check PocketBase
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8091/api/health" -UseBasicParsing -TimeoutSec 5
    Ok "PocketBase healthy"
} catch {
    Fail "PocketBase not running (check: docker ps)"
}

# Read IPs from .env files
function Get-IP($file, $key) {
    $line = Get-Content $file -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$key=" }
    if ($line) {
        # Extract IP from URL like http://1.2.3.4:8091
        $url = $line.Split("=", 2)[1]
        return ($url -replace "http://", "" -replace ":.*", "")
    }
    return ""
}

$TabletIp = Get-IP "apps\tablet\.env"       "EXPO_PUBLIC_API_URL"
$AdminIp  = Get-IP "apps\admin\.env.local"  "NEXT_PUBLIC_API_URL"

if (-not $TabletIp -or -not $AdminIp) {
    Fail "Could not read API URLs from .env files"
}

Log "Tablet API URL: http://${TabletIp}:8091"
Log "Admin API URL:  http://${AdminIp}:8091"

# ── Admin Docker deployment ───────────────────────────────────────────────────
function Deploy-Admin {
    Header "Admin Docker deployment"

    Log "Building admin image..."
    docker compose build admin 2>&1 | Select-String -Pattern "Built|Step|ERROR" | Select-Object -First 20
    Ok "Admin image built"

    Log "Restarting admin container..."
    docker stop cafecash-admin 2>&1 | Out-Null
    docker rm   cafecash-admin 2>&1 | Out-Null
    docker compose create admin
    docker compose start  admin

    Log "Waiting for admin to be ready..."
    $ready = $false
    for ($i = 1; $i -le 15; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing `
                -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction SilentlyContinue
            if ($r.StatusCode -in 200, 307) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if ($ready) {
        Ok "Admin is up → http://${AdminIp}:3001"
    } else {
        Warn "Admin health check timed out — check: docker logs cafecash-admin"
    }

    Log "Last 3 admin log lines:"
    docker logs cafecash-admin 2>&1 | Select-Object -Last 3
}

# ── Tablet APK build ──────────────────────────────────────────────────────────
function Deploy-Apk {
    Header "Tablet APK build ($ApkType)"

    # Check ADB device
    $devices = adb devices 2>&1 | Where-Object { $_ -match "device$" } | Select-Object -First 1
    $deviceId = if ($devices) { ($devices -split "\s+")[0] } else { "" }

    if ($deviceId) {
        Ok "ADB device: $deviceId"
        $install = $true
    } else {
        Warn "No ADB device found — APK will be built but not installed"
        $install = $false
    }

    Log "Building $ApkType APK..."
    $start = Get-Date
    Push-Location "apps\tablet"
    bash scripts/build-debug.sh $ApkType 2>&1 | Select-String -Pattern "BUILD|✅|❌|[Ee]rror" | Select-Object -First 20
    Pop-Location
    $elapsed = [int]((Get-Date) - $start).TotalSeconds

    $apkPath = "apps\tablet\android\app\build\outputs\apk\$ApkType\app-$ApkType.apk"
    if (-not (Test-Path $apkPath)) {
        Fail "APK not found at $apkPath"
    }

    $size = [math]::Round((Get-Item $apkPath).Length / 1MB, 1)
    Ok "APK built in ${elapsed}s — $apkPath (${size}MB)"

    if ($install) {
        Log "Installing on device $deviceId..."
        $result = adb -s $deviceId install -r $apkPath 2>&1
        if ($result -match "Success") {
            Ok "APK installed on $deviceId"
        } else {
            Warn "Install failed: $result"
        }
    } else {
        Log "APK ready at: $(Resolve-Path $apkPath)"
    }
}

# ── Run tasks ─────────────────────────────────────────────────────────────────
$startTotal = Get-Date

switch ($Target.ToLower()) {
    "admin" { Deploy-Admin }
    "apk"   { Deploy-Apk }
    "all"   { Deploy-Admin; Deploy-Apk }
    default {
        Write-Host "Usage: .\deploy.ps1 [all|admin|apk] [debug|release]"
        exit 1
    }
}

$elapsed = [int]((Get-Date) - $startTotal).TotalSeconds
Header "Done in ${elapsed}s"
Write-Host ""
Write-Host "  Admin:  http://${AdminIp}:3001"  -ForegroundColor Green
Write-Host "  PB:     http://${AdminIp}:8091"  -ForegroundColor Green
if ($Target -in "all", "apk") {
    Write-Host "  APK:    apps\tablet\android\app\build\outputs\apk\$ApkType\app-$ApkType.apk" -ForegroundColor Green
}
Write-Host ""
