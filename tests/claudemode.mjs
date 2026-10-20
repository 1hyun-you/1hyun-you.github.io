/* Claude 페이지 안 동작 재현: window.claude.use('db')를 흉내 내어 기존 저장 방식이 그대로인지 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch(); const errs=[];
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
await ctx.addInitScript(() => {
  const store = {builds:{'b-x':{champ:'Shaco', title:'클로드 저장 빌드', it:['3100'], runes:{p:'',pr:['','','',''],s:'',sr:[],sh:['','','']}, spells:['',''], max:'', updated:Date.now(), created:Date.now()}}, prefs:{fav:[], cdm:'sr'}};
  const subs=[]; window.__writes=[];
  const emit = () => subs.forEach(cb => cb({docs:Object.entries(store.builds).map(([id,b])=>({id, exists:true, data:()=>b})), metadata:{fromCache:false}}));
  const db = { collection(){ return {onSnapshot(cb){ subs.push(cb); setTimeout(emit, 50); }}; },
    doc(path){ const [c,id]=path.split('/'); return { set(b){ window.__writes.push(path); if(c==='builds') store.builds[id]=b; else store.prefs=b; setTimeout(emit, 30); return Promise.resolve(); }, delete(){ delete store.builds[id]; setTimeout(emit,30); return Promise.resolve(); }, onSnapshot(cb){ setTimeout(()=>cb({exists:true, data:()=>store.prefs}), 50); } }; } };
  window.claude = {use: async (k) => k==='db' ? db : null};
});
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(1800);
const top = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
console.log('목록:', await p.evaluate(() => [...document.querySelectorAll('.bcard-title')].map(e=>e.textContent).join()), '| 상태:', await p.evaluate(() => document.querySelector('.sync').dataset.s), '| 안내:', await p.evaluate(() => (document.querySelector('.banner')||{}).textContent || '없음'));
await top('[data-act=open-build]'); await p.waitForTimeout(400); await top('#fab'); await p.fill('#f-title', '클로드에서 수정'); await top('#fab'); await p.waitForTimeout(1200);
console.log('저장 호출:', await p.evaluate(() => window.__writes.join()), '| 상태:', await p.evaluate(() => document.querySelector('#stack > .page:last-of-type .sync').dataset.s));
await top('[data-act=back]'); await p.waitForTimeout(400); await top('[data-act=about]'); await p.waitForTimeout(450);
console.log('앱 링크:', await p.evaluate(() => { const a=[...document.querySelectorAll('a.btn')].find(a=>a.textContent==='설치형 앱 열기'); return a ? a.href : '없음'; }));
console.log('정보 화면 저장:', await p.evaluate(() => [...document.querySelectorAll('.kv dt')].map(d=>d.textContent+'='+d.nextElementSibling.textContent).find(x=>x.startsWith('저장'))), '| 동기화·설치 칸:', await p.evaluate(() => !!document.querySelector('#sec-sync') || [...document.querySelectorAll('.sec-t')].some(e=>e.textContent==='앱으로 설치')));
console.log('ERRORS', JSON.stringify(errs)); await browser.close();
