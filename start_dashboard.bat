@echo off
echo Starting local Python web server on port 5500...
echo Keep this window open and visit http://localhost:5500 in your browser!
python -m http.server 5500
pause
