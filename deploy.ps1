# deploy.ps1 - Auto deploy Undead Kingdom ke Vercel
# Jalankan: klik kanan -> Run with PowerShell
# ATAU di terminal: .\deploy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UNDEAD KINGDOM - AUTO DEPLOY VERCEL  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Pastikan vercel CLI sudah install
Write-Host "[1/4] Cek Vercel CLI..." -ForegroundColor Yellow
$vercelPath = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelPath) {
    Write-Host "  Vercel CLI belum ada, install dulu..." -ForegroundColor Red
    npm install -g vercel
    Write-Host "  Vercel CLI berhasil diinstall!" -ForegroundColor Green
} else {
    Write-Host "  Vercel CLI sudah ada: $($vercelPath.Source)" -ForegroundColor Green
}

# 2. Pastikan vercel.json ada dan benar
Write-Host ""
Write-Host "[2/4] Setup vercel.json..." -ForegroundColor Yellow
$vercelJson = @'
{
  "outputDirectory": ".",
  "buildCommand": "",
  "installCommand": "",
  "headers": [
    {
      "source": "/public/models/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/src/(.*).js",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }]
    },
    {
      "source": "/public/icons/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800" }]
    }
  ]
}
'@
Set-Content -Path "vercel.json" -Value $vercelJson -Encoding ASCII
Write-Host "  vercel.json siap!" -ForegroundColor Green

# 3. Cek login vercel
Write-Host ""
Write-Host "[3/4] Cek login Vercel..." -ForegroundColor Yellow
$whoami = vercel whoami 2>&1
if ($whoami -match "Error" -or $whoami -match "not logged") {
    Write-Host "  Belum login, buka browser untuk login..." -ForegroundColor Red
    vercel login
} else {
    Write-Host "  Sudah login sebagai: $whoami" -ForegroundColor Green
}

# 4. Deploy
Write-Host ""
Write-Host "[4/4] Deploy ke Vercel..." -ForegroundColor Yellow
Write-Host "  Upload sedang berjalan (sabar, map.glb 31MB)..." -ForegroundColor Gray
Write-Host ""

# Jawab semua prompt vercel secara otomatis
$env:VERCEL_ORG_ID = ""
$env:VERCEL_PROJECT_ID = ""

# Deploy dengan flag yang skip semua prompt
vercel --prod --yes --name undead-kingdom

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY SELESAI!                      " -ForegroundColor Green
Write-Host "  Buka URL di atas di browser kamu     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
