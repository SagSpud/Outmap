Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path build, src | Out-Null
$srcPath = "C:\Users\cuihm\.gemini\antigravity\brain\f553f918-6da1-49f1-82b6-9b5db4a8e02c\outmap_logo_1788751155587.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# 256x256 PNG
$png256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($png256)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()

$png256.Save("build/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png256.Save("src/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @(256, 128, 64, 48, 32, 16)
$pngList = @()

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g2 = [System.Drawing.Graphics]::FromImage($bmp)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.DrawImage($img, 0, 0, $s, $s)
    $g2.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
    $pngList += ,@($s, $bytes)
}

$img.Dispose()

$fs = [System.IO.File]::Create("build/icon.ico")
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$pngList.Count)

$offset = 6 + ($pngList.Count * 16)

foreach ($item in $pngList) {
    $s = $item[0]
    $bytes = $item[1]
    $w = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $h = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $bw.Write($w)
    $bw.Write($h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $bytes.Length
}

foreach ($item in $pngList) {
    $bw.Write($item[1])
}

$bw.Dispose()
$fs.Dispose()
Write-Host "Success: build/icon.ico created: " (Get-Item "build/icon.ico").Length "bytes"
