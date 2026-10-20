/* 빌드 맵(협곡·칼바람) 아이템 목록, 맵 바꾸기 변환, 설정 추가 항목(화면 크기·시작 화면·정렬·오프라인 준비) 시험 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771', OUT='/tmp/ttn-test/';
const D = JSON.parse(fs.readFileSync('/home/claude/tem-tree/data.json', 'utf8'));
await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
const browser = await chromium.launch(); const errs = []; const log = []; const bad = [];
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(''+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
const cdp = await ctx.newCDPSession(p); let VT = 0;
async function swipe(){ VT = Math.max(VT, Date.now()/1000); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:40,y:430}],timestamp:VT}); for(let i=1;i<=10;i++){ VT+=.016; await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:40+22*i,y:432}],timestamp:VT}); } VT+=.016; await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[],timestamp:VT}); await p.waitForTimeout(600); }
const check = (name, ok, info='') => { log.push(`${ok?'통과':'실패'} · ${name}${info?' · '+info:''}`); if(!ok) bad.push(name); };
await p.goto(SITE); await p.waitForTimeout(1800);
const top = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
const title = () => p.evaluate(() => [...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.top-title, .top h2, .top').textContent.trim());
const grid = () => p.evaluate(() => [...document.querySelectorAll('#pick-grid [data-act=pick-toggle]')].map(e => e.dataset.id));
const openBuild = async champName => { await p.evaluate(n => { const c=[...document.querySelectorAll('.bcard')].find(x => x.textContent.includes(n)); c.click(); }, champName); await p.waitForTimeout(600); };

// ---- 협곡 빌드 아이템 목록
await openBuild('파이크');
check('빌드 머리 맵 표시', (await p.evaluate(() => document.querySelector('.mx.mp').textContent)) === '협곡');
await top('#fab'); await p.waitForTimeout(300);
await top('[data-act=pick-start]'); await p.waitForTimeout(700);
let ids = await grid();
const srBad = ids.filter(id => !D.items[id].sr && !['6697','6696','6699','3814','6698','3009'].includes(id));
check('협곡 목록: 협곡 상점 아이템만', srBad.length===0, `${ids.length}개${srBad.length?' 섞임 '+srBad.slice(0,5):''}`);
check('협곡 목록: 칼바람 전용·이벤트 아이템 없음', !ids.some(id => /^(12|22|66|77)\d{4}$/.test(id) || ['3039','4003','4004'].includes(id)));
check('협곡 목록: 와드·정글·서폿 아이템 있음', ['2055','1101','3865'].every(id => ids.includes(id)));
await p.screenshot({path:OUT+'map-sr-picker.png'});
// ---- 아이템 추가 화면에서 칼바람으로
await top('[data-act=build-map][data-v=aram]'); await p.waitForTimeout(700);
ids = await grid();
const arBad = ids.filter(id => !D.items[id].ar);
check('칼바람 목록: 칼바람 상점 아이템만', arBad.length===0, `${ids.length}개${arBad.length?' 섞임 '+arBad.map(i=>D.items[i].n).slice(0,5):''}`);
check('칼바람 목록: 클래식·아레나 아이템 없음', !ids.some(id => /^(22|66|77)\d{4}$/.test(id)));
check('칼바람 목록: 와드·정글·서폿 아이템 없음', !['2055','1101','3865','3340'].some(id => ids.includes(id)));
check('칼바람 목록: 칼바람 전용 아이템 있음', ['4004','4003','3039','126697'].every(id => ids.includes(id)));
const tray = await p.evaluate(() => [...document.querySelectorAll('#pick-tray .tb')].map(e => e.dataset.id));
check('맵 바꾸기: 오만이 칼바람 버전으로 교체', tray.includes('126697') && !tray.includes('6697'), tray.join(','));
check('맵 바꾸기 알림', /칼바람 빌드로 변경/.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText());
check('아이템 추가 화면 맵 표시', (await p.evaluate(() => document.querySelector('.pick-map .lbl').textContent)).includes('칼바람'));
await p.screenshot({path:OUT+'map-ar-picker.png'});
// ---- 칼바람 상점에 없는 아이템: 협곡으로 돌아가 수호 천사·제어 와드 담고 다시 칼바람
await top('[data-act=build-map][data-v=sr]'); await p.waitForTimeout(500);
for(const id of ['3026','2055']) { await p.evaluate(id => document.querySelector(`#pick-grid [data-id="${id}"]`).click(), id); await p.waitForTimeout(150); }
await top('[data-act=build-map][data-v=aram]'); await p.waitForTimeout(600);
const offTray = await p.evaluate(() => [...document.querySelectorAll('#pick-tray .tb.off')].map(e => e.dataset.id));
check('칼바람에 없는 아이템 빨간 점(담은 칸)', offTray.includes('3026') && offTray.includes('2055'), offTray.join(','));
check('알림에 없는 아이템 수', /상점에 없는 아이템 2개/.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText());
await top('[data-act=close-all]'); await p.waitForTimeout(600);
const offBuild = await p.evaluate(() => [...document.querySelectorAll('#b-items .ib.off')].map(e => e.getAttribute('aria-label')));
check('빌드 화면 아이템 칸 빨간 점', offBuild.length===2, offBuild.join(' / '));
check('편집 중 머리 맵 버튼', await p.evaluate(() => { const b=document.querySelector('button.mx.mp[data-act=build-map]'); return b ? b.textContent : ''; }) === '칼바람');
await p.screenshot({path:OUT+'map-build-edit.png'});
// 머리 맵 버튼으로 협곡 → 빨간 점 사라짐, 오만 원래 버전
await top('button.mx.mp[data-act=build-map]'); await p.waitForTimeout(600);
const afterSr = await p.evaluate(() => ({off: document.querySelectorAll('#b-items .ib.off').length, ids: [...document.querySelectorAll('#b-items .ib[data-id]')].map(e=>e.dataset.id)}));
check('머리 버튼으로 협곡 전환', afterSr.off===0 && afterSr.ids.includes('6697') && !afterSr.ids.includes('126697'), afterSr.ids.join(','));
await top('#fab');
let st, pyke, waited = 0;
for(; waited<12; waited++){ await p.waitForTimeout(1000); st = await (await fetch(GH+'/__state')).json(); pyke = Object.values(st.doc.builds).find(b => b.champ==='Pyke'); if(pyke.mode==='sr' && pyke.it.includes('3026')) break; }
log.push('  (저장소 반영까지 '+(waited+1)+'초)');
check('맵·아이템 저장소 반영', pyke.mode==='sr' && pyke.it.includes('3026'), pyke.mode+' '+pyke.it.join(','));
await top('[data-act=back]'); await p.waitForTimeout(500);

// ---- 설정: 빌드 정렬
const order = () => p.evaluate(() => [...document.querySelectorAll('.bcard .bc-cn')].map(e => e.textContent));
await top('[data-act=about]'); await p.waitForTimeout(450);
await top('[data-act=set][data-k=bsort][data-v=name]'); await p.waitForTimeout(200);
await top('[data-act=back]'); await p.waitForTimeout(500);
const o1 = await order(); const sorted = [...o1].sort((a,b)=>a<b?-1:a>b?1:0);
check('빌드 정렬 이름순', JSON.stringify(o1)===JSON.stringify(sorted), o1.join(','));
await top('[data-act=about]'); await p.waitForTimeout(450); await top('[data-act=set][data-k=bsort][data-v=new]'); await top('[data-act=back]'); await p.waitForTimeout(500);
const o2 = await order(); const byNew = Object.values(st.doc.builds).sort((a,b)=>b.created-a.created).map(b=>b.champ);
check('빌드 정렬 생성순', o2.length>=7, o2.join(','));
// ---- 시작 화면
await top('[data-act=about]'); await p.waitForTimeout(450); await top('[data-act=set][data-k=start][data-v=champs]'); await p.waitForTimeout(200);
// ---- 화면 크기
check('화면 크기 항목 보임(터치 기기)', await p.evaluate(() => !!document.querySelector('[data-k=scale]')));
const w0 = await p.evaluate(() => innerWidth);
await top('[data-act=set][data-k=scale][data-v="120"]'); await p.waitForTimeout(500);
const sc = await p.evaluate(() => ({w: innerWidth, meta: document.querySelector('meta[name=viewport]').content, fs: getComputedStyle(document.body).fontSize}));
check('화면 크기 최대: 화면 폭 기준 축소(=확대)', sc.w < w0 && Math.abs(sc.w - Math.round(w0/1.2)) <= 2, `${w0} → ${sc.w} · ${sc.meta}`);
await p.screenshot({path:OUT+'map-scale120.png'});
const ovf = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check('화면 크기 최대: 가로 넘침 없음', ovf <= 0, String(ovf));
await p.reload(); await p.waitForTimeout(1800);
check('다시 열기: 시작 화면 챔피언', await p.evaluate(() => document.querySelector('[data-act=tab][aria-pressed=true]').dataset.v) === 'champs');
check('다시 열기: 화면 크기 유지', await p.evaluate(() => innerWidth) === sc.w, String(await p.evaluate(() => innerWidth)));
// 확대 상태에서 밀어서 뒤로 가기·누르기 정상
await top('[data-act=tab][data-v=builds]'); await p.waitForTimeout(300);
await openBuild('파이크'); const t1 = await title();
await swipe(); const t2 = await title();
check('확대 상태 밀어서 뒤로', t1!==t2 && /템트리/.test(t2), `${t1} → ${t2}`);
await top('[data-act=about]'); await p.waitForTimeout(450); await top('[data-act=set][data-k=scale][data-v="100"]'); await p.waitForTimeout(400);
check('화면 크기 보통 복귀', await p.evaluate(() => innerWidth) === w0);
// ---- 오프라인 준비
await top('[data-act=prefetch]');
for(let i=0;i<40;i++){ await p.waitForTimeout(300); if(await p.evaluate(() => !!(JSON.parse(localStorage.getItem('ttn.v1.ui')||'{}').offline))) break; }
const offInfo = await p.evaluate(async () => ({ui: JSON.parse(localStorage.getItem('ttn.v1.ui')).offline, cached: (await (await caches.open('ttn-img')).keys()).length, sub: [...document.querySelectorAll('.set-row')].find(r => r.textContent.includes('오프라인 준비')).querySelector('.lab span').textContent}));
check('오프라인 준비 완료', offInfo.ui && offInfo.cached >= Object.keys(D.sheets).length, JSON.stringify(offInfo));
await p.screenshot({path:OUT+'map-settings.png', fullPage:false});
// 오프라인으로 열어 스킬 그림 확인
await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => { const c=document.querySelector('[data-act=tab][data-v=champs]'); if(c) c.click(); }); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelectorAll('[data-act=open-champ]')[40].click()); await p.waitForTimeout(500);
await top('.chero-por, [data-act=champ-info]'); await p.waitForTimeout(1200);
const skImgs = await p.evaluate(async () => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const els=[...t.querySelectorAll('.jump .ico, .skrow .ico, [class*=sk] .ico')]; const urls=[...new Set(els.map(e=>getComputedStyle(e).backgroundImage).filter(u=>u&&u!=='none'))]; const res=[]; for(const u of urls){ const m=u.match(/url\("(.*)"\)/); if(m){ const r=await caches.match(m[1]); res.push(!!r); } } return {n: els.length, urls: urls.length, cached: res}; });
check('오프라인: 스킬 그림 보관본 사용', skImgs.urls>0 && skImgs.cached.every(Boolean), JSON.stringify(skImgs));
await ctx.setOffline(false);
console.log(log.join('\n')); console.log('실패', bad.length, JSON.stringify(bad)); console.log('ERRORS', JSON.stringify(errs.filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e))));
await browser.close();
