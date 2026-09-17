@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Outmap 离线瓦片一键转 PMTiles 单文件工具

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
echo   📦 Outmap 离线瓦片一键转 PMTiles 单文件归档工具
echo ============================================================
echo  说明:
echo   本工具调用 Outmap 内置引擎，将本地下载的散列小瓦片 (dem / vector / contour)
echo   快速合并为单个 .pmtiles 大文件，彻底减少文件碎片并大幅提升读取速度。
echo   (无需安装 Node.js，内置全套离线引擎)
echo ============================================================
echo.
echo 正在执行瓦片合并打包，请稍候...
echo.

"%EXE%" --convert-pmtiles

echo.
echo ============================================================
echo   🎉 处理完成！所有单文件已保存在 archives\ 目录下。
echo   Outmap 启动时会自动秒级识别挂载。
echo ============================================================
pause
