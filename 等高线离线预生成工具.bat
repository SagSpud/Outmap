@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Outmap 等高线离线预生成独立工具

set "EXE=Outmap.exe"
if not exist "%EXE%" (
    if exist "dist\Outmap\Outmap.exe" set "EXE=dist\Outmap\Outmap.exe"
)

if not exist "%EXE%" (
    echo ============================================================
    echo [错误] 未在当前目录下找到 Outmap.exe！
    echo 请确保本脚本放置在 Outmap 软件目录内（与 Outmap.exe 同级）。
    echo ============================================================
    pause
    exit /b 1
)

echo ============================================================
echo   🏔️  Outmap 等高线离线预生成独立工具
echo ============================================================
echo  说明:
echo   1. 本工具直接使用 Outmap 内置渲染计算引擎，无需安装 Node.js 环境；
echo   2. 直接读取本地现有 DEM 高程目录，离线生成等高线 PMTiles 单文件；
echo   3. 生成后存入 offline-tiles\archives 目录，Outmap 启动瞬间秒开；
echo   4. 若本地 DEM 完整则完全无需联网；若边缘有缺失可选开启在线智能补充。
echo ============================================================
echo.

set "DEFAULT_DEM=offline-tiles\dem"
if not exist "%DEFAULT_DEM%" (
    if exist "dist\offline-tiles\dem" set "DEFAULT_DEM=dist\offline-tiles\dem"
)

set /p DEM_DIR="[1/3] 请输入 DEM 文件夹路径 (直接回车默认: %DEFAULT_DEM%): "
if "%DEM_DIR%"=="" set "DEM_DIR=%DEFAULT_DEM%"

set /p LEVELS="[2/3] 请输入生成层级范围 (直接回车默认: 6-12): "
if "%LEVELS%"=="" set "LEVELS=6-12"

set /p FETCH_ANS="[3/3] 若遇到缺失 DEM 是否联网自动补充下载? (Y/N, 直接回车默认 N 纯离线): "

set "FETCH_FLAG="
if /i "%FETCH_ANS%"=="Y" (
    set "FETCH_FLAG=--fetch-missing"
    echo [提示] 已开启在线智能补充模式。
) else (
    echo [提示] 已采用纯本地离线模式 (海平面平滑边缘垫底)。
)

echo.
echo ============================================================
echo 正在启动 Outmap 内置 Chromium 多线程矢量计算引擎...
echo （若弹出进度浮窗请勿关闭，生成完毕后将自动保存并退出）
echo ============================================================
echo.

start /wait "" "%EXE%" --generate-contours --dem "%DEM_DIR%" --levels "%LEVELS%" %FETCH_FLAG%

echo.
echo ============================================================
echo 处理完毕。等高线单文件已保存至 archives\ 目录下。
echo 按任意键退出窗口...
echo ============================================================
pause >nul
