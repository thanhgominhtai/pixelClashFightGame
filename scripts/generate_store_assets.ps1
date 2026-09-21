Add-Type -AssemblyName System.Drawing

$storeDir = Join-Path $PSScriptRoot "..\public\assets\store"
if (-not (Test-Path $storeDir)) {
    New-Item -ItemType Directory -Path $storeDir -Force | Out-Null
}

$bgForest = Join-Path $PSScriptRoot "..\backgound_map\Free Pixel Art Forest\Free Pixel Art Forest\Preview\Background.png"
$buckPort = Join-Path $PSScriptRoot "..\public\generated\characters\buck\portrait.png"
$roguePort = Join-Path $PSScriptRoot "..\public\generated\characters\rogue\portrait.png"
$dragonPort = Join-Path $PSScriptRoot "..\public\generated\characters\dragon_knight\portrait.png"

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

# 1. ICON (512x512)
$iconBmp = New-Object System.Drawing.Bitmap 512, 512
$gIcon = [System.Drawing.Graphics]::FromImage($iconBmp)
$gIcon.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gIcon.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background dark slate
$brushBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 24, 39))
$gIcon.FillRectangle($brushBg, 0, 0, 512, 512)
$brushBg.Dispose()

# Draw character portrait in center
if (Test-Path $buckPort) {
    $imgBuck = [System.Drawing.Image]::FromFile($buckPort)
    $gIcon.DrawImage($imgBuck, 96, 50, 320, 320)
    $imgBuck.Dispose()
}

# Red accent bottom banner
$bannerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 225, 29, 72))
$gIcon.FillRectangle($bannerBrush, 0, 380, 512, 80)
$bannerBrush.Dispose()

$fontIcon = New-Object System.Drawing.Font("Arial", [float]30, [System.Drawing.FontStyle]::Bold)
$textWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$gIcon.DrawString("PIXEL CLASH", $fontIcon, $textWhite, (New-Object System.Drawing.RectangleF 0, 380, 512, 80), $sf)
$fontIcon.Dispose()

$iconPath = Join-Path $storeDir "icon-512.png"
$iconBmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gIcon.Dispose()
$iconBmp.Dispose()
Write-Host "Generated: $iconPath (512x512)"

# 2. COVER (1280x720)
$coverBmp = New-Object System.Drawing.Bitmap 1280, 720
$gCover = [System.Drawing.Graphics]::FromImage($coverBmp)
$gCover.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gCover.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gCover.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

if (Test-Path $bgForest) {
    $imgBg = [System.Drawing.Image]::FromFile($bgForest)
    $gCover.DrawImage($imgBg, 0, 0, 1280, 720)
    $imgBg.Dispose()
} else {
    $brushCover = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))
    $gCover.FillRectangle($brushCover, 0, 0, 1280, 720)
    $brushCover.Dispose()
}

# Dim overlay
$darkOverlay = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 15, 23, 42))
$gCover.FillRectangle($darkOverlay, 0, 0, 1280, 720)
$darkOverlay.Dispose()

# Draw two fighters facing off
if (Test-Path $buckPort) {
    $imgBuck = [System.Drawing.Image]::FromFile($buckPort)
    $gCover.DrawImage($imgBuck, 160, 200, 360, 360)
    $imgBuck.Dispose()
}
if (Test-Path $dragonPort) {
    $imgDragon = [System.Drawing.Image]::FromFile($dragonPort)
    $gCover.DrawImage($imgDragon, 760, 200, 360, 360)
    $imgDragon.Dispose()
}

# VS badge
$vsFont = New-Object System.Drawing.Font("Arial", [float]48, [System.Drawing.FontStyle]::Bold)
$vsBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
$gCover.DrawString("VS", $vsFont, $vsBrush, (New-Object System.Drawing.RectangleF 0, 330, 1280, 80), $sf)
$vsFont.Dispose()
$vsBrush.Dispose()

# Title banner
$topBanner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 15, 23, 42))
$gCover.FillRectangle($topBanner, 0, 40, 1280, 120)
$topBanner.Dispose()

$titleFont = New-Object System.Drawing.Font("Arial", [float]44, [System.Drawing.FontStyle]::Bold)
$gCover.DrawString("PIXEL CLASH DOJO", $titleFont, $textWhite, (New-Object System.Drawing.RectangleF 0, 50, 1280, 60), $sf)
$titleFont.Dispose()

$subFont = New-Object System.Drawing.Font("Arial", [float]18, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
$gCover.DrawString("2D Pixel Fighting Arena - 60 FPS Authoritative Combat", $subFont, $subBrush, (New-Object System.Drawing.RectangleF 0, 110, 1280, 40), $sf)
$subFont.Dispose()
$subBrush.Dispose()

$coverPath = Join-Path $storeDir "cover-1280x720.png"
$coverBmp.Save($coverPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gCover.Dispose()
$coverBmp.Dispose()
Write-Host "Generated: $coverPath (1280x720)"

# 3. SCREENSHOT (1280x720)
$shotBmp = New-Object System.Drawing.Bitmap 1280, 720
$gShot = [System.Drawing.Graphics]::FromImage($shotBmp)
$gShot.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gShot.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gShot.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

if (Test-Path $bgForest) {
    $imgBg = [System.Drawing.Image]::FromFile($bgForest)
    $gShot.DrawImage($imgBg, 0, 0, 1280, 720)
    $imgBg.Dispose()
}

# Ground plate
$groundBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 30, 41, 59))
$gShot.FillRectangle($groundBrush, 0, 580, 1280, 140)
$groundBrush.Dispose()

# Fighters
if (Test-Path $buckPort) {
    $imgBuck = [System.Drawing.Image]::FromFile($buckPort)
    $gShot.DrawImage($imgBuck, 260, 260, 320, 320)
    $imgBuck.Dispose()
}
if (Test-Path $roguePort) {
    $imgRogue = [System.Drawing.Image]::FromFile($roguePort)
    $gShot.DrawImage($imgRogue, 700, 260, 320, 320)
    $imgRogue.Dispose()
}

# HUD Bars
$p1BarBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 0, 0, 0))
$gShot.FillRectangle($p1BarBg, 60, 40, 450, 35)
$gShot.FillRectangle($p1BarBg, 770, 40, 450, 35)
$p1BarBg.Dispose()

$hpP1 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 34, 197, 94))
$gShot.FillRectangle($hpP1, 65, 43, 380, 29)
$hpP1.Dispose()

$hpP2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))
$gShot.FillRectangle($hpP2, 835, 43, 380, 29)
$hpP2.Dispose()

$hudFont = New-Object System.Drawing.Font("Arial", [float]15, [System.Drawing.FontStyle]::Bold)
$gShot.DrawString("BUCK BORRIS (P1)", $hudFont, $textWhite, [float]65, [float]15)
$gShot.DrawString("FANTASY ROGUE (P2)", $hudFont, $textWhite, [float]950, [float]15)
$hudFont.Dispose()

$timerFont = New-Object System.Drawing.Font("Arial", [float]36, [System.Drawing.FontStyle]::Bold)
$timerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 251, 191, 36))
$gShot.DrawString("99", $timerFont, $timerBrush, (New-Object System.Drawing.RectangleF 0, 25, 1280, 60), $sf)
$timerFont.Dispose()
$timerBrush.Dispose()

$shotPath = Join-Path $storeDir "screenshot-1.png"
$shotBmp.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gShot.Dispose()
$shotBmp.Dispose()
Write-Host "Generated: $shotPath (1280x720)"

$sf.Dispose()
$textWhite.Dispose()
