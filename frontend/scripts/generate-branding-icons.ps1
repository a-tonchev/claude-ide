# Regenerate native vector/PNG app icons from branding.json on Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$frontendRoot = Split-Path $PSScriptRoot -Parent
$brands = Get-Content (Join-Path $frontendRoot 'branding.json') -Raw | ConvertFrom-Json
$outputDirectory = Join-Path $frontendRoot 'public/branding'
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
foreach ($brand in $brands.PSObject.Properties) {
    $color = $brand.Value.color
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="' + $color + '"/><path d="M17.2 3H6.8l-5.2 9 5.2 9h10.4l5.2-9zm-1.15 16h-8.1l-4.04-7 4.04-7h8.09l4.04 7z" fill="white"/></svg>'
    [IO.File]::WriteAllText((Join-Path $outputDirectory ($brand.Name + '.svg')), $svg + "`n")
    foreach ($size in @(32, 192, 512)) {
        $bitmap = [Drawing.Bitmap]::new($size, $size)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $path = [Drawing.Drawing2D.GraphicsPath]::new()
        try {
            $graphics.Clear([Drawing.ColorTranslator]::FromHtml($color))
            $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $scale = $size / 24.0
            $outer = [Drawing.PointF[]]@(
                [Drawing.PointF]::new(17.2*$scale,3*$scale), [Drawing.PointF]::new(6.8*$scale,3*$scale),
                [Drawing.PointF]::new(1.6*$scale,12*$scale), [Drawing.PointF]::new(6.8*$scale,21*$scale),
                [Drawing.PointF]::new(17.2*$scale,21*$scale), [Drawing.PointF]::new(22.4*$scale,12*$scale)
            )
            $inner = [Drawing.PointF[]]@(
                [Drawing.PointF]::new(16.05*$scale,19*$scale), [Drawing.PointF]::new(7.95*$scale,19*$scale),
                [Drawing.PointF]::new(3.91*$scale,12*$scale), [Drawing.PointF]::new(7.95*$scale,5*$scale),
                [Drawing.PointF]::new(16.04*$scale,5*$scale), [Drawing.PointF]::new(20.08*$scale,12*$scale)
            )
            $path.AddPolygon($outer)
            $path.AddPolygon($inner)
            $graphics.FillPath([Drawing.Brushes]::White, $path)
            $bitmap.Save((Join-Path $outputDirectory ($brand.Name + '-' + $size + '.png')), [Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $path.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
}
