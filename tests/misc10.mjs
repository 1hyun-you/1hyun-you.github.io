/* 기타 흐름: 정보 페이지·복원·복사 대체 페이지·즐겨찾기 반영·Esc·바퀴 스크롤·검색 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SP='/tmp/ttn-test';
const shaco = {id:'b-shaco', champ:'Shaco', title:'샤코', mode:'aram', role:'', it:['3100','3089'], max:'E', nm:{}, runes:{p:'8100',pr:['8112','','',''],s:'',sr:[],sh:['5008','5008','5011']}, spells:['SummonerFlash','SummonerSnowball'], pin:false, patch:'26.20', created:Date.now(), updated:Date.now()};
const browser = await chromium.launch(); const log=[]; const errs=[];
const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
await ctx.addInitScript(bs => { try{ if(!localStorage.getItem('ttn.v1.local')) localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:[]}})); }catch{} try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('no'))}, configurable:true}); }catch{} }, [shaco]);
const p = await ctx.newPage(); p.on('pageerror', e=>errs.push(String(e))); p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('TUNNEL')) errs.push(m.text()); });
await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(1800);
const TOPJS = () => [...document.querySelectorAll('#stack > .page:not(.leaving)')].pop();
const title = () => p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.top-title').textContent.trim());
const clickTop = async sel => { await p.evaluate(sel=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector(sel).click(), sel); await p.waitForTimeout(450); };
await p.click('[data-act=about]'); await p.waitForTimeout(450);
log.push('정보 페이지: '+await title()+' 진동 '+await p.locator('[data-k=haptic][aria-pressed=true]').innerText());
await p.screenshot({path:SP+'/d-about.png'});
await p.click('[data-k=haptic][data-v=off]'); await p.waitForTimeout(200);
log.push('진동 끔: '+await p.locator('[data-k=haptic][aria-pressed=true]').innerText()+' 저장 '+await p.evaluate(()=>localStorage.getItem('ttn.v1.ui')));
await p.click('[data-k=haptic][data-v=on]'); await p.waitForTimeout(200);
await p.click('[data-act=restore]'); await p.waitForTimeout(450);
log.push('복원 페이지: '+await title()+' 쌓인 수 '+await p.evaluate(()=>document.querySelectorAll('#stack > .page:not(.leaving)').length));
await p.fill('#f-restore', 'abc'); await clickTop('[data-act=do-restore]');
log.push('잘못된 백업: '+await p.locator('#toast').innerText());
await clickTop('[data-act=back]'); log.push('뒤로 → '+await title());
await p.click('[data-act=about]'); await p.waitForTimeout(450);
await p.click('[data-act=backup]'); await p.waitForTimeout(450);
log.push('복사 실패 시 대체 페이지: '+await title()+' 선택됨 '+await p.evaluate(()=>{ const t=document.querySelector('#f-copy'); return document.activeElement===t && t.selectionEnd>10; }));
await p.keyboard.press('Escape'); await p.waitForTimeout(450); log.push('Esc → '+await title());
// 즐겨찾기 → 뒤로 → 홈 챔피언 탭에 별 표시
await p.click('[data-act=tab][data-v=champs]'); await p.waitForTimeout(300);
await p.click('.ctile[data-id=Shaco]'); await p.waitForTimeout(450);
await clickTop('[data-act=fav]');
await clickTop('[data-act=back]');
log.push('즐겨찾기 반영: '+await p.evaluate(()=>!!document.querySelector('.ctile[data-id=Shaco] .fav'))+' 첫 칸 '+await p.evaluate(()=>document.querySelector('.ctile').dataset.id));
// 검색
await p.fill('#q-champs', 'ㅅㅋ'); await p.waitForTimeout(300);
log.push('초성 검색: '+await p.evaluate(()=>[...document.querySelectorAll('.ctile')].slice(0,3).map(e=>e.dataset.id).join()));
await p.fill('#q-champs', ''); await p.waitForTimeout(300);
// 스크롤 위치 유지: 챔피언 목록 아래로 내린 뒤 들어갔다 나오기
await p.evaluate(()=>{ const b=[...document.querySelectorAll('#stack > .page')].pop().querySelector('.hm-pane[data-tab=champs]'); b.scrollTop=1500; }); await p.waitForTimeout(100);
const before = await p.evaluate(()=>[...document.querySelectorAll('#stack > .page')].pop().querySelector('.hm-pane[data-tab=champs]').scrollTop);
await p.evaluate(()=>{ const el=[...document.querySelectorAll('.ctile')].find(e=>e.getBoundingClientRect().top>300); el.click(); }); await p.waitForTimeout(450);
await clickTop('[data-act=back]');
log.push('목록 스크롤 유지: '+before+' → '+await p.evaluate(()=>[...document.querySelectorAll('#stack > .page')].pop().querySelector('.hm-pane[data-tab=champs]').scrollTop));
console.log(log.join('\n')); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
