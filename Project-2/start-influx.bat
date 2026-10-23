@echo off
title FitTrack InfluxDB Server
echo Starting native InfluxDB for FitTrack...
node "%~dp0tools\start-influx.js"
pause
