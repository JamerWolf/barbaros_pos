@echo off
REM build-installer.bat — Build the Barbaros POS Inno Setup installer
REM Run from repo root: installer\build-installer.bat

setlocal enabledelayedexpansion

echo === Barbaros POS — Building Installer ===

REM --- Step 1: Run production build first ---
echo.
echo [1/3] Running production build...
powershell -ExecutionPolicy Bypass -File "%~dp0build-production.ps1"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Production build failed
    exit /b 1
)

REM --- Step 2: Check Inno Setup is installed ---
echo.
echo [2/3] Checking Inno Setup...
set "ISCC="
where iscc.exe >nul 2>&1 && set "ISCC=iscc.exe"
if "!ISCC!"=="" (
    if exist "D:\Programas\Inno Setup 6\ISCC.exe" (
        set "ISCC=D:\Programas\Inno Setup 6\ISCC.exe"
    ) else if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
        set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    ) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
        set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
    )
)
if "!ISCC!"=="" (
    echo ERROR: Inno Setup not found
    echo Install from: https://jrsoftware.org/isinfo.php
    exit /b 1
)
echo Found: !ISCC!

REM --- Step 3: Compile installer ---
echo.
echo [3/3] Compiling installer...
"!ISCC!" "%~dp0barbaros-pos.iss"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Inno Setup compilation failed
    exit /b 1
)

echo.
echo === Installer built successfully ===
echo Output: releases\barbaros-setup.exe
