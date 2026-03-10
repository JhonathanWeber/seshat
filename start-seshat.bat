@echo off
setlocal

:: ============================================================
:: seshat-start — Delegating to unified PowerShell script
:: ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-seshat.ps1"

endlocal
