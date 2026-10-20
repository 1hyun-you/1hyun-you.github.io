/* 화면 크기(보통·최대)에서 아이템 끌어 옮기기·누르기 정상 여부 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771';
const browser = await chromium.launch(); const errs = [];
for(const scale of [100, 120, 90]){
  await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
  const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
  await ctx.addInitScript(s => { try{ if(!localStorage.getItem('ttn.v1.gh')){ localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); localStorage.setItem('ttn.v1.ui', JSON.stringify({scale:s})); } }catch{} }, scale);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(''+e));
  const cdp = await ctx.newCDPSession(p); let VT = Date.now()/1000;
  const send = (type, pts, dt=.016) => { VT += dt; return cdp.send('Input.dispatchTouchEvent', {type, touchPoints:pts, timestamp:VT}); };
  await p.goto(SITE); await p.waitForTimeout(1800);
  const vv = await p.evaluate(() => ({w: innerWidth, s: visualViewport.scale}));
  const center = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const r=t.querySelector(sel).getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }, sel);
  const tap = async sel => { const c = await center(sel); await send('touchStart', [{x:c.x, y:c.y}]); await send('touchEnd', [], .05); await p.waitForTimeout(600); };
  await tap('.bcard');
  const t1 = await p.evaluate(() => [...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.top-title').textContent);
  const fabInfo = await p.evaluate(() => { const f=document.querySelector('#stack > .page:last-child #fab') || document.querySelector('#fab'); const r=f.getBoundingClientRect(); const s=visualViewport.scale; return {r:[r.left,r.top,r.width,r.height].map(Math.round), vv:[visualViewport.offsetLeft, visualViewport.offsetTop, visualViewport.width, visualViewport.height].map(Math.round), ih: innerHeight, s}; });
  await tap('#fab'); await p.waitForTimeout(200);
  const ed = await p.evaluate(() => !!document.querySelector('.edit, .page .app.edit, body.editing') + ' ' + (document.querySelector('#fab')||{}).textContent);
  console.log('fab', JSON.stringify(fabInfo), '편집', ed);
  const before = await p.evaluate(() => [...document.querySelectorAll('#b-items .ib[data-drag]')].map(e=>e.dataset.id));
  const a = await center('#b-items .ib[data-drag]:nth-child(1)'), b = await center('#b-items .ib[data-drag]:nth-child(3)');
  await send('touchStart', [{x:a.x, y:a.y}]); await p.waitForTimeout(450); VT += .45;
  for(let i=1;i<=12;i++) await send('touchMove', [{x:a.x+(b.x-a.x)*i/12+2, y:a.y+(b.y-a.y)*i/12}]);
  await p.waitForTimeout(150); VT += .15; await send('touchEnd', []); await p.waitForTimeout(500);
  const after = await p.evaluate(() => [...document.querySelectorAll('#b-items .ib[data-drag]')].map(e=>e.dataset.id));
  console.log(`화면 크기 ${scale}% · 폭 ${vv.w} 배율 ${vv.s} · 누르기 → ${t1.trim()} · 끌기 ${before.slice(0,3).join(',')} → ${after.slice(0,3).join(',')} · ${before[0]!==after[0] && after.indexOf(before[0])===2 ? '정상' : '확인 필요'}`);
  await ctx.close();
}
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
