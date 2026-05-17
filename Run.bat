@echo off
echo ========================================
echo    Carrot Fondelers - Local Server
echo ========================================
echo.

:: Try Python 3 first
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Python 3...
    python -m http.server 8080
    goto :end
)

:: Try Python (Python 2 fallback)
where py >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Python (py launcher)...
    py -m http.server 8080
    goto :end
)

:: Alternative: Try Python 3 explicitly
where python3 >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Python 3...
    python3 -m http.server 8080
    goto :end
)

echo.
echo [ERROR] Python not found!
echo Please install Python from https://python.org
echo Make sure to check "Add Python to PATH" during installation.
pause
exit /b 1

:end
echo.
echo Server running at: http://localhost:8080
echo.
echo Press Ctrl+C to stop the server.
pause