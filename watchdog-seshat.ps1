#!/usr/bin/env powershell
# watchdog-seshat.ps1 — Monitora e reinicia automaticamente a Seshat API
# Executado em background pelo start-seshat.ps1
# NAO execute manualmente — use start-seshat.ps1

param(
    [int]$MaxRestarts = 10,      # maximo de reinicializacoes antes de desistir
    [int]$CooldownSec = 5,       # espera entre tentativas (s)
    [int]$HealthInterval = 10       # intervalo de health check (s)
)

# Define o diretorio atual do script para suportar nomes dinamicos
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = "$RootDir\apps\tools-api"
$BunExe = "C:\Users\Jhon\.bun\bin\bun.exe"
$LogFile = "$RootDir\startup.log"
$LogErr = "$RootDir\startup.err.log"
$WdLog = "$RootDir\watchdog.log"
$HealthUrl = "http://localhost:3344/health"

function Write-WdLog {
    param([string]$Msg, [string]$Level = "INFO")
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $line = "[$ts] [$Level] $Msg"
    Add-Content -Path $WdLog -Value $line
    $color = if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARN") { "Yellow" } else { "Cyan" }
    Write-Host "[watchdog] $Msg" -ForegroundColor $color
}

function Start-Api {
    "" | Out-File -FilePath $LogFile -Encoding utf8 -Append
    "" | Out-File -FilePath $LogErr  -Encoding utf8 -Append
    $proc = Start-Process -FilePath $BunExe `
        -ArgumentList "src\index.ts" `
        -WorkingDirectory $ApiDir `
        -RedirectStandardOutput $LogFile `
        -RedirectStandardError $LogErr `
        -WindowStyle Hidden `
        -PassThru
    return $proc
}

function Test-ApiHealth {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return ($r.StatusCode -eq 200)
    }
    catch {
        return $false
    }
}

# --- Inicializa log do watchdog ---
Write-WdLog "Watchdog iniciado. MaxRestarts=$MaxRestarts, CooldownSec=$CooldownSec, HealthInterval=${HealthInterval}s"

$restarts = 0
$apiProc = $null

# --- Loop principal ---
while ($true) {

    # Inicia a API se nao estiver rodando
    if ($null -eq $apiProc -or $apiProc.HasExited) {

        if ($restarts -ge $MaxRestarts) {
            Write-WdLog "Limite de $MaxRestarts reinicializacoes atingido. Watchdog encerrando." "ERROR"
            break
        }

        if ($restarts -gt 0) {
            Write-WdLog "API encerrou inesperadamente (exit=$($apiProc.ExitCode)). Aguardando ${CooldownSec}s antes de reiniciar... (tentativa $restarts/$MaxRestarts)" "WARN"
            Start-Sleep -Seconds $CooldownSec
        }

        Write-WdLog "Iniciando API... (tentativa $($restarts + 1))"
        $apiProc = Start-Api
        $restarts++

        # Aguarda API ficar pronta (ate 30s)
        $ready = $false
        for ($i = 1; $i -le 30; $i++) {
            Start-Sleep -Seconds 1
            if (Test-ApiHealth) { $ready = $true; break }
        }

        if ($ready) {
            Write-WdLog "API pronta (PID=$($apiProc.Id)). Monitorando..."
            $restarts = 0   # reset contador apos subida bem-sucedida
        }
        else {
            Write-WdLog "API nao respondeu em 30s. Sera tentado novamente." "WARN"
            continue
        }
    }

    # Health check periodico
    Start-Sleep -Seconds $HealthInterval

    if (-not (Test-ApiHealth)) {
        Write-WdLog "Health check falhou. Verificando processo..." "WARN"
        # Da mais 5s de graca antes de considerar crash
        Start-Sleep -Seconds 5
        if (-not (Test-ApiHealth)) {
            Write-WdLog "API nao responde. Forcando reinicio..." "ERROR"
            if (-not $apiProc.HasExited) {
                Stop-Process -Id $apiProc.Id -Force -ErrorAction SilentlyContinue
            }
            $apiProc = $null
        }
    }
}

Write-WdLog "Watchdog encerrado."
