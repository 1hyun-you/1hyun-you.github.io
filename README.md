# 템트리 노트 — 앱 원본

- `main` 가지: 실제 앱 화면(GitHub Pages로 공개). 매주 금요일 예약 작업이 데이터 갱신 때 커밋 하나로 덮어씀(이력 미보관)
  - `main`의 `tools/aram_raw.txt`·`tools/aram_ko.json` = 최신 칼바람 보정 원본 (다음 주 갱신의 이전 값)
- `app` 가지(이곳): 앱 원본과 생성 도구. 앱 자체를 고칠 때만 커밋 추가

## 구성
- `index.html` — 앱 본문(Claude 페이지와 같은 코드)
- `site-src/` — 설치용 파일(manifest, 서비스 워커, 아이콘)
- `tools/build_data.py` — 패치 데이터·그림 생성 (`python3 tools/build_data.py <출력 폴더>`)
- `tools/build_site.py` — 설치형 앱 사이트 생성 (`python3 tools/build_site.py . <데이터 폴더> <출력 폴더> [칼바람 보정 폴더]`)

## Claude 페이지
- 2026-10-20부터 데이터 갱신 중단 (Version 15에서 고정, 설치형 앱 안내만 표시)

## 빌드 기록
- 사용자 빌드는 이 저장소가 아니라 비공개 저장소 `tem-tree-sync`의 `builds.json`에 저장
