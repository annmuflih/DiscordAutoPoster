@echo off
title Discord Auto Poster
echo ===================================================
echo Discord Auto Poster Setup
echo ===================================================
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting Application...
echo Please open http://127.0.0.1:5000 in your browser.
python app.py
pause
