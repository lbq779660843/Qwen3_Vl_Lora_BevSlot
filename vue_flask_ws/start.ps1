# 快速启动脚本 - PowerShell 版本

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "缺陷检测应用 - 快速启动" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backendPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 检查 Flask 是否运行
$flaskRunning = netstat -ano 2>$null | Select-String ":5000.*LISTENING" | $null -ne $_

if ($flaskRunning) {
    Write-Host "✅ Flask backend appears to be running on port 5000" -ForegroundColor Green
} else {
    Write-Host "⚠️  Flask backend is not running" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "启动 Flask backend..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit -Command cd '$backendPath'; python app.py"
    Start-Sleep -Seconds 2
}

# 检查前端是否运行
$frontendRunning = netstat -ano 2>$null | Select-String ":5173.*LISTENING" | $null -ne $_

if ($frontendRunning) {
    Write-Host "✅ Frontend appears to be running on port 5173" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend is not running" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "启动 React frontend..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit -Command cd '$backendPath'; npm run dev"
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "应用应该已准备好!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 打开浏览器访问:" -ForegroundColor Cyan
Write-Host "   http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 后端日志: 查看后端终端窗口" -ForegroundColor Cyan
Write-Host "🐛 前端日志: 查看前端终端窗口" -ForegroundColor Cyan
Write-Host "🔍 调试面板: 在 Web 界面中展开" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 暂停以便查看消息
Read-Host "按 Enter 键继续..."
