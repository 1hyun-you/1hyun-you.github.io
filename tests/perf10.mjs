/* 반응 속도 측정 (CPU 6배 감속 = 폰 수준): 누름 → 화면 반영 시간, 긴 작업(50ms 초과), 밀기 중 프레임 간격 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SP='/tmp/ttn-test';
const ex = JSON.parse(fs.readFileSync(SP+'/example.json','utf8'));
const build = Object.assign({id:'example-garen'}, ex);
const shaco = {id:'b-shaco', champ:'Shaco', title:'샤코 칼바람', mode:'aram', role:'', it:['3100','6653','3089','3020','4645','3157'], max:'E', nm:{}, runes:{p:'8100',pr:['8112','8139','8138','8105'],s:'8300',sr:['8304','8347'],sh:['5008','5008','5011']}, spells:['SummonerFlash','SummonerSnowball'], pin:true, patch:'26.20', created:Date.now()-86400000, updated:Date.now()-3600000};
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2.6, isMobile:true, hasTouch:true, colorScheme:'dark'});
await ctx.addInitScript(bs => { try{ if(!localStorage.getItem('ttn.v1.local')) localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:[]}})); }catch{} }, [build, shaco]);
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', {rate:6});
await p.evaluate(()=>{ window.__lt=[]; try{ new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(e.duration))).observe({type:'longtask', buffered:false}); }catch{} });
const TOP = '#stack > .page:not(.leaving):last-of-type';
async function tap(sel, label){
  await p.evaluate(()=>{ window.__lt.length=0; });
  const t = await p.evaluate(async (sel)=>{ const el=document.querySelector(sel); if(!el) return -1; const t0=performance.now(); el.click(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return performance.now()-t0; }, sel);
  await p.waitForTimeout(900);
  const lt = await p.evaluate(()=>window.__lt.slice());
  return `${label.padEnd(12)} ${t<0?'없음':Math.round(t)+'ms'}  긴 작업 ${lt.length}개${lt.length?' (최대 '+Math.round(Math.max(...lt))+'ms)':''}`;
}
/* 밀기: 16ms 간격으로 손가락 이동, 그동안 프레임 간격 측정 */
let VT = 0;
async function swipe(label, x0, x1, n=20){
  await p.evaluate(()=>{ window.__lt.length=0; window.__fr=[]; window.__run=true; const f=t=>{ window.__fr.push(t); if(window.__run) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  VT = Math.max(VT, Date.now()/1000);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:420}],timestamp:VT});
  for(let i=1;i<=n;i++){ VT += .016; await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/n,y:420}],timestamp:VT}); await p.waitForTimeout(16); }
  VT += .016; await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[],timestamp:VT});
  await p.waitForTimeout(700);
  const r = await p.evaluate(()=>{ window.__run=false; const f=window.__fr; const g=[]; for(let i=1;i<f.length;i++) g.push(f[i]-f[i-1]); g.sort((a,b)=>a-b); return {lt:window.__lt.slice(), p50:g[Math.floor(g.length/2)], p95:g[Math.floor(g.length*.95)], max:g[g.length-1]}; });
  return `${label.padEnd(12)} 프레임 간격 중간 ${Math.round(r.p50)}ms · 95% ${Math.round(r.p95)}ms · 최대 ${Math.round(r.max)}ms  긴 작업 ${r.lt.length}개${r.lt.length?' (최대 '+Math.round(Math.max(...r.lt))+'ms)':''}`;
}
const out=[];
out.push(await tap('[data-act=open-build][data-id=b-shaco]','빌드 열기'));
out.push(await swipe('밀어서 홈', 120, 330));
out.push(await tap('[data-act=open-build][data-id=b-shaco]','빌드 다시'));
out.push(await tap(TOP+' #fab','편집 시작'));
out.push(await tap('.sp[data-v=sp0]','주문 팝업'));
out.push(await tap('[data-act=spell-pick][data-v=SummonerHeal]','주문 선택'));
out.push(await tap('[data-act=pop-close]','팝업 닫기'));
out.push(await tap('.mx','선마 팝업'));
out.push(await tap('.mxo[data-k=Q]','선마 선택'));
out.push(await tap('[data-act=rune][data-role=pri][data-slot="1"]','룬 선택'));
out.push(await tap('[data-act=rune][data-role=shard][data-row="1"]','파편 선택'));
out.push(await tap('.ib.add','아이템 추가'));
out.push(await tap('#pick-grid .pit:nth-child(3)','아이템 담기'));
out.push(await tap('#pick-grid .pit:nth-child(3)','아이템 빼기'));
out.push(await tap('#pick-grid .pit:nth-child(5)','아이템 담기2'));
out.push(await tap('[data-act=pick-stat][data-v=ap]','필터 켜기'));
out.push(await swipe('추가→빌드 밀기', 120, 330));
out.push(await tap('.ib[data-act=item-info]','아이템 정보'));
out.push(await tap(TOP+' .top [data-act=back]','뒤로 버튼'));
out.push(await tap('.bh-por','챔피언 정보'));
const hasRange = await p.evaluate(()=>!!document.querySelector('#calc-lvl'));
if(hasRange){
  await p.evaluate(()=>{ window.__lt.length=0; });
  const t = await p.evaluate(async ()=>{ const r=document.querySelector('#calc-lvl'); const t0=performance.now(); for(let v=1; v<=18; v++){ r.value=v; r.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(res=>requestAnimationFrame(res)); } return (performance.now()-t0)/18; });
  const lt = await p.evaluate(()=>window.__lt.slice());
  out.push(`${'레벨 끌기'.padEnd(12)} 1단계 평균 ${Math.round(t)}ms  긴 작업 ${lt.length}개`);
}
out.push(await swipe('정보→빌드 밀기', 120, 330));
out.push(await tap(TOP+' #fab','편집 완료'));
out.push(await swipe('빌드→홈 밀기', 120, 330));
out.push(await tap('[data-act=tab][data-v=champs]','챔피언 탭'));
out.push(await tap('[data-act=open-champ][data-id=Shaco]','챔피언 열기'));
out.push(await swipe('챔피언→홈', 120, 330));
console.log(out.join('\n')); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
