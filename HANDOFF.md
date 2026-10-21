# 템트리 노트 — 작업 인계 (2026-10-21 기준)

새 대화에서 이 앱을 이어서 고칠 때 먼저 읽는 문서. 사용자 응답 형식 규칙(사무적 어조, 개조식·명사형 종결, 선택지는 번호)은 Claude 메모리의 preferences에 있음.

## 1. 현재 상태
- 앱: 설치형 웹앱(PWA) https://1hyun-you.github.io/ — 폰(안드로이드 크롬 설치)·PC에서 사용 중
- 빌드 기록 동기화: 비공개 저장소 `1hyun-you/tem-tree-sync`의 `builds.json` (앱이 사용자 토큰으로 GitHub API 직접 읽기·쓰기)
- Claude 페이지(https://claude.ai/artifact/U79KLdzMdL6e7ZShouKoUE): 2026-10-20 Version 15에서 동결. 데이터 갱신·기능 추가 모두 하지 않음 (사용자 결정)
- 매주 금요일 08:50 예약 작업 `템트리 노트 패치 갱신`(trig_01XyewH8DsjyM3Ro1iR4DPD4): 패치 데이터만 새로 만들어 `main`에 덮어씀. 앱 원본(app 가지)·tem-tree-sync는 건드리지 않음

## 2. 저장소 구조 (`1hyun-you/1hyun-you.github.io`, 공개)
- `main`: 공개 사이트. 커밋 하나로 매번 덮어씀(force push, 이력 없음)
  - index.html(감싼 앱), sw.js, manifest.webmanifest, icons/, data.json, skills.json, sprites/*.webp, tools/aram_raw.txt·aram_ko.json(최신 칼바람 보정 원본)
- `app`: 앱 원본 (이 가지). 앱을 고칠 때만 커밋 추가
  - `index.html` = 앱 본문 전체(CSS·JS 한 파일, 약 18만 자). **수정은 이 파일을 직접 고침**
  - `site-src/` = manifest, sw.js(`__V__` 자리), 아이콘
  - `tools/build_data.py` = 패치 데이터·그림 생성, `tools/build_site.py` = 사이트 생성
  - `tools/item_calc.py` = 아이템 설명 세부 수치(CommunityDragon 게임 원본 계산식). build_data.py가 호출, 받기 실패·해석 실패 아이템은 기존 문구 유지. 단독 실행: `python3 tools/item_calc.py data.json [캐시폴더]`
  - CommunityDragon(raw.communitydragon.org)은 사용자 계정 설정(기능 → 추가 허용 도메인)에 등록됨
  - `tests/` = Playwright 시험 묶음 (아래 6항)

## 3. 작업 준비 (새 세션)
1. add_repo: owner `1hyun-you`, repo `1hyun-you.github.io`, access `push` (빌드 기록을 직접 다룰 때만 `tem-tree-sync`도)
2. 원본 작업 폴더 만들기
   - `git clone -b app https://github.com/1hyun-you/1hyun-you.github.io /home/claude/tem-tree`
   - 데이터 복사: `git clone --depth 1 -b main https://github.com/1hyun-you/1hyun-you.github.io /tmp/site-main` 후 `cp -r /tmp/site-main/{data.json,skills.json,sprites} /home/claude/tem-tree/`
   - (data.json·skills.json·sprites는 app 가지에 커밋하지 말 것: `.gitignore` 없음 → `git add`할 때 파일 지정)
3. 사이트 배포용 폴더: `git clone --depth 1 -b main https://github.com/1hyun-you/1hyun-you.github.io /home/claude/1hyun-you.github.io`

## 4. 배포 절차 (앱 수정 후)
1. `cd /home/claude/tem-tree && python3 tools/build_site.py . . /home/claude/1hyun-you.github.io`
2. `cd /home/claude/1hyun-you.github.io && git add -A && git commit --amend --date=now -m "템트리 노트 설치형 앱" && git push -f origin main` (커밋 표기 줄은 세션 안내에 따름, 작성자 `1hyun-you <1hyun-you@users.noreply.github.com>`)
3. app 가지에 `index.html`(및 바꾼 원본) 커밋 후 `git push origin app`
4. `gh api repos/1hyun-you/1hyun-you.github.io/actions/runs`로 최신 실행이 success인지 확인 (가끔 GitHub 대기열에서 10~20분 걸림)
5. 사용자 안내: 폰 앱을 완전히 닫았다 다시 열면 새 버전 (sw.js가 화면을 네트워크 우선으로 받음)

## 5. 앱 구조 요약 (index.html)
- 상태 `S`: builds(Map), prefs{fav, cdm, nbm, sets}, views/sheets(페이지 쌓기), tab('builds'|'items'|'champs'), sel(여러 개 고르기), imap/itier/istats/qi/icol/iset(아이템 탭) 등
- 저장소: Claude 안이면 `window.claude.use('db')`, 밖이면 `ghStore`(gh.js 부분: builds.json 한 파일, ETag 조건부 받기, sha로 올리기, 409→받아 합치고 재시도, 45초마다·앱 복귀 때 확인, 변경 번호 `edits`로 올리는 중 생긴 변경도 이어서 올림)
- 설정(폰·PC 공통) `meta/prefs` = {fav, cdm(주문 쿨타임 기준), nbm(새 빌드 맵), sets(아이템 세트)} — 기본값 모두 칼바람('aram')
- 기기별 설정 localStorage `ttn.v1.ui`: theme, motion, scale, haptic, wake, start, bsort, imap, role 등
- 화면: 페이지 쌓기(`#stack > .page`), 오른쪽으로 밀어 뒤로(SW), 홈은 3탭 가로 트랙(`#hm-track`)을 좌우로 밀어 전환(HS), 탭마다 스크롤 따로
- 기록(history): 페이지마다 한 칸. 홈 맨 앞에 보호 칸(guard) → 뒤로 두 번 종료. 여러 개 고르기 중에는 sel 칸
- 데이터: data.json 아이템마다 `sr`·`ar`(그 맵 상점 여부). 4자리 = 일반, 12xxxx = 칼바람 수치판, 그 밖 6자리(22·32·66·77…)는 이벤트 모드용이라 목록 제외(이름·그림만 보관)

## 6. 시험 (tests/)
- 준비: `npm i -g playwright`가 되어 있으면 그대로, 크로미움은 환경 기본값 사용. 결과물 폴더 `/tmp/ttn-test`
- `bash tests/serve_site.sh` → 사이트 8770 + 가짜 GitHub 8771(mock_gh.py). `bash tests/serve.sh` → Claude 페이지 흉내 8765/8766
- 시험 시작 데이터: `/home/claude/tem-tree-sync/builds.json`을 가짜 GitHub에 넣음 → tem-tree-sync를 읽기 전용으로 받아 둘 것 (쓰지 말 것)
- 주요 시험: combo(필터 조합·세트 담기 중 막대·키보드·가로/작은 화면·추가 창 조합), hometest(홈 3탭·밀기·아이템 탭·세트·뒤로 두 번 종료), selectest(길게 눌러 고르기·삭제), maptest(맵별 아이템·설정), settings, sync(두 기기 동기화), race(올리는 중 변경), pwa(설치·오프라인), migrate_test, scaledrag(화면 크기), claudemode, test9·hist3·misc10·polish11·sweep(기존 회귀), perf10(6배 감속 반응 속도)
- 스크립트 안의 Playwright 경로 `/home/claude/.npm-global/lib/node_modules/playwright/index.mjs`는 환경에 맞게 바꿀 것

## 7. 버전 이력 (요약)
- v10~v11: 정보 창 → 전체 페이지, 밀어서 뒤로 재설계, 칸 이동 진동, 마감 보완
- v12: 설치형 앱(PWA)·GitHub 동기화, 기존 빌드 7개 이전
- v13: 설정 화면(테마·화면 전환·진동·화면 꺼짐 방지·빌드 기본값)
- v14: 빌드별 맵(협곡·칼바람) 상점 아이템만 표시, 맵 바꾸면 같은 아이템 그 맵 버전으로, 설정 추가(화면 크기·시작 화면·정렬·오프라인 준비)
- v15: Claude 페이지 갱신 중단 안내 (Claude 페이지 마지막 판)
- v16: 스크린샷 판독 칼바람 빌드 13개 추가, 빌드 목록 길게 눌러 여러 개 고르기·삭제
- v17: 홈 3탭(내 빌드·아이템·챔피언)+좌우 밀기, 검색창 고정, 새 빌드 버튼, 아이템 탭(필터·세트 담기·여러 세트·빌드 적용·맵 자동 교체), 뒤로 두 번 종료, 선마 스킬 그림 표시, 보기 모드 빈 줄 제거, 기본값 칼바람, 동기화 누락 수정

- v18(현재): 아이템 필터 왼쪽 막대(분류 순환 버튼: 누르기·좌우 밀기 / 능력치 17개 2개씩, 구분선 2개, 막대 완전 고정, 너무 낮은 화면은 목록과 함께 스크롤), 위 줄 = 검색 아이콘·정렬(기본 낮은 가격순)·초기화, 분류 기본값 완성, 선택 칩만 롤 색(채도 60%), 롤 위키 기준 설명문 색, 아이템 세부 수치, 탭 다시 누르기 = 맨 위로, 뒤로 한 번 뒤 화면 조작 시 종료 대기 초기화, 막대 옆 4열(칸 64px·여백 12px)

## 8. 다음 후보 (사용자에게 제안했으나 아직 미채택)
- 내 빌드 맵 필터(전체·협곡·칼바람), 여러 개 고르기에서 맵 일괄 변경·대표 지정
- 아이템 추가 화면 '최근 사용' 줄, 빌드 총 가격, 패치 후 바뀐 아이템 표시
- 앱 아이콘 바로가기(새 빌드·챔피언 검색), 스킬 순서 표(1~18레벨)
- 하단 탭 막대, 빌드 카드 소환사 주문 표시, 아이템 정보에 '이 아이템이 든 내 빌드', 아이템 즐겨찾기

## 9. 지켜야 할 것
- GitHub 토큰은 사용자가 앱에만 입력(기기 localStorage). 채팅으로 받지 말 것
- 사용자 이메일을 외부로 보내지 말 것
- Claude 페이지는 동결 상태: 게시·데이터 갱신 금지 (사용자가 다시 요청할 때만)
- 예약 작업은 main만 덮어씀 → app 가지의 tools/·site-src/·index.html을 바꾸면 다음 주 갱신부터 반영됨
