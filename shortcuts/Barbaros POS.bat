@echo off
title Barbaros POS - Iniciando...
cd /d C:\barbaros_pos
powershell -ExecutionPolicy Bypass -File switch-env.ps1 develop
pause
