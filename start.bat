@echo off
title AI Compliance Copilot - Launcher
color 0A

echo.
echo  ============================================================
echo   AI Compliance Copilot - Bank of India
echo   CDAC Mumbai PGCP-BDA Feb 2026
echo  ============================================================
echo.

:: ── Step 0: Kill any stale processes on our ports ────────────
echo  [0/3] Clearing old processes on ports 8001 and 5173...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8001 " ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo  [OK] Ports cleared.

:: ── Step 1: Check Ollama ──────────────────────────────────────
echo.
echo  [1/3] Checking Ollama...
ollama list >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Ollama not found in PATH. Please install Ollama first.
    echo      Download: https://ollama.com/download
    pause
    exit /b 1
)

:: Start Ollama serve in background (safe if already running)
start /b "" ollama serve >nul 2>&1
timeout /t 2 /nobreak >nul
echo  [OK] Ollama is running  (llama3.1:latest)

:: ── Step 2: Start FastAPI Backend ────────────────────────────
echo.
echo  [2/3] Starting FastAPI Backend on port 8001...
start "FastAPI Backend" cmd /k "cd /d %~dp0 && python src/api.py"
timeout /t 4 /nobreak >nul
echo  [OK] Backend starting at http://localhost:8001

:: ── Step 3: Start React Frontend ─────────────────────────────
echo.
echo  [3/3] Starting React Frontend...
start "React Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 4 /nobreak >nul
echo  [OK] Frontend starting at http://localhost:5173

:: ── Step 4: Open Browser ─────────────────────────────────────
echo.
echo  Waiting 5 seconds for servers to be ready...
timeout /t 5 /nobreak >nul
start http://localhost:5173
echo  [OK] Browser opened!

echo.
echo  ============================================================
echo   All services started!
echo.
echo   React Frontend  ->  http://localhost:5173
echo   FastAPI Backend ->  http://localhost:8001
echo   API Docs        ->  http://localhost:8001/docs
echo.
echo   To STOP everything, just close the two terminal windows.
echo  ============================================================
echo.
pause
