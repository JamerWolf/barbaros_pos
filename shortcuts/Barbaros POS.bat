@echo off
title Barbaros POS - Produccion...
cd /d C:\barbaros_pos
powershell -ExecutionPolicy Bypass -File switch-env.ps1 production
pause
