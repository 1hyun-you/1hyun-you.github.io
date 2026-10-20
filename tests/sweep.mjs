/* 전체 챔피언 순회: 챔피언 화면 → 정보 페이지(능력치·스킬) → 뒤로. 오류·빈 그림·스택 꼬임 검사 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(String(e))); p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('TUNNEL')) errs.push(m.text()); });
const bad=[]; p.on('response', r => { if(r.status()>=400) bad.push(r.status()+' '+r.url()); });
await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(3500);
await p.click('[data-act=tab][data-v=champs]'); await p.waitForTimeout(300);
const ids = await p.$$eval('.ctile', els=>els.map(e=>e.dataset.id));
const probs=[];
const TP = "[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop()";
for(const id of ids){
  await p.evaluate(id=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector(`.ctile[data-id="${id}"]`).click(), id); await p.waitForTimeout(60);
  await p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.chero-por').click()); await p.waitForTimeout(80);
  const r = await p.evaluate(()=>{ const pg=[...document.querySelectorAll('#stack > .page:not(.leaving)')]; const t=pg[pg.length-1];
    const icons=[...t.querySelectorAll('.skd .sico .ico')]; const emptyIco=icons.filter(e=>!e.style.backgroundImage).length;
    return {n:pg.length, title:t.querySelector('.top-title').textContent, sk:t.querySelectorAll('.skd').length, emptyIco, none:[...t.querySelectorAll('.skd .none')].map(e=>e.closest('.skd').id).join(), stats:t.querySelectorAll('#cstats>div').length}; });
  if(r.n!==3 || r.sk<5 || r.emptyIco || r.none || r.stats<12) probs.push(id+' '+JSON.stringify(r));
  await p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('[data-act=back]').click()); await p.waitForTimeout(40);
  await p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('[data-act=back]').click()); await p.waitForTimeout(40);
}
const fin = await p.evaluate(()=>document.querySelectorAll('#stack > .page').length);
console.log('champs', ids.length, 'problems', probs.length); console.log(probs.slice(0,20).join('\n'));
console.log('final pages', fin, 'ERRORS', JSON.stringify(errs.slice(0,5)), 'HTTP', JSON.stringify(bad.filter(x=>!x.includes('fonts')).slice(0,5)));
await browser.close();
