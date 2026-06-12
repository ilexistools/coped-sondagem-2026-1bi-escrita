@echo off
echo Iniciando servidor...
start "" http://localhost:8080
python -m http.server 8080
