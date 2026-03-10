#!/usr/bin/env powershell
# seshat-stop.ps1 — Encerra a API Seshat e o Ollama
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File stop-seshat.ps1

$ErrorActionPreference = "SilentlyContinue"

# --- 1. Encerrar API (porta 3344) ---
Write-Host "[seshat] Encerrando Seshat API (porta 3344)..." -ForegroundColor Yellow
$apiConns = Get-NetTCPConnection -LocalPort 3344 -State Listen 2>$null
if ($apiConns) {
    $apiConns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        Stop-Process -Id $_ -Force
        Write-Host "  -> PID $_ encerrado." -ForegroundColor Green
    }
} else {
    Write-Host "  -> API nao estava rodando." -ForegroundColor Cyan
}

# --- 2. Encerrar Ollama ---
Write-Host "[seshat] Encerrando Ollama..." -ForegroundColor Yellow
$ollama = Get-Process -Name "ollama" 2>$null
if ($ollama) {
    $ollama | Stop-Process -Force
    Write-Host "  -> Ollama encerrado." -ForegroundColor Green
} else {
    Write-Host "  -> Ollama nao estava rodando." -ForegroundColor Cyan
}

Write-Host "[seshat] Ambiente limpo!" -ForegroundColor Green
