$StagingDir = "D:\BBDG_PROJECTS\BBDG_HWP_Editor\Release_Temp"
if (-not (Test-Path $StagingDir)) {
    New-Item -ItemType Directory -Force -Path $StagingDir
}

# 구체적으로 ko-KR 버전을 찾음
$msi = Get-ChildItem -Path "src-tauri\target\release\bundle\msi\*ko-KR.msi" | Select-Object -First 1
if ($msi) {
    Copy-Item -Path $msi.FullName -Destination "$StagingDir\BBDG_HWP_Editor_Installer_2026.04.17.V.1.0.0.msi" -Force
    Write-Host "Copied MSI: $($msi.Name)"
} else {
    Write-Error "ko-KR MSI not found!"
}

$nsis = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis\*.exe" | Select-Object -First 1
if ($nsis) {
    Copy-Item -Path $nsis.FullName -Destination "$StagingDir\BBDG_HWP_Editor_Setup_2026.04.17.V.1.0.0.exe" -Force
    Write-Host "Copied Setup: $($nsis.Name)"
}

$portable = "src-tauri\target\release\rhwp-studio.exe"
if (Test-Path $portable) {
    Copy-Item -Path $portable -Destination "$StagingDir\BBDG_HWP_Editor_Portable_2026.04.17.V.1.0.0.exe" -Force
    Write-Host "Copied Portable"
}
