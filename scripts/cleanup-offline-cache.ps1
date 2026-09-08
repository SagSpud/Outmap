# Outmap 离线缓存全量净化与修复 PowerShell 脚本
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   Outmap 离线缓存深度净化与自愈修复工具 (PowerShell)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. 尝试结束正在运行的 Outmap 进程，防止占用缓存文件
try {
    Get-Process Outmap -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

# 2. 定位 offline-tiles 根目录
$targetDir = ""
$possibleDirs = @(
    (Join-Path $PSScriptRoot "..\offline-tiles"),
    (Join-Path (Get-Location) "offline-tiles"),
    (Join-Path (Get-Location) "..\offline-tiles"),
    (Join-Path (Get-Location) "dist\offline-tiles"),
    (Get-Location).Path,
    (Join-Path $env:USERPROFILE "Documents\Outmap\offline-tiles"),
    (Join-Path $env:USERPROFILE "Documents\offline-tiles")
)

foreach ($d in $possibleDirs) {
    if (Test-Path $d) {
        $dem = Join-Path $d "dem"
        $vec = Join-Path $d "vector"
        $sat = Join-Path $d "sat"
        $mani = Join-Path $d "offline_manifest.json"
        if ((Test-Path $dem) -or (Test-Path $vec) -or (Test-Path $sat) -or (Test-Path $mani)) {
            $targetDir = (Resolve-Path $d).Path
            break
        }
    }
}

if (-not $targetDir) {
    foreach ($d in $possibleDirs) {
        if (Test-Path $d) {
            $targetDir = (Resolve-Path $d).Path
            break
        }
    }
}

if (-not $targetDir) {
    $targetDir = (Join-Path (Get-Location) "offline-tiles")
}

Write-Host "[目标目录]: $targetDir" -ForegroundColor Yellow

$deletedSat = 0
$deletedForeign = 0
$deletedCorrupt = 0
$freedBytes = 0

# 3. 清理旧版卫星切片 sat
$satPath = Join-Path $targetDir "sat"
if (Test-Path $satPath) {
    Write-Host "[1/4] 正在清理旧版卫星切片目录 (offline-tiles\sat)..." -ForegroundColor White
    $satFiles = Get-ChildItem -Path $satPath -Recurse -File -ErrorAction SilentlyContinue
    foreach ($f in $satFiles) {
        $freedBytes += $f.Length
        $deletedSat++
    }
    Remove-Item -Path $satPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "      ✓ 卫星切片已全部清空，清理 $deletedSat 块切片" -ForegroundColor Green
} else {
    Write-Host "[1/4] 未发现卫星切片目录，无需清理。" -ForegroundColor Gray
}

# 4. 中国全域 34 省级行政区与领海诸岛金字塔切片覆盖包围盒
$CHINA_TILES_BOXES = @(
  @(114.6, 119.8, 29.5, 34.8),
  @(113.4, 113.7, 22.0, 22.3),
  @(115.2, 117.7, 39.2, 41.3),
  @(105.1, 110.4, 28.0, 32.4),
  @(115.6, 120.9, 23.3, 28.5),
  @(92.0, 108.9, 32.3, 43.0),
  @(109.4, 117.5, 20.0, 25.7),
  @(104.2, 112.3, 20.7, 26.6),
  @(103.4, 109.8, 24.4, 29.4),
  @(108.4, 111.3, 18.0, 20.4),
  @(113.2, 120.0, 35.8, 42.8),
  @(121.0, 135.3, 43.2, 53.8),
  @(110.1, 116.8, 31.2, 36.6),
  @(108.1, 116.3, 28.8, 33.5),
  @(108.6, 114.4, 24.4, 30.3),
  @(121.4, 131.5, 40.6, 46.5),
  @(116.1, 122.1, 30.5, 35.3),
  @(113.3, 118.7, 24.3, 30.3),
  @(118.6, 126.0, 38.5, 43.7),
  @(97.0, 114.0, 37.4, 43.2),
  @(114.0, 126.5, 41.5, 53.5),
  @(105.0, 115.0, 41.0, 44.2),
  @(104.1, 107.9, 35.0, 39.6),
  @(89.2, 103.3, 31.4, 39.5),
  @(114.6, 122.9, 34.1, 38.6),
  @(110.0, 114.7, 34.4, 40.9),
  @(105.3, 111.4, 31.5, 39.8),
  @(120.6, 122.4, 30.5, 32.1),
  @(97.1, 108.7, 25.8, 34.5),
  @(119.5, 124.0, 21.5, 26.0),
  @(116.5, 118.3, 38.3, 40.5),
  @(78.2, 99.3, 26.6, 36.7),
  @(113.8, 114.5, 22.1, 22.6),
  @(73.3, 96.6, 34.1, 49.4),
  @(97.3, 106.4, 20.9, 29.4),
  @(117.8, 123.2, 26.8, 31.5),
  @(108.0, 124.0, 3.0, 20.0)
)

function Tile2Lon($x, $z) {
    return ($x / [Math]::Pow(2, $z)) * 360 - 180
}

function Tile2Lat($y, $z) {
    $n = [Math]::PI - (2 * [Math]::PI * $y) / [Math]::Pow(2, $z)
    return (180 / [Math]::PI) * [Math]::Atan(0.5 * ([Math]::Exp($n) - [Math]::Exp(-$n)))
}

function IsTileInChina($z, $x, $y) {
    $minLon = Tile2Lon $x $z
    $maxLon = Tile2Lon ($x + 1) $z
    $minLat = Tile2Lat ($y + 1) $z
    $maxLat = Tile2Lat $y $z
    $margin = 1.2

    foreach ($box in $CHINA_TILES_BOXES) {
        if (-not ($maxLon -lt ($box[0] - $margin) -or $minLon -gt ($box[1] + $margin) -or $maxLat -lt ($box[2] - $margin) -or $minLat -gt ($box[3] + $margin))) {
            return $true
        }
    }
    return $false
}

# 5. 扫描并清理外国高缩放瓦片与损坏空切片
Write-Host "[2/4] 正在扫描外国 L11+ 冗余切片与损坏文件..." -ForegroundColor White
foreach ($sub in @("vector", "dem")) {
    $subPath = Join-Path $targetDir $sub
    if (-not (Test-Path $subPath)) { continue }

    $allFiles = Get-ChildItem -Path $subPath -Recurse -File -ErrorAction SilentlyContinue
    foreach ($file in $allFiles) {
        if ($file.Length -le 20) {
            $freedBytes += $file.Length
            $deletedCorrupt++
            Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
            continue
        }

        # 检查缩放层级与坐标结构: .../z/x/y.ext
        $parts = $file.FullName.Substring($subPath.Length).Trim('\/').Split('\/')
        if ($parts.Length -ge 3) {
            $z = 0
            $x = 0
            $y = 0
            if ([int]::TryParse($parts[0], [ref]$z) -and [int]::TryParse($parts[1], [ref]$x)) {
                $yStr = $parts[2].Split('.')[0]
                if ([int]::TryParse($yStr, [ref]$y)) {
                    if ($z -ge 11 -and (-not (IsTileInChina $z $x $y))) {
                        $freedBytes += $file.Length
                        $deletedForeign++
                        Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    }
}

Write-Host "      ✓ 清理外国 L11+ 冗余切片: $deletedForeign 块" -ForegroundColor Green
Write-Host "      ✓ 清理损坏/空切片文件: $deletedCorrupt 块" -ForegroundColor Green

# 6. 清理 Chromium 磁盘缓存与 GPUCache
Write-Host "[3/4] 正在清理 Chromium 渲染引擎磁盘缓存 (消除残留 204 阻断记录)..." -ForegroundColor White
$appData = $env:APPDATA
if ($appData) {
    $cacheDirs = @(
        (Join-Path $appData "Outmap\Cache"),
        (Join-Path $appData "Outmap\GPUCache"),
        (Join-Path $appData "outmap\Cache"),
        (Join-Path $appData "outmap\GPUCache")
    )
    foreach ($cd in $cacheDirs) {
        if (Test-Path $cd) {
            Remove-Item -Path $cd -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "      ✓ Chromium 磁盘缓存已彻底净化" -ForegroundColor Green
}

# 7. 汇报统计
Write-Host "====================================================" -ForegroundColor Cyan
$mb = [Math]::Round($freedBytes / 1048576, 1)
Write-Host "[完成] 离线净化成功！" -ForegroundColor Green
Write-Host " - 清理卫星切片: $deletedSat 块"
Write-Host " - 清理外国高缩放切片: $deletedForeign 块"
Write-Host " - 修复损坏切片: $deletedCorrupt 块"
Write-Host " - 释放总存储空间: 约 $mb MB"
Write-Host "现在重新打开 Outmap 即可获得最佳无缝高程与路网浏览体验！" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan
