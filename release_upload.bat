@echo off
set GH_PATH=D:\Downloads\rhwp-extracted\rhwp-main\gh_cli\bin\gh.exe
set REPO=seonzzang/BBDG-HWP-Editor
set TAG=v1.0.0

"%GH_PATH%" release upload %TAG% "D:\BBDG_PROJECTS\BBDG_HWP_Editor\Release_Temp\BBDG_HWP_Editor_Installer_2026.04.17.V.1.0.0.msi" "D:\BBDG_PROJECTS\BBDG_HWP_Editor\Release_Temp\BBDG_HWP_Editor_Setup_2026.04.17.V.1.0.0.exe" "D:\BBDG_PROJECTS\BBDG_HWP_Editor\Release_Temp\BBDG_HWP_Editor_Portable_2026.04.17.V.1.0.0.exe" --repo %REPO% --clobber
