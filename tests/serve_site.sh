#!/bin/bash
# 설치형 앱 시험: 사이트 8770, 가짜 GitHub 8771
SP=/tmp/ttn-test; T="$(cd "$(dirname "$0")" && pwd)"; mkdir -p $SP
cd /home/claude/tem-tree && python3 tools/build_site.py . . $SP/site >/dev/null
curl -s -o /dev/null http://127.0.0.1:8770/ || (cd $SP/site && nohup setsid python3 -m http.server 8770 >/dev/null 2>&1 &)
curl -s -o /dev/null http://127.0.0.1:8771/__state || (cd "$T" && nohup setsid python3 mock_gh.py 8771 >/dev/null 2>&1 &)
sleep 1
