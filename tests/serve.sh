#!/bin/bash
# 테스트용 로컬 서버 (앱 8765, 부모 페이지 8766)
curl -s -o /dev/null http://127.0.0.1:8765/ || (cd /home/claude/tem-tree && nohup setsid python3 -m http.server 8765 >/dev/null 2>&1 &)
curl -s -o /dev/null http://127.0.0.1:8766/ || (cd "$(dirname "$0")/parent" && nohup setsid python3 -m http.server 8766 >/dev/null 2>&1 &)
sleep 1
node -e "const fs=require('fs');fs.writeFileSync('/home/claude/tem-tree/wrap.html','<!doctype html><html><head><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>'+fs.readFileSync('/home/claude/tem-tree/index.html','utf8')+'</body></html>')"
