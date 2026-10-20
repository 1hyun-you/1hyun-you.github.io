/* 밀어서 뒤로·기록(뒤로/앞으로)·마우스 옆 버튼 검사: claude.ai처럼 다른 출처 iframe 안에서, CDP 터치로 실제 손가락 움직임 재현 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SP='/tmp/ttn-test';
const shaco = {id:'b-shaco', champ:'Shaco', title:'샤코', mode:'aram', role:'', it:['3100','3089','3020','6653'], max:'E', nm:{}, runes:{p:'8100',pr:['8112','','',''],s:'',sr:[],sh:['5008','5008','5011']}, spells:['SummonerFlash','SummonerSnowball'], pin:false, patch:'26.20', created:Date.now(), updated:Date.now()};
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
await ctx.addInitScript(bs => { window.__vib=[]; try{ Object.defineProperty(navigator,'vibrate',{value:p=>{ window.__vib.push(p); return true; }, configurable:true}); }catch{} try{ if(location.port==='8765' && !localStorage.getItem('ttn.v1.local')) localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:[]}})); }catch{} }, [shaco]);
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('TUNNEL')) errs.push(m.text()); });
await p.goto('http://127.0.0.1:8766/'); await p.waitForTimeout(2200);
const f = p.frameLocator('#f'); const fr = () => p.frames().find(x=>x.url().includes('8765'));
fr().on?.('pageerror', e=>errs.push(String(e)));
const state = async () => fr().evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].map(pg=>((pg.querySelector('.top-title')||{}).textContent||'').trim()).join(' > ') + ((document.querySelector('#sheet') && !document.querySelector('#sheet').hidden) ? ' + 메뉴' : ''));
const log={push:x=>console.log(x)}; const W = ms => p.waitForTimeout(ms);
const hb = () => p.evaluate(()=>history.back()), hf = () => p.evaluate(()=>history.forward());
const TOP = '#stack > .page:not(.leaving):last-of-type';
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints:pts});
/* path: [[x,y,ms]...] — 각 점까지 ms 동안 이동. 이벤트 시각을 직접 지정해 실제 손가락 속도를 재현 (CDP 왕복 지연 영향 없음) */
let VT = 0;
async function gesture(path, {wait=450, keep=false}={}){
  VT = Math.max(VT, Date.now()/1000);
  let [x,y] = path[0]; await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y}], timestamp:VT});
  for(const [nx,ny,ms] of path.slice(1)){
    const steps = Math.max(1, Math.round(ms/16));
    for(let i=1;i<=steps;i++){ VT += ms/steps/1000; await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:x+(nx-x)*i/steps, y:y+(ny-y)*i/steps}], timestamp:VT}); }
    x = nx; y = ny;
  }
  if(keep) return;
  VT += 0.008; await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[], timestamp:VT}); await W(wait);
}
const openBuild = async () => { await f.locator(TOP+' [data-act=open-build]').first().click(); await W(450); };
log.push('시작: '+await state());
// 1. 빠르게 짧게 튕기기 (60px, 약 70ms)
await openBuild();
await gesture([[200,500],[260,505,70]]); log.push('짧게 튕기기(60px 빠르게) → '+await state());
// 2. 천천히 짧게 (60px, 700ms) → 취소
await openBuild();
await gesture([[200,500],[260,505,700]]); log.push('천천히 짧게(60px) → '+await state()+' 원위치 '+await fr().evaluate(()=>{ const pg=[...document.querySelectorAll('#stack > .page')].pop(); return getComputedStyle(pg).transform; }));
// 3. 천천히 길게 (150px, 900ms) → 넘어감
await gesture([[150,500],[300,505,900]]); log.push('천천히 길게(150px) → '+await state());
// 4. 엄지 대각선 (오른쪽 80, 위로 55, 120ms)
await openBuild();
await gesture([[230,620],[310,565,120]]); log.push('대각선 엄지 밀기 → '+await state());
// 5. 세로 스크롤 시도 → 이동 없음
await openBuild();
await gesture([[200,600],[215,350,250]]); log.push('세로로 밀기 → '+await state());
// 6. 오른쪽으로 많이 밀었다가 왼쪽으로 되돌리며 놓기 → 취소
await gesture([[100,500],[300,500,300],[250,500,40]]); log.push('밀었다 되돌리기 → '+await state());
// 7. 밀기 도중: 아래 페이지가 보이는지
const por = await fr().evaluate(()=>{ const b=document.querySelector('#stack > .page:last-of-type .bh-por').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]; });
await f.locator('.ib[data-act=item-info]').first().click(); await W(450);
await gesture([[120,400],[300,400,400]], {keep:true});
log.push('밀기 도중: '+await fr().evaluate(()=>{ const pgs=[...document.querySelectorAll('#stack > .page')]; const u=pgs[pgs.length-2], t=pgs[pgs.length-1]; return '아래 '+getComputedStyle(u).visibility+' x='+Math.round(new DOMMatrix(getComputedStyle(u).transform).m41)+' 위 x='+Math.round(new DOMMatrix(getComputedStyle(t).transform).m41)+' 어둡게 '+getComputedStyle(u.querySelector('.pg-dim')).opacity; }));
await p.screenshot({path:SP+'/c-midswipe.png'});
VT += 0.008; await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[], timestamp:VT});
// 8. 손을 뗀 직후 누름이 먹히지 않는지 (예전 문제: 밀기 뒤 첫 누름이 사라짐) — 움직임이 끝난 0.3초 뒤 초상화 누름
const t0 = Date.now(); await W(300);
VT = Math.max(VT+0.01, Date.now()/1000); await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:por[0], y:por[1]}], timestamp:VT}); VT += 0.06; await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[], timestamp:VT});
await W(500); log.push('밀어서 뒤로 간 뒤 첫 누름(초상화) → '+await state());
await gesture([[150,400],[260,400,60]]); log.push('정보 페이지에서 튕기기 → '+await state());
// 9. 편집 중 아이템 칸에서 시작 → 밀기 아님(끌기)
await f.locator('#fab').click(); await W(300);
const it = await fr().evaluate(()=>{ const b=document.querySelector('.igrid .ib[data-drag]').getBoundingClientRect(); return [b.x+b.width/2,b.y+b.height/2]; });
await gesture([[it[0],it[1]],[it[0]+120,it[1]+4,200]]); log.push('편집 중 아이템에서 밀기 → '+await state()+' 순서 '+await fr().evaluate(()=>[...document.querySelectorAll('.igrid .ib[data-drag]')].map(e=>e.dataset.id).join(',')));
// 10. 아이템 추가 페이지: 트레이에서 시작한 밀기는 끌기
await f.locator('.ib.add').click(); await W(600);
const tr = await fr().evaluate(()=>{ const b=document.querySelector('.tray .tb').getBoundingClientRect(); return [b.x+b.width/2,b.y+b.height/2]; });
await gesture([[tr[0],tr[1]],[tr[0]+90,tr[1]+2,150]]); log.push('트레이에서 밀기 → '+await state());
await gesture([[150,600],[230,600,70]]); log.push('목록에서 튕기기 → '+await state());
await f.locator('#fab').click(); await W(300);
// 11. 메뉴: 아래로 끌어 닫기
await f.locator('[data-act=build-menu]').click(); await W(350);
const mh = await fr().evaluate(()=>{ const b=document.querySelector('#sheet .sheet-h').getBoundingClientRect(); return [b.x+60,b.y+b.height/2]; });
await gesture([[mh[0],mh[1]],[mh[0],mh[1]+70,80]]); log.push('메뉴 빠르게 끌어내림 → '+await state());
// 12. 기록: 밀어서 뒤로 간 뒤에도 브라우저 뒤로·앞으로가 맞는지
await f.locator('.ib[data-act=item-info]').first().click(); await W(450);
log.push('아이템 열기: '+await state());
await gesture([[150,400],[260,400,60]]); log.push('밀어서 뒤로: '+await state());
await hb(); await W(450); log.push('브라우저 뒤로: '+await state());
await hf(); await W(450); log.push('브라우저 앞으로: '+await state());
await hf(); await W(450); log.push('브라우저 앞으로: '+await state());
await hb(); await W(150); await hb(); await W(500); log.push('빠르게 뒤로 2번: '+await state());
await openBuild(); await f.locator('.ib[data-act=item-info]').first().click(); await W(450);
await f.locator(TOP+' [data-act=back]').click(); await W(50); await f.locator(TOP+' [data-act=back]').click(); await W(500);
log.push('앱 뒤로 버튼 빠르게 2번: '+await state());
await hf(); await W(450); log.push('브라우저 앞으로: '+await state());
await fr().evaluate(()=>{ for(const t of ['mousedown','mouseup']) document.body.dispatchEvent(new MouseEvent(t,{button:3,bubbles:true,cancelable:true})); }); await W(450);
log.push('마우스 뒤로 버튼: '+await state());
await fr().evaluate(()=>{ for(const t of ['mousedown','mouseup']) document.body.dispatchEvent(new MouseEvent(t,{button:4,bubbles:true,cancelable:true})); }); await W(450);
log.push('마우스 앞으로 버튼: '+await state());
await hb(); await W(450); log.push('브라우저 뒤로: '+await state());
log.push('진동 '+await fr().evaluate(()=>JSON.stringify(window.__vib)));
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
