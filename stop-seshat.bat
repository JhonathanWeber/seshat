@echo off
setlocal

:: ============================================================
:: seshat-stop — Delegating to unified PowerShell script
:: ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-seshat.ps1"

endlocal
