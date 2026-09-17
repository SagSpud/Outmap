@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Outmap 离线瓦片一键转 PMTiles 单文件工具

echo ============================================================
echo   📦 Outmap 离线瓦片一键转 PMTiles 单文件归档工具
echo ============================================================
echo  说明:
echo   本工具会将本地下载的散列小瓦片 (dem / vector / contour)
echo   快速打包合并为单个 .pmtiles 大文件，大幅减少磁盘碎片并提升读取速度。
echo ============================================================
echo.

set "BASE_DIR=dist\offline-tiles"
if not exist "%BASE_DIR%" set "BASE_DIR=offline-tiles"

echo [1/3] 检查高程 DEM 瓦片...
if exist "%BASE_DIR%\dem" (
    echo 正在转换 DEM 瓦片到 %BASE_DIR%\archives\dem.pmtiles ...
    node .\scripts\convert-to-pmtiles.cjs "%BASE_DIR%\dem" "%BASE_DIR%\archives\dem.pmtiles" dem
) else (
    echo [跳过] 未找到 %BASE_DIR%\dem 目录
)

echo [2/3] 检查矢量底图 Vector 瓦片...
if exist "%BASE_DIR%\vector" (
    echo 正在转换 Vector 瓦片到 %BASE_DIR%\archives\vector.pmtiles ...
    node .\scripts\convert-to-pmtiles.cjs "%BASE_DIR%\vector" "%BASE_DIR%\archives\vector.pmtiles" vector
) else (
    echo [跳过] 未找到 %BASE_DIR%\vector 目录
)

echo [3/3] 检查等高线 Contour 瓦片...
if exist "%BASE_DIR%\contour" (
    echo 正在转换 Contour 瓦片到 %BASE_DIR%\archives\contour_metric-v1.pmtiles ...
    node .\scripts\convert-to-pmtiles.cjs "%BASE_DIR%\contour" "%BASE_DIR%\archives\contour_metric-v1.pmtiles" contour
) else (
    echo [跳过] 未找到 %BASE_DIR%\contour 目录
)

echo.
echo ============================================================
echo   🎉 转换完成！所有单文件已保存在: %BASE_DIR%\archives\
echo   Outmap 启动时将自动秒级挂载上述 .pmtiles 单文件。
echo   若需要将数据带到其他电脑，只需拷贝整个 archives 文件夹即可！
echo ============================================================
pause
