@echo off
REM Quick start script for the defect detection application

echo.
echo ========================================
echo 缺陷检测应用 - 快速启动
echo ========================================
echo.

REM Check if Flask is already running
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo ✅ Flask backend appears to be running on port 5000
) else (
    echo ⚠️  Flask backend is not running
    echo.
    echo Starting Flask backend...
    start cmd /k "cd /d %~dp0 && python app.py"
    timeout /t 2
)

REM Check if npm dev is running
netstat -ano | findstr :5173 >nul
if %errorlevel% equ 0 (
    echo ✅ Frontend appears to be running on port 5173
) else (
    echo ⚠️  Frontend is not running
    echo.
    echo Starting React frontend...
    start cmd /k "cd /d %~dp0 && npm run dev"
    timeout /t 3
)

echo.
echo ========================================
echo Application should be ready!
echo.
echo 🌐 Open your browser and go to:
echo    http://localhost:5173
echo.
echo 📝 Backend logs: Check the backend terminal
echo 🐛 Frontend logs: Check the frontend terminal
echo.
echo ========================================
echo.
pause
