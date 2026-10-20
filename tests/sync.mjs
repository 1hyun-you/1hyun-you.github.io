/* 설치형 앱 동기화 시험: 폰(A)·PC(B) 두 기기, 가짜 GitHub 저장소 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771';
const mk = (id, champ, title, it) => ({id, champ, title, it, runes:{p:'',pr:['','','',''],s:'',sr:[],sh:['','','']}, spells:['',''], max:'', created:Date.now()-1000, updated:Date.now()-1000});
await fetch(GH+'/__reset', {method:'PUT'});
const browser = await chromium.launch(); const log = []; const errs = [];
async function device(name, builds, opts){
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([bs]) => { try{ if(!localStorage.getItem('ttn.v1.gh')){ localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:[]}})); localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771'})); } }catch{} }, [builds]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name+': '+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts/.test(m.text())) errs.push(name+': '+m.text()); });
  await p.goto(SITE); await p.waitForTimeout(1500);
  return {ctx, p, name};
}
const top = (p, sel) => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
const titles = p => p.evaluate(() => [...document.querySelectorAll('.bcard-title')].map(e => e.textContent.replace('★','')).sort().join(', '));
const state = async () => (await (await fetch(GH+'/__state')).json());
async function connect(d, token){
  await top(d.p, '[data-act=about]'); await d.p.waitForTimeout(450);
  await d.p.fill('#f-token', token); await top(d.p, '[data-act=gh-on]');
  await d.p.waitForTimeout(1800);
}
async function syncNow(d){ await top(d.p, '[data-act=about]'); await d.p.waitForTimeout(400); await top(d.p, '[data-act=gh-sync]'); await d.p.waitForTimeout(1200); await top(d.p, '[data-act=back]'); await d.p.waitForTimeout(400); }
const A = await device('폰', [mk('b-a1','Shaco','샤코 칼바람',['3100'])], {viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const B = await device('PC', [mk('b-b1','Garen','가렌 탑',['3078'])], {viewport:{width:1280,height:800}});
log.push('연결 전 홈 안내(폰): '+await A.p.evaluate(() => (document.querySelector('.banner')||{}).textContent||'없음'));
await connect(A, 'wrong_token'); log.push('틀린 토큰: '+await A.p.locator('#toast').innerText());
await A.p.fill('#f-token', 'github_pat_TEST'); await top(A.p, '[data-act=gh-on]'); await A.p.waitForTimeout(2500);
let s = await state(); log.push('폰 연결 후 저장소: '+Object.values(s.doc.builds).map(b=>b.title).join(', ')+' / 상태 '+await A.p.evaluate(() => document.querySelector('.sync').dataset.s));
await connect(B, 'github_pat_TEST'); await B.p.waitForTimeout(1500);
s = await state(); log.push('PC 연결 후 저장소: '+Object.values(s.doc.builds).map(b=>b.title).sort().join(', ')+' | PC 화면: '+await titles(B.p));
await syncNow(A); log.push('폰 동기화 후 화면: '+await titles(A.p));
// PC에서 이름 바꾸기 → 폰
await B.p.evaluate(() => document.querySelector('[data-act=open-build][data-id=b-a1]').click()); await B.p.waitForTimeout(500);
await top(B.p, '#fab'); await B.p.waitForTimeout(200); await B.p.fill('#f-title', '샤코 PC에서 수정'); await top(B.p, '#fab'); await B.p.waitForTimeout(2500);
await top(B.p, '[data-act=back]'); await B.p.waitForTimeout(400);
await A.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.p.waitForTimeout(1500);
log.push('PC 수정 → 폰(앱으로 돌아올 때 확인): '+await titles(A.p));
// 폰에서 삭제 → PC
await A.p.evaluate(() => document.querySelector('[data-act=open-build][data-id=b-b1]').click()); await A.p.waitForTimeout(500);
await top(A.p, '[data-act=build-menu]'); await A.p.waitForTimeout(300);
await A.p.evaluate(() => document.querySelector('#sheet [data-act=ask-del]').click()); await A.p.waitForTimeout(200);
await A.p.evaluate(() => document.querySelector('#sheet [data-act=del-build]').click()); await A.p.waitForTimeout(2500);
await syncNow(B); log.push('폰 삭제 → PC: '+await titles(B.p));
// 동시에 서로 다른 빌드 수정 (충돌 → 합치기)
await A.p.evaluate(() => document.querySelector('[data-act=tab][data-v=champs]').click()); await A.p.waitForTimeout(300);
await A.p.evaluate(() => document.querySelector('.ctile[data-id=Ahri]').click()); await A.p.waitForTimeout(500);
await top(A.p, '[data-act=new-build]'); await A.p.waitForTimeout(500); await A.p.fill('#f-title', '아리 폰에서 새로'); await top(A.p, '#fab');
await B.p.evaluate(() => document.querySelector('[data-act=tab][data-v=champs]').click()); await B.p.waitForTimeout(300);
await B.p.evaluate(() => document.querySelector('.ctile[data-id=Lux]').click()); await B.p.waitForTimeout(500);
await top(B.p, '[data-act=new-build]'); await B.p.waitForTimeout(500); await B.p.fill('#f-title', '럭스 PC에서 새로'); await top(B.p, '#fab');
await A.p.waitForTimeout(3500);
s = await state(); log.push('동시 저장 후 저장소: '+Object.values(s.doc.builds).map(b=>b.title).sort().join(', ')+' (올림 '+s.puts+'회)');
for(const d of [A,B]){ await top(d.p, '[data-act=back]'); await d.p.waitForTimeout(300); await top(d.p, '[data-act=back]'); await d.p.waitForTimeout(300); await d.p.evaluate(() => document.querySelector('[data-act=tab][data-v=builds]').click()); }
await syncNow(A); await syncNow(B);
log.push('합친 뒤 폰: '+await titles(A.p)+' | PC: '+await titles(B.p));
// 오프라인 수정 → 연결 후 자동 올림
await A.ctx.setOffline(true);
await A.p.evaluate(() => document.querySelector('[data-act=open-build]').click()); await A.p.waitForTimeout(400);
await top(A.p, '#fab'); await A.p.fill('#f-title', '오프라인 수정'); await top(A.p, '#fab'); await A.p.waitForTimeout(2500);
log.push('오프라인 상태 표시: '+await A.p.evaluate(() => document.querySelector('#stack > .page:last-of-type .sync').dataset.s));
await A.ctx.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event('online'))); await A.p.waitForTimeout(2500);
s = await state(); log.push('다시 연결 후 저장소에 반영: '+Object.values(s.doc.builds).some(b=>b.title==='오프라인 수정')+' 상태 '+await A.p.evaluate(() => document.querySelector('#stack > .page:last-of-type .sync').dataset.s));
log.push('요청 수: 받기 '+s.gets+' (변화 없음 응답 '+s.n304+') · 올리기 '+s.puts);
// 정보 화면 동기화 영역
await top(A.p, '[data-act=back]'); await A.p.waitForTimeout(400); await top(A.p, '[data-act=about]'); await A.p.waitForTimeout(450);
log.push('정보 화면: '+(await A.p.locator('#sec-sync').innerText()).replace(/\n/g,' / '));
await A.p.screenshot({path:'/tmp/ttn-test/g-about.png'});
console.log(log.join('\n')); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
