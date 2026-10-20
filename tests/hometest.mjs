/* 홈 3탭·밀기 전환·검색 고정·새 빌드 버튼·아이템 탭(필터·세트 담기·적용)·선마 표시·빈 줄·뒤로 두 번 종료·칼바람 기본값 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771', OUT='/tmp/ttn-test/';
const D = JSON.parse(fs.readFileSync('/home/claude/tem-tree/data.json','utf8'));
const SEED = JSON.parse(fs.readFileSync('/home/claude/tem-tree-sync/builds.json','utf8')); if(SEED.prefs) SEED.prefs.sets = [];   // 세트 시험은 빈 세트에서 시작
await fetch(GH+'/__seed', {method:'PUT', body: JSON.stringify(SEED)});
const browser = await chromium.launch(); const errs = []; const log = []; const bad = [];
const check = (name, ok, info='') => { log.push(`${ok?'통과':'실패'} · ${name}${info!==''?' · '+info:''}`); if(!ok) bad.push(name); };
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(''+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
const cdp = await ctx.newCDPSession(p); let VT = Date.now()/1000;
const send = (type, pts, dt=.016) => { VT += dt; return cdp.send('Input.dispatchTouchEvent', {type, touchPoints:pts, timestamp:VT}); };
const TOP = `[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop()`;
const center = sel => p.evaluate(([sel, TOP]) => { const t=eval(TOP); const el=t.querySelector(sel); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }, [sel, TOP]);
const tap = async (sel, wait=450) => { const c = await center(sel); if(!c) throw new Error('없음 '+sel); await send('touchStart', [{x:c.x, y:c.y}]); await send('touchEnd', [], .06); await p.waitForTimeout(wait); };
async function swipe(dx, steps=10, dt=.016, y=520){ const x0 = dx<0 ? 300 : 90; await send('touchStart', [{x:x0, y}]); for(let i=1;i<=steps;i++) await send('touchMove', [{x:x0+dx*i/steps, y:y+i*.3}], dt); await send('touchEnd', [], .016); await p.waitForTimeout(500); }
const tab = () => p.evaluate(() => document.querySelector('.hm-seg [aria-pressed=true]').dataset.v);
const title = () => p.evaluate(TOP => eval(TOP).querySelector('.top-title, .top h2').textContent.trim(), TOP);
const state = async () => (await (await fetch(GH+'/__state')).json());
await p.goto('about:blank'); await p.goto(SITE); await p.waitForTimeout(2200);

// ---- 탭 구조
check('탭 순서', (await p.evaluate(() => [...document.querySelectorAll('.hm-seg [data-act=tab]')].map(b=>b.textContent).join(','))) === '내 빌드,아이템,챔피언');
check('시작 탭 내 빌드', await tab()==='builds');
// ---- 밀기 전환
await swipe(-200); check('왼쪽으로 밀기 → 아이템', await tab()==='items');
await swipe(-200); check('한 번 더 → 챔피언', await tab()==='champs');
await swipe(-200); check('마지막 탭에서 더 밀어도 그대로', await tab()==='champs');
await swipe(200); check('오른쪽으로 밀기 → 아이템', await tab()==='items');
await swipe(60, 10, .03); check('천천히 짧게 밀면 그대로', await tab()==='items');
await swipe(50, 3, .016); check('빠르게 튕기면 넘어감', await tab()==='builds');
const tr = await p.evaluate(() => getComputedStyle(document.querySelector('#hm-track')).transform);
check('밀기 뒤 탭 위치 정렬', /matrix\(1, 0, 0, 1, (-0|0)/.test(tr), tr);
// 밀기 직후 누르기 정상, 손 뗄 때 카드가 열리지 않음
await swipe(-200, 10, .016, 300); check('카드 위에서 밀어도 빌드가 열리지 않음', (await p.evaluate(() => document.querySelectorAll('#stack > .page:not(.leaving)').length))===1 && await tab()==='items');
await swipe(200, 10, .016, 300);
await tap('.bcard'); const t1 = await title(); check('밀기 직후 바로 누르기', /칼바람|빌드/.test(t1), t1);
await p.evaluate(() => history.back()); await p.waitForTimeout(600);
// ---- 탭별 스크롤 유지 + 검색창 고정
await p.evaluate(() => { document.querySelector('.hm-pane[data-tab=builds]').scrollTop = 700; }); await p.waitForTimeout(200);
const sTop = await p.evaluate(() => { const pane=document.querySelector('.hm-pane[data-tab=builds]'); const s=pane.querySelector('.search').getBoundingClientRect(); return Math.round(s.top - pane.getBoundingClientRect().top); });
check('검색창 상단 고정', sTop>=0 && sTop<=12, String(sTop));
await tap('.hm-seg [data-v=champs]'); await tap('.hm-seg [data-v=builds]');
check('탭별 스크롤 유지', (await p.evaluate(() => document.querySelector('.hm-pane[data-tab=builds]').scrollTop))===700);
await p.evaluate(() => { document.querySelector('.hm-pane[data-tab=builds]').scrollTop = 0; });
// ---- 새 빌드 버튼
check('새 빌드 버튼(내 빌드 탭)', await p.evaluate(() => !document.querySelector('#hm-fab').hidden));
await tap('.hm-seg [data-v=items]'); check('아이템 탭에서는 숨김', await p.evaluate(() => document.querySelector('#hm-fab').hidden));
await tap('.hm-seg [data-v=builds]');
await tap('#hm-fab'); check('챔피언 고르기 화면', /챔피언 고르기/.test(await title()), await title());
await p.fill('#q-cpick', '가렌'); await p.waitForTimeout(250);
await tap('[data-act=pick-champ-new]', 700);
const nb = await p.evaluate(TOP => { const t=eval(TOP); return {t: t.querySelector('.top-title').textContent, edit: !!t.querySelector('#bv.edit'), map: t.querySelector('.mx.mp').textContent}; }, TOP);
check('가렌 새 빌드(편집·칼바람)', /가렌/.test(nb.t) && nb.edit && nb.map==='칼바람', JSON.stringify(nb));
// 선마 표시
await tap('.mx[data-v=max]'); await tap('.mxo[data-k=Q], [data-act=max-pick][data-v=Q], .mxo', 400);
const mx = await p.evaluate(TOP => { const b=eval(TOP).querySelector('.mx.mxs'); return b ? {k: b.querySelector('.kbox').textContent, label: b.textContent.replace(b.querySelector('.kbox').textContent,'').trim(), ico: !!b.querySelector('.sico .ico')} : null; }, TOP);
check('선마: 스킬 그림 + 키 + 선마', mx && mx.ico && /^[QWE]$/.test(mx.k) && mx.label==='선마', JSON.stringify(mx));
await p.screenshot({path:OUT+'h-max.png'});
await p.evaluate(() => history.back()); await p.waitForTimeout(600);
check('새 빌드 뒤 홈 복귀', /템트리/.test(await title()));
// ---- 보기 모드 빈 줄 제거
await p.evaluate(() => [...document.querySelectorAll('.bcard')].find(c => c.textContent.includes('그라가스 칼바람')).click()); await p.waitForTimeout(700);
const h1 = await p.evaluate(TOP => eval(TOP).querySelector('#b-items').getBoundingClientRect().height, TOP);
await tap('#fab'); const h2 = await p.evaluate(TOP => eval(TOP).querySelector('#b-items').getBoundingClientRect().height, TOP);
check('보기 모드 아이템 칸 빈 줄 없음', h1 < h2 - 20, `${Math.round(h1)} < ${Math.round(h2)}`);
await tap('#fab'); await p.evaluate(() => history.back()); await p.waitForTimeout(600);
// ---- 아이템 탭
await tap('.hm-seg [data-v=items]');
const arN = Object.values(D.items).filter(i=>i.ar).length, srN = Object.values(D.items).filter(i=>i.sr).length;
const cnt = () => p.evaluate(() => document.querySelectorAll('#it-list .pit').length);
check('아이템 탭 기본 칼바람', (await p.evaluate(() => document.querySelector('[data-act=it-map][aria-pressed=true]').dataset.v))==='aram' && await cnt()===arN, `${await cnt()} / ${arN}`);
await tap('[data-act=it-tier][data-v=legend]'); const nl = await cnt(); check('분류 완성', nl>50 && nl<arN, String(nl));
await tap('[data-act=if-panel][data-c=it]'); await tap('[data-act=it-stat][data-v=ap]'); const na = await cnt(); check('능력치 주문력', na>5 && na<nl, String(na));
await tap('[data-act=it-reset]'); check('필터 초기화', await cnt()===arN);
await tap('[data-act=if-search][data-c=it]'); await p.fill('#q-items', 'ㄹㅇㄷㄹ'); await p.waitForTimeout(250);
check('초성 검색', (await p.evaluate(() => [...document.querySelectorAll('#it-list .pit .nm')].map(e=>e.textContent).join(','))).includes('리안드리의 고통'));
await p.fill('#q-items', ''); await p.waitForTimeout(250);
await tap('[data-act=it-map][data-v=sr]'); check('협곡 전환', await cnt()===srN, `${await cnt()} / ${srN}`);
await tap('[data-act=it-map][data-v=aram]');
await tap('#it-list .pit'); check('아이템 누르면 정보', /아이템 정보/.test(await title()));
await p.evaluate(() => history.back()); await p.waitForTimeout(500);
// 세트 담기
await tap('[data-act=it-collect]');
check('세트 담기 막대', await p.evaluate(() => !document.querySelector('#setbar').hidden && document.querySelector('#f-setname').value==='세트 1'));
const pickIds = ['126697','6610','3814'];   // 오만(칼바람), 갈라진 하늘, 밤의 끝자락
for(const id of pickIds){ await p.fill('#q-items', D.items[id].n); await p.waitForTimeout(200); await tap(`#it-list .pit[data-id="${id}"]`, 250); }
await p.fill('#q-items', ''); await p.waitForTimeout(200);
let tray = await p.evaluate(() => [...document.querySelectorAll('#sb-tray .tb')].map(e=>e.dataset.id));
check('누를 때마다 세트에 담김', tray.join()===pickIds.join(), tray.join());
check('담긴 순서 번호', (await p.evaluate(() => document.querySelector('#it-list .pit.in .chk')?.textContent))!=null);
await p.fill('#f-setname', '칼바람 브루저'); await p.waitForTimeout(300);
check('세트 이름', (await p.evaluate(() => document.querySelector('.set-chip[aria-pressed=true]').textContent)).includes('칼바람 브루저'));
// 맵 바꾸면 세트도 그 맵 버전으로
await tap('[data-act=it-map][data-v=sr]');
tray = await p.evaluate(() => [...document.querySelectorAll('#sb-tray .tb')].map(e=>e.dataset.id));
check('협곡으로 바꾸면 오만 협곡판', tray[0]==='6697', tray.join());
await tap('[data-act=it-map][data-v=aram]');
await tap('#sb-tray .tb[data-id="3814"]', 300); tray = await p.evaluate(() => [...document.querySelectorAll('#sb-tray .tb')].map(e=>e.dataset.id));
check('담은 칸 누르면 빼기', tray.length===2 && !tray.includes('3814'), tray.join());
await p.fill('#q-items', D.items['3814'].n); await p.waitForTimeout(200); await tap(`#it-list .pit[data-id="3814"]`, 250); await p.fill('#q-items', ''); await p.waitForTimeout(200);
await p.screenshot({path:OUT+'h-items-collect.png'});
await tap('.sb-act [data-act=it-collect]');
check('담기 끝 → 막대 닫힘·세트 칩', await p.evaluate(() => document.querySelector('#setbar').hidden && document.querySelectorAll('.set-chip').length===1));
await p.waitForTimeout(3000);
let gs = await state();
check('세트 동기화 저장', gs.doc.prefs.sets && gs.doc.prefs.sets.length===1 && gs.doc.prefs.sets[0].n==='칼바람 브루저' && gs.doc.prefs.sets[0].it.length===3, JSON.stringify(gs.doc.prefs.sets));
// 기존 빌드에 적용 (협곡 빌드 → 협곡 버전으로)
await tap('.set-chip'); await tap('#sb-apply', 600);
check('세트 적용 화면', /적용/.test(await title()), await title());
const pyke = await p.evaluate(() => { const r=[...document.querySelectorAll('.arow')].find(x=>x.textContent.includes('파이크 빌드')); return r ? r.dataset.id : null; });
const before = await p.evaluate(id => null, pyke);
await p.evaluate(id => document.querySelector(`.arow[data-id="${id}"]`).click(), pyke); await p.waitForTimeout(800);
const applied = await p.evaluate(TOP => ({t: eval(TOP).querySelector('.top-title').textContent, ids: [...eval(TOP).querySelectorAll('#b-items .ib[data-id]')].map(e=>e.dataset.id)}), TOP);
check('기존 빌드 통째로 교체 + 협곡 버전', /파이크/.test(applied.t) && applied.ids.join()==='6697,6610,3814', JSON.stringify(applied));
check('되돌리기 알림', /세트로 바꿨습니다/.test(await p.locator('#toast').innerText()));
await p.evaluate(() => document.querySelector('[data-act=toast-act]').click()); await p.waitForTimeout(500);
const undone = await p.evaluate(TOP => [...eval(TOP).querySelectorAll('#b-items .ib[data-id]')].map(e=>e.dataset.id).join(), TOP);
check('되돌리기 → 원래 아이템', undone==='6697,6696,6699,3814,6698,3009', undone);
await p.evaluate(() => history.back()); await p.waitForTimeout(600);
check('적용 후 뒤로 → 홈', /템트리/.test(await title()) && await tab()==='items', await title());
// 새 빌드 만들기
await tap('.set-chip'); await tap('#sb-apply', 600); await tap('[data-act=apply-tab][data-v=new]');
await p.fill('#q-apply', '아리'); await p.waitForTimeout(250); await tap('[data-act=apply-new][data-id=Ahri]', 800);
const nb2 = await p.evaluate(TOP => ({t: eval(TOP).querySelector('.top-title').textContent, ids: [...eval(TOP).querySelectorAll('#b-items .ib[data-id]')].map(e=>e.dataset.id), map: eval(TOP).querySelector('.mx.mp').textContent}), TOP);
check('챔피언 골라 새 빌드', /아리/.test(nb2.t) && nb2.ids.join()==='126697,6610,3814' && nb2.map==='칼바람', JSON.stringify(nb2));
await p.evaluate(() => history.back()); await p.waitForTimeout(600);
// 세트 삭제·되돌리기
await tap('.set-chip'); await tap('[data-act=set-del]');
check('세트 삭제', await p.evaluate(() => document.querySelectorAll('.set-chip').length===0));
await p.evaluate(() => document.querySelector('[data-act=toast-act]').click()); await p.waitForTimeout(300);
check('세트 되살리기', await p.evaluate(() => document.querySelectorAll('.set-chip').length===1));
// ---- 뒤로 두 번 종료
await tap('.hm-seg [data-v=builds]');
check('홈 보호 기록', await p.evaluate(() => !!(history.state && history.state.guard)), await p.evaluate(()=>JSON.stringify(history.state)));
await p.evaluate(() => history.back()); await p.waitForTimeout(500);
check('뒤로 1번: 알림·앱 유지', /한 번 더 누르면 종료/.test(await p.locator('#toast').innerText()) && p.url()===SITE, await p.locator('#toast').innerText());
await tap('.hm-seg [data-v=builds]');
check('다시 누르면 보호 기록 복구', await p.evaluate(() => !!(history.state && history.state.guard)));
// 빌드 열고 닫은 뒤에도
await tap('.bcard'); await p.evaluate(() => history.back()); await p.waitForTimeout(600);
await p.evaluate(() => history.back()); await p.waitForTimeout(500);
check('빌드 다녀온 뒤 뒤로 1번 = 알림', /한 번 더 누르면 종료/.test(await p.locator('#toast').innerText()) && p.url()===SITE);
// 고르기 중 뒤로
await tap('.hm-seg [data-v=builds]'); await p.waitForTimeout(2000);
{ const c = await center('.bcard'); await send('touchStart', [{x:c.x, y:c.y}]); await p.waitForTimeout(600); VT += .6; await send('touchEnd', [], .02); await p.waitForTimeout(400); }
check('고르기 기록', await p.evaluate(() => !!(history.state && history.state.sel)));
await p.evaluate(() => history.back()); await p.waitForTimeout(400);
check('고르기 중 뒤로 = 고르기 끝, 앱 유지', await p.evaluate(() => !document.querySelector('.bc-chk')) && p.url()===SITE && await p.evaluate(() => document.querySelector('#toast').hidden || !/한 번 더/.test(document.querySelector('#toast').textContent)));
await p.evaluate(() => history.back()); await p.waitForTimeout(500);
check('그다음 뒤로 = 종료 알림', /한 번 더 누르면 종료/.test(await p.locator('#toast').innerText()));
await p.evaluate(() => history.back()); await p.waitForTimeout(800);
check('알림 뒤 한 번 더 = 종료(앱을 떠남)', p.url()!==SITE, p.url());
// ---- 시작 화면 아이템
await p.goto(SITE); await p.waitForTimeout(1800);
await tap('[data-act=about]'); await tap('[data-act=set][data-k=start][data-v=items]');
await p.reload(); await p.waitForTimeout(1800);
check('시작 화면 아이템', await tab()==='items');
await p.screenshot({path:OUT+'h-items.png'});
console.log(log.join('\n')); console.log('실패', bad.length, JSON.stringify(bad)); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
// ---- 새 기기 기본값 칼바람
const b2 = await chromium.launch(); const c2 = await b2.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const q = await c2.newPage(); await q.goto(SITE); await q.waitForTimeout(1500);
await q.evaluate(() => document.querySelector('[data-act=about]').click()); await q.waitForTimeout(500);
const dv = await q.evaluate(() => ['nbm','cdm'].map(k => document.querySelector(`[data-k=${k}][aria-pressed=true]`).dataset.v).join(','));
console.log('새 기기 기본값(새 빌드 맵, 주문 기준):', dv, dv==='aram,aram' ? '통과' : '실패');
await b2.close();
