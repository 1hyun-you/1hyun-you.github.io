#!/usr/bin/env python3
"""설치형 앱(GitHub Pages) 사이트 만들기.
Claude 페이지 본문(index.html)을 일반 웹 문서로 감싸고, 앱 설치 정보(manifest)·오프라인 보관(sw.js)·아이콘을 붙여
<출력 폴더>에 올릴 파일 전체를 만든다. 게임 데이터(data.json·skills.json·sprites)도 함께 복사.

2026-11-02 구조 변경: 앱은 <출력 폴더>/temtree/ 하위 폴더에 생성(주소 1hyun-you.github.io/temtree/),
최상위에는 이동 안내 페이지(index.html)·기존 최상위 오프라인 기능 해제용 sw.js만 둠.
이유: 최상위 설치 앱은 같은 주소의 다른 앱(예: /loop-game/)까지 범위로 덮어 안드로이드 크롬에서 별도 설치 불가 → 최상위에는 앱 설치 금지.

사용법: python3 build_site.py <앱 원본 폴더(index.html, site-src/, tools/)> <데이터 폴더(data.json, skills.json, sprites/)> <출력 폴더> [칼바람 보정 폴더]
칼바람 보정 폴더(aram_raw.txt, aram_ko.json)를 생략하면 앱 원본 폴더의 tools/ 사용. 사이트의 tools/에 복사됨
"""
import hashlib, os, re, shutil, sys

SRC, DATA, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = os.path.join(ROOT, "temtree")   # 앱 위치 (최상위 아님)
ARAM = sys.argv[4] if len(sys.argv) > 4 else os.path.join(SRC, "tools")   # 칼바람 보정 원본(aram_raw.txt, aram_ko.json): 사이트 tools/에 보관해 다음 주 갱신의 이전 값으로 사용
page = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
page = re.sub(r"^\s*<title>.*?</title>\s*", "", page, flags=re.S)
page = re.sub(r'^\s*<meta name="claude:[^"]*"[^>]*>\s*', "", page)
head = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>템트리 노트</title>
<meta name="description" content="롤 챔피언별 아이템·룬·소환사 주문·선마 빌드 기록">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/favicon-64.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ECEFF2">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0A1016">
<meta name="mobile-web-app-capable" content="yes">
<style>[hidden]{display:none!important}</style>
</head>
<body>
"""
tail = """
<script>if('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</body>
</html>
"""
html = head + page + tail
ver = hashlib.md5(html.encode("utf-8")).hexdigest()[:10]
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
sw = open(os.path.join(SRC, "site-src", "sw.js"), encoding="utf-8").read().replace("__V__", ver)
open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8").write(sw)
shutil.copy(os.path.join(SRC, "site-src", "manifest.webmanifest"), OUT)
shutil.copytree(os.path.join(SRC, "site-src", "icons"), os.path.join(OUT, "icons"), dirs_exist_ok=True)
for f in ("data.json", "skills.json"):
    shutil.copy(os.path.join(DATA, f), OUT)
if os.path.isdir(os.path.join(OUT, "sprites")):
    shutil.rmtree(os.path.join(OUT, "sprites"))
shutil.copytree(os.path.join(DATA, "sprites"), os.path.join(OUT, "sprites"))
os.makedirs(os.path.join(OUT, "tools"), exist_ok=True)
for f in ("aram_raw.txt", "aram_ko.json"):
    if os.path.exists(os.path.join(ARAM, f)):
        shutil.copy(os.path.join(ARAM, f), os.path.join(OUT, "tools", f))
open(os.path.join(ROOT, ".nojekyll"), "w").close()
# 최상위: 앱 없음. 기존 주소 접속 시 새 주소로 이동, 기존 최상위 오프라인 기능(sw.js) 해제
shutil.copy(os.path.join(SRC, "site-src", "root", "index.html"), ROOT)
shutil.copy(os.path.join(SRC, "site-src", "root", "sw.js"), ROOT)
print({"out": OUT, "root": ROOT, "shell_version": ver, "files": sum(len(fs) for _, _, fs in os.walk(OUT))})
