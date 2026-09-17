@echo off
chcp 65001 >nul
title Outmap 全局环境与数据彻底清理工具
cd /d "%~dp0"

echo ============================================================
echo   🧹 Outmap 全局环境与旧数据彻底清理卸载工具 (增强版)
echo ============================================================
echo  本工具将帮助你安全、彻底地清除电脑上所有与 Outmap 相关的:
echo   1. 正在运行的 Outmap 进程、Electron 与辅助计算线程
echo   2. 用户配置文件、缓存、浏览数据 (AppData\Roaming\Local)
echo   3. 自动更新残留缓存 (outmap-updater)
echo   4. 安装版主程序 与 绿色便携版目录 (Documents\Outmap 等)
echo   5. 桌面与开始菜单快捷方式
echo   6. 临时文件与解压缓存目录 (Temp)
echo   7. 本地离线瓦片与三维地形数据 (Documents\offline-tiles 等)
echo ============================================================
echo.
echo [警告] 此操作将彻底清空当前电脑上的 Outmap 数据，无法撤销！
set /p CONFIRM="是否确认立即开始彻底清理? (输入 Y 确认执行，其他任意键取消): "
if /i not "%CONFIRM%"=="Y" (
    echo [已取消] 未作任何修改，按任意键退出...
    pause >nul
    exit /b 0
)

echo.
echo [1/7] 正在终止可能在后台运行的 Outmap 相关进程...
taskkill /F /IM Outmap.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*outmap*' -or $_.CommandLine -like '*等高线离线预生成工具*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo   - 进程已全部安全退出。

echo.
echo [2/7] 正在清理用户数据与缓存目录...
if exist "%APPDATA%\Outmap" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%APPDATA%\Outmap' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已清除: %APPDATA%\Outmap
)
if exist "%LOCALAPPDATA%\Outmap" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%LOCALAPPDATA%\Outmap' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已清除: %LOCALAPPDATA%\Outmap
)
if exist "%LOCALAPPDATA%\outmap-updater" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%LOCALAPPDATA%\outmap-updater' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已清除: %LOCALAPPDATA%\outmap-updater
)

echo.
echo [3/7] 正在检查并清理程序本体 (安装版与绿色便携版)...
if exist "%LOCALAPPDATA%\Programs\Outmap" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%LOCALAPPDATA%\Programs\Outmap' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已清除安装目录: %LOCALAPPDATA%\Programs\Outmap
)
if exist "%USERPROFILE%\Documents\Outmap" (
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%USERPROFILE%\Documents\Outmap' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已清除绿色便携版目录: %USERPROFILE%\Documents\Outmap
)

echo.
echo [4/7] 正在清理快捷方式与启动项...
if exist "%USERPROFILE%\Desktop\Outmap.lnk" del /F /Q "%USERPROFILE%\Desktop\Outmap.lnk" >nul 2>&1
if exist "%PUBLIC%\Desktop\Outmap.lnk" del /F /Q "%PUBLIC%\Desktop\Outmap.lnk" >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Outmap.lnk" del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Outmap.lnk" >nul 2>&1
echo   - 快捷方式清理完毕。

echo.
echo [5/7] 正在清理临时文件与解压缓存目录...
powershell -NoProfile -Command "
Get-ChildItem -Path '%TEMP%' -Filter '*outmap*' -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path '%TEMP%' -Filter 'Outmap3D' -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path '%TEMP%' -Directory -Filter '3I*' -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'Outmap.exe') } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
" >nul 2>&1
echo   - 临时文件与缓存目录清理完毕。

echo.
echo [6/7] 正在检查并清理离线数据文件夹 (offline-tiles)...
set "FOUND_TILES=0"

if exist "%USERPROFILE%\Documents\offline-tiles" (
    set "FOUND_TILES=1"
    echo   - 正在清理文档目录下的 offline-tiles ...
    powershell -NoProfile -Command "Remove-Item -LiteralPath '%USERPROFILE%\Documents\offline-tiles' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已删除文档目录下的 offline-tiles
)

if exist "offline-tiles" (
    set "FOUND_TILES=1"
    echo   - 正在清理当前目录下的 offline-tiles ...
    powershell -NoProfile -Command "Remove-Item -LiteralPath 'offline-tiles' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已删除当前目录下的 offline-tiles
)

if exist "..\offline-tiles" (
    set "FOUND_TILES=1"
    echo   - 正在清理上级同级目录下的 ..\offline-tiles ...
    powershell -NoProfile -Command "Remove-Item -LiteralPath '..\offline-tiles' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已删除上级同级目录下的 ..\offline-tiles
)

if exist "dist\offline-tiles" (
    set "FOUND_TILES=1"
    echo   - 正在清理 dist\offline-tiles ...
    powershell -NoProfile -Command "Remove-Item -LiteralPath 'dist\offline-tiles' -Recurse -Force -ErrorAction SilentlyContinue"
    echo   - 已删除 dist\offline-tiles
)

if "%FOUND_TILES%"=="0" (
    echo   - 未在常用或当前目录下发现 offline-tiles。
)

echo.
echo [7/7] 全局清理校验中...
echo ============================================================
echo   🎉 全局彻底清理完成！
echo ============================================================
echo   当前电脑上的 Outmap 所有程序、绿色版、缓存与瓦片已全部清除。
echo   按任意键退出窗口...
echo ============================================================
pause >nul
