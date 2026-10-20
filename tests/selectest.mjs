/* 새 빌드 13개 표시 확인 + 길게 눌러 여러 개 고르기·삭제·되돌리기·뒤로 가기 시험 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771', OUT='/tmp/ttn-test/';
await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
const browser = await chromium.launch(); const errs = []; const log = []; const bad = [];
const check = (name, ok, info='') => { log.push(`${ok?'통과':'실패'} · ${name}${info!==''?' · '+info:''}`); if(!ok) bad.push(name); };
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(''+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
const cdp = await ctx.newCDPSession(p); let VT = Date.now()/1000;
const send = (type, pts, dt=.016) => { VT += dt; return cdp.send('Input.dispatchTouchEvent', {type, touchPoints:pts, timestamp:VT}); };
const center = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=typeof sel==='number' ? t.querySelectorAll('.bcard')[sel] : t.querySelector(sel); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }, sel);
const tap = async sel => { const c = await center(sel); await send('touchStart', [{x:c.x, y:c.y}]); await send('touchEnd', [], .06); await p.waitForTimeout(450); };
const hold = async (sel, ms=650, move=0) => { const c = await center(sel); await send('touchStart', [{x:c.x, y:c.y}]); if(move){ for(let i=1;i<=6;i++){ await p.waitForTimeout(30); await send('touchMove', [{x:c.x, y:c.y-move*i/6}], .03); } } await p.waitForTimeout(ms); VT += ms/1000; await send('touchEnd', [], .02); await p.waitForTimeout(400); };
const st = () => p.evaluate(() => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); return {title: t.querySelector('.top-title').textContent.trim(), sel: t.querySelectorAll('.bcard.sel').length, cards: t.querySelectorAll('.bcard').length, chk: t.querySelectorAll('.bc-chk').length, pages: document.querySelectorAll('#stack > .page:not(.leaving)').length, hist: JSON.stringify(history.state)}; });
await p.goto(SITE); await p.waitForTimeout(2200);

// ---- 새 빌드 13개
const names = await p.evaluate(() => [...document.querySelectorAll('.bcard-title')].map(e=>e.textContent));
check('빌드 20개 표시', names.length===20, String(names.length));
check('새 칼바람 빌드 13개', names.filter(n => /칼바람$/.test(n)).length===13, names.filter(n=>/칼바람$/.test(n)).join(','));
await p.evaluate(() => [...document.querySelectorAll('.bcard')].find(c => c.textContent.includes('그라가스 칼바람')).click()); await p.waitForTimeout(700);
const gr = await p.evaluate(() => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); return {map: t.querySelector('.mx.mp').textContent, items: t.querySelectorAll('#b-items .ib[data-id]').length, off: t.querySelectorAll('#b-items .ib.off').length, miss: t.querySelectorAll('#b-items .ib.miss').length, spells: [...t.querySelectorAll('.sp')].map(e=>e.getAttribute('aria-label')).join('/'), runesOn: t.querySelectorAll('#b-runes [aria-pressed=true], #b-runes .on').length}; });
check('그라가스 빌드: 칼바람·아이템 6개·빨간 점 없음', gr.map==='칼바람' && gr.items===6 && gr.off===0 && gr.miss===0, JSON.stringify(gr));
await p.screenshot({path:OUT+'sel-gragas.png'});
await p.evaluate(() => history.back()); await p.waitForTimeout(600);
// 13개 모두 빨간 점·삭제된 아이템 없음
const allOk = await p.evaluate(async () => { const out=[]; for(const c of [...document.querySelectorAll('.bcard')].filter(c=>/칼바람$/.test(c.querySelector('.bcard-title').textContent))){ out.push(c.querySelector('.bcard-title').textContent+':'+c.querySelectorAll('.bi').length); } return out; });
check('칼바람 빌드 카드 아이템 수', allOk.every(s => /:(5|6)$/.test(s)), allOk.join(' '));

// ---- 길게 누르기
let s0 = await st();
await hold(0);
let s1 = await st();
check('길게 누르면 고르기 시작', s1.title==='1개 선택' && s1.sel===1 && s1.chk===20 && s1.pages===1, JSON.stringify(s1));
await p.screenshot({path:OUT+'sel-mode.png'});
await tap(1); await tap(2);
let s2 = await st(); check('눌러서 더 고르기', s2.title==='3개 선택' && s2.sel===3, s2.title);
await tap(1); s2 = await st(); check('다시 누르면 빼기', s2.title==='2개 선택' && s2.sel===2, s2.title);
await hold(5); s2 = await st(); check('고르는 중 길게 누르기도 넣기', s2.title==='3개 선택', s2.title);
// 기기 뒤로 가기
await p.evaluate(() => history.back()); await p.waitForTimeout(500);
let s3 = await st(); check('뒤로 가기 = 고르기 끝 (홈 유지)', s3.sel===0 && s3.chk===0 && /템트리/.test(s3.title) && s3.pages===1, JSON.stringify(s3));
// 끝낸 뒤 기록 정상: 빌드 열고 뒤로
await tap(0); const t1 = (await st()).title; await p.evaluate(() => history.back()); await p.waitForTimeout(600); const t2 = (await st()).title;
check('고르기 후 화면 이동·뒤로 정상', /빌드|칼바람/.test(t1) && /템트리/.test(t2), `${t1} → ${t2}`);
// 전체 선택 → 해제
await hold(0); await tap('[data-act=sel-all]');
let s4 = await st(); check('전체 선택', s4.title==='20개 선택' && s4.sel===20, s4.title);
await tap('[data-act=sel-all]'); s4 = await st(); check('전체 해제 = 고르기 끝', s4.sel===0 && s4.chk===0);
check('✕로 끝낸 뒤 기록 한 칸 정리', (await p.evaluate(() => history.state && !history.state.sel && history.state.i===0)), await p.evaluate(()=>JSON.stringify(history.state)));
// 스크롤(움직임)이면 고르기 안 함
await hold(3, 650, 40); const s5 = await st(); check('누른 채 움직이면 고르기 안 함', s5.sel===0, JSON.stringify(s5));
// 삭제·되돌리기
await hold(0); await tap(1);
const delNames = await p.evaluate(() => [...document.querySelectorAll('.bcard.sel .bcard-title')].map(e=>e.textContent));
await tap('[data-act=sel-del]'); await p.waitForTimeout(300);
const s6 = await st(); const toast1 = await p.locator('#toast').innerText();
check('2개 삭제', s6.cards===18 && s6.chk===0 && /빌드 2개를 삭제했습니다/.test(toast1), `${s6.cards} · ${toast1.replace(/\n/g,' ')}`);
await p.waitForTimeout(2500);
let gs = await (await fetch(GH+'/__state')).json();
check('삭제가 저장소에 반영', Object.keys(gs.doc.builds).length===18 && Object.keys(gs.doc.del).length===2, `${Object.keys(gs.doc.builds).length} / 삭제기록 ${Object.keys(gs.doc.del).length}`);
await hold(0); await p.evaluate(() => history.back()); await p.waitForTimeout(300);   // 고르기 끝 (알림 유지 확인용 아님)
await tap(0).catch(()=>{}); await p.evaluate(() => history.back()); await p.waitForTimeout(500);
// 되돌리기 (새로 삭제 후 바로)
await hold(0); const nm = await p.evaluate(() => document.querySelector('.bcard.sel .bcard-title').textContent);
await tap('[data-act=sel-del]'); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-act=toast-act]').click()); await p.waitForTimeout(600);
const s7 = await st(); check('되돌리기', s7.cards===18 && (await p.evaluate(n => [...document.querySelectorAll('.bcard-title')].some(e=>e.textContent===n), nm)), `${s7.cards} · ${nm}`);
await p.waitForTimeout(2500);
gs = await (await fetch(GH+'/__state')).json();
check('되살림이 저장소에 반영', Object.keys(gs.doc.builds).length===18, String(Object.keys(gs.doc.builds).length));
// 챔피언 탭으로 가면 고르기 끝
await hold(0); await tap('[data-act=tab][data-v=champs]'); const s8 = await st();
check('탭 바꾸면 고르기 끝', s8.chk===0 && (await p.evaluate(() => !history.state.sel)));
console.log(log.join('\n')); console.log('실패', bad.length, JSON.stringify(bad)); console.log('ERRORS', JSON.stringify(errs));
await browser.close();

// ---- PC: 마우스 오른쪽 클릭·Esc
const b2 = await chromium.launch(); const c2 = await b2.newContext({viewport:{width:1280,height:800}});
await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
await c2.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const q = await c2.newPage(); await q.goto(SITE); await q.waitForTimeout(2000);
await q.click('.bcard >> nth=0', {button:'right'}); await q.waitForTimeout(300);
const r1 = await q.evaluate(() => document.querySelector('.top-title').textContent.trim());
await q.click('.bcard >> nth=2'); await q.waitForTimeout(300);
const r2 = await q.evaluate(() => document.querySelector('.top-title').textContent.trim());
await q.keyboard.press('Escape'); await q.waitForTimeout(300);
const r3 = await q.evaluate(() => document.querySelectorAll('.bc-chk').length);
await q.screenshot({path:OUT+'sel-pc.png'});
console.log(`PC 오른쪽 클릭: ${r1} → 클릭 ${r2} → Esc 후 표시 ${r3}`, r1==='1개 선택' && r2==='2개 선택' && r3===0 ? '통과' : '실패');
await b2.close();
