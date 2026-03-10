#!/usr/bin/env powershell
# seshat-start.ps1 — Inicializa a API Seshat e o Ollama em background
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File start-seshat.ps1

$ErrorActionPreference = "SilentlyContinue"
# Pega o caminho dinamico de onde este script está localizado, pra funcionar mudando nome da pasta raiz
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WatchdogScript = "$RootDir\watchdog-seshat.ps1"
$LogFile = "$RootDir\startup.log"
$LogErr = "$RootDir\startup.err.log"
$WdLog = "$RootDir\watchdog.log"
$DashboardPath = "$RootDir\dashboard\index.html"

# --- 1. Ollama (porta 11434) ---
$ollamaRunning = Get-NetTCPConnection -LocalPort 11434 -State Listen 2>$null
if ($ollamaRunning) {
    Write-Host "[seshat] Ollama ja esta em execucao." -ForegroundColor Cyan
}
else {
    Write-Host "[seshat] Iniciando Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
}

# --- 2. Watchdog + API (porta 3344) ---
$apiRunning = Get-NetTCPConnection -LocalPort 3344 -State Listen 2>$null
if ($apiRunning) {
    Write-Host "[seshat] API ja esta online na porta 3344. Pulando." -ForegroundColor Cyan
}
else {
    Write-Host "[seshat] Iniciando Seshat API com watchdog de auto-reinicio..." -ForegroundColor Yellow
    "" | Out-File -FilePath $LogFile  -Encoding utf8
    "" | Out-File -FilePath $LogErr   -Encoding utf8
    "" | Out-File -FilePath $WdLog    -Encoding utf8

    # Lanca o watchdog em background (ele e responsavel por iniciar e manter a API)
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$WatchdogScript`"" `
        -WindowStyle Hidden
}

# --- 3. Aguardar API ficar pronta (retry por 30s — watchdog pode levar alguns segundos) ---
Write-Host "[seshat] Aguardando API ficar disponivel..." -ForegroundColor Yellow
$apiReady = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3344/health" `
            -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $apiReady = $true
            break
        }
    }
    catch {}
    Write-Host "  ... tentativa $i/30" -ForegroundColor DarkGray
}

if ($apiReady) {
    Write-Host "[seshat] API pronta! Abrindo Dashboard..." -ForegroundColor Green
    Start-Process $DashboardPath
    Write-Host "[seshat] Pronto! Watchdog ativo - a API sera reiniciada automaticamente em caso de crash." -ForegroundColor Green
}
else {
    Write-Host "[seshat] AVISO: API nao respondeu em 30s. Verifique logs:" -ForegroundColor Red
    Write-Host "  API log:      $LogFile" -ForegroundColor DarkGray
    Write-Host "  Watchdog log: $WdLog"  -ForegroundColor DarkGray
    Get-Content $LogFile -Tail 10
}
