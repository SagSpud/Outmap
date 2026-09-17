@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Outmap 等高线离线预生成独立工具

echo ============================================================
echo   🏔️  Outmap 等高线离线预生成独立工具
echo ============================================================
echo  说明:
echo   1. 本工具可直接读取本地现有 DEM 高程目录，极速离线生成等高线 PMTiles 单文件；
echo   2. 生成后直接存入 dist\offline-tiles\archives 目录，Outmap 启动瞬间秒开；
echo   3. 若本地 DEM 完整则完全无需联网；若边缘有缺失可选开启在线智能补充。
echo ============================================================
echo.

set "DEFAULT_DEM=dist\offline-tiles\dem"
set "DEFAULT_OUTPUT=dist\offline-tiles\archives\contour_metric-v1.pmtiles"
set "DEFAULT_LEVELS=6-12"

set /p DEM_DIR="[1/3] 请输入 DEM 文件夹路径 (直接回车默认: %DEFAULT_DEM%): "
if "%DEM_DIR%"=="" set "DEM_DIR=%DEFAULT_DEM%"

set /p LEVELS="[2/3] 请输入生成层级范围 (直接回车默认: %DEFAULT_LEVELS%): "
if "%LEVELS%"=="" set "LEVELS=%DEFAULT_LEVELS%"

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
echo 正在启动 Chromium 多线程矢量计算引擎...
echo ============================================================
echo.

node ./node_modules/electron/cli.js ./scripts/generate-contour-tool.cjs --dem "%DEM_DIR%" --output "%DEFAULT_OUTPUT%" --levels "%LEVELS%" %FETCH_FLAG%

echo.
echo ============================================================
echo 处理完毕。按任意键退出窗口...
echo ============================================================
pause >nul
