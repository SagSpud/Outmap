@echo off
chcp 65001 >nul
title 山东 3D 户外地形沙盘
cd /d "%~dp0"
echo 正在启动 山东 3D 户外地形桌面应用...
call npm start
