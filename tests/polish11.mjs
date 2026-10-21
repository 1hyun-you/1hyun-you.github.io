/* Version 11 다듬기 확인 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SP='/tmp/ttn-test';
const longT = {id:'b-long', champ:'Kaisa', title:'카이사 원딜', mode:'sr', role:'', it:['3031','3006','3124','3085','3094','3046','6672','3036','3072','3153'], max:'Q', nm:{}, runes:{p:'8000',pr:['8008','9111','9104','8014'],s:'8100',sr:['8143','8135'],sh:['5005','5008','5011']}, spells:['SummonerFlash','SummonerHeal'], pin:false, patch:'26.20', created:Date.now(), updated:Date.now()};
const browser = await chromium.launch(); const log=[]; const errs=[];
const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, colorScheme:'dark'});
await ctx.addInitScript(bs => { try{ if(!localStorage.getItem('ttn.v1.local')) localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:[]}})); }catch{} }, [longT]);
const p = await ctx.newPage(); p.on('pageerror', e=>errs.push(String(e))); p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('TUNNEL')) errs.push(m.text()); });
await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(1800);
const top = sel => p.evaluate(sel=>{ const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
const title = () => p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.top-title').textContent.trim());
log.push('카드 +개수: '+await p.evaluate(()=>[...document.querySelectorAll('.bc-items .bi')].length+'칸, 마지막 '+document.querySelector('.bc-items .bi:last-child').textContent));
await p.screenshot({path:SP+'/e-home.png'});
await top('[data-act=tab][data-v=champs]'); await p.waitForTimeout(250); await p.screenshot({path:SP+'/e-champs.png'});
log.push('칩 줄 끝 위치: '+await p.evaluate(()=>{ const c=document.querySelector('#home-filters'); const r=c.getBoundingClientRect(); return Math.round(r.left)+'~'+Math.round(r.right); }));
await top('[data-act=tab][data-v=builds]'); await p.waitForTimeout(200);
await top('[data-act=open-build]'); await p.waitForTimeout(450);
await top('.sp'); await p.waitForTimeout(450);
log.push('주문 정보: '+await p.evaluate(()=>[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop().querySelector('.idet .small').textContent));
await top('[data-act=back]'); await p.waitForTimeout(450);
await top('#fab'); await p.waitForTimeout(300);
// 팝업 열고 브라우저 뒤로 → 팝업만 닫힘
await top('.sp[data-v=sp0]'); await p.waitForTimeout(250);
await p.evaluate(()=>history.back()); await p.waitForTimeout(450);
log.push('팝업 + 뒤로: 팝업 '+(await p.locator('#pop').count())+'개, 화면 '+await title()+', 기록 '+await p.evaluate(()=>JSON.stringify(history.state)));
await p.evaluate(()=>history.back()); await p.waitForTimeout(450);
log.push('한 번 더 뒤로: '+await title());
await top('[data-act=open-build]'); await p.waitForTimeout(450); await top('#fab'); await p.waitForTimeout(300);
await top('.mx'); await p.waitForTimeout(250);
await p.evaluate(()=>{ for(const t of ['mousedown','mouseup']) document.body.dispatchEvent(new MouseEvent(t,{button:3,bubbles:true,cancelable:true})); }); await p.waitForTimeout(300);
log.push('팝업 + 마우스 뒤로: 팝업 '+(await p.locator('#pop').count())+'개, 화면 '+await title());
// 끌기 중 원래 자리 흐린 자국
const a = await p.locator('.igrid .ib[data-drag] >> nth=0').boundingBox();
await p.mouse.move(a.x+20,a.y+20); await p.mouse.down(); await p.mouse.move(a.x+60,a.y+22,{steps:4}); await p.waitForTimeout(100);
log.push('끌기 자국: '+await p.evaluate(()=>{ const t=document.querySelector('.igrid .ph'); const cs=getComputedStyle(t); return cs.visibility+' '+cs.opacity; }));
await p.screenshot({path:SP+'/e-drag.png'});
await p.mouse.up(); await p.waitForTimeout(300);
// 아이템 추가: 조건 없을 때 빈 줄 없음, 조건 있을 때 개수
await top('.ib.add'); await p.waitForTimeout(600);
log.push('위 줄 표시: '+await p.evaluate(()=>getComputedStyle(document.querySelector('#ifbar-pk')).display));
await top('[data-act=pick-stat][data-v=ap]'); await p.waitForTimeout(200);
log.push('주문력 필터: '+await p.evaluate(()=>document.querySelector('#rail-pk [data-v=ap]').getAttribute('aria-pressed')+' '+document.querySelectorAll('#pick-grid .pit').length));
await p.screenshot({path:SP+'/e-picker.png'});
await top('[data-act=pick-reset]'); await p.waitForTimeout(200);
await top('.pg-f [data-act=close-all]'); await p.waitForTimeout(400);
// 저장 알림 직후 메뉴 → 알림 치워짐, 삭제 버튼 색
await top('#fab'); await p.waitForTimeout(150);
log.push('알림 표시: '+!(await p.locator('#toast').isHidden()));
await top('[data-act=build-menu]'); await p.waitForTimeout(350);
log.push('메뉴 뜬 뒤 알림 숨김: '+await p.locator('#toast').isHidden());
await p.evaluate(()=>document.querySelector('#sheet [data-act=ask-del]').click()); await p.waitForTimeout(250);
log.push('삭제 버튼 색: '+await p.evaluate(()=>{ const b=document.querySelector('.btn.danger-fill'); const cs=getComputedStyle(b); return cs.color+' on '+cs.backgroundColor; }));
await p.screenshot({path:SP+'/e-confirm.png'});
console.log(log.join('\n')); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
