@echo off
title DepositRegistry Security Monitor
color 0A
echo.
echo  ============================================
echo   DepositRegistry 24/7 Security Watchdog
echo  ============================================
echo.
echo  Starting monitor... (Press Ctrl+C to stop)
echo  Logs saved to: monitor.log
echo.
cd /d "%~dp0"
node scripts/monitor.mjs
pause
