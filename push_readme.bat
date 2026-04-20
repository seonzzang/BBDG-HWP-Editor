@echo off
chcp 65001 > nul
git add README.md
git commit -m "Update README with BBDG project details"
git push
