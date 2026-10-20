/* Version 10 회귀 검사: 전체 페이지 구조, 정보 페이지, 편집, 팝업, 끌기(진동), 아이템 추가, 메뉴, 삭제·되돌리기, 제목 변경 반영 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SP='/tmp/ttn-test';
const ex = JSON.parse(fs.readFileSync(SP+'/example.json','utf8'));
const build = Object.assign({id:'example-garen'}, ex);
const shaco = {id:'b-shaco', champ:'Shaco', title:'샤코 칼바람', mode:'aram', role:'', it:['3100','6653','3089','3020','4645'], max:'E', nm:{}, runes:{p:'8100',pr:['8112','8139','8138','8105'],s:'8300',sr:['8304','8347'],sh:['5008','5008','5011']}, spells:['SummonerFlash','SummonerSnowball'], pin:true, patch:'26.19', created:Date.now()-86400000, updated:Date.now()-3600000};
const browser = await chromium.launch();
const errs=[]; const log=[]; const bad=[];
async function page(opts, scheme){
  const ctx = await browser.newContext({...opts, colorScheme: scheme});
  await ctx.addInitScript(bs => { window.__vib=[]; try{ Object.defineProperty(navigator,'vibrate',{value:p=>{ window.__vib.push(p); return true; }, configurable:true}); }catch{} try{ if(!localStorage.getItem('ttn.v1.local')) localStorage.setItem('ttn.v1.local', JSON.stringify({builds:bs, prefs:{fav:['Garen']}})); }catch{} }, [build, shaco]);
  const p = await ctx.newPage(); p.on('pageerror', e=>errs.push(String(e))); p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('TUNNEL')) errs.push(m.text()); });
  p.on('response', r => { if(r.status()>=400) bad.push(r.status()+' '+r.url()); });
  await p.goto('http://127.0.0.1:8765/wrap.html'); await p.waitForTimeout(1500); return p;
}
const TOP = '#stack > .page:not(.leaving):last-of-type';
const stack = p => p.evaluate(()=>[...document.querySelectorAll('#stack > .page')].map(pg=>((pg.classList.contains('under')?'u':pg.classList.contains('deep')?'d':pg.classList.contains('leaving')?'x':'T'))+':'+((pg.querySelector('.top-title')||{}).textContent||'').trim()).join(' / '));
const topH = p => p.evaluate(()=>{ const pgs=[...document.querySelectorAll('#stack > .page')]; const t=pgs[pgs.length-1].getBoundingClientRect(); return Math.round(t.height)+'/'+innerHeight; });
const back = async p => { await p.click(TOP+' .top [data-act=back]'); await p.waitForTimeout(400); };
const vib = p => p.evaluate(()=>{ const v=window.__vib.slice(); window.__vib.length=0; return JSON.stringify(v); });
async function drag(p, from, to){
  const a = await p.locator(from).boundingBox(), b = await p.locator(to).boundingBox();
  await p.mouse.move(a.x+a.width/2, a.y+a.height/2); await p.mouse.down();
  for(let i=1;i<=8;i++){ await p.mouse.move(a.x+a.width/2+(b.x-a.x)*i/8, a.y+a.height/2+(b.y-a.y)*i/8); await p.waitForTimeout(30); }
  await p.mouse.up(); await p.waitForTimeout(450);
}
const pos = p => p.evaluate(()=>{ const sc=document.querySelector('#stack > .page:last-of-type .pg-b'); return [...document.querySelectorAll('#bv > .card, #bv > .bh, .spl')].map(e=>Math.round(e.getBoundingClientRect().top+sc.scrollTop)).join(','); });
const mob = {viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true};
let p = await page(mob,'dark');
log.push('홈: '+await stack(p));
await p.click('[data-act=open-build][data-id=b-shaco]');
log.push('빌드 열기 직후 움직임: '+await p.evaluate(()=>document.getAnimations().map(a=>Math.round(a.effect.getTiming().duration)).join(',')));
await p.waitForTimeout(500);
log.push('빌드: '+await stack(p));
// 아이템 정보 (전체 페이지)
await p.click('.igrid .ib >> nth=0'); await p.waitForTimeout(450);
log.push('아이템 페이지: '+await stack(p)+' 높이 '+await topH(p)+' 아래 버튼 숨김 '+await p.locator(TOP+' .pg-f').isHidden()+' 능력치 '+await p.locator(TOP+' .stat-col li').count());
await p.click(TOP+' [data-act=tree-toggle]'); await p.waitForTimeout(250);
log.push('하위 트리 노드 '+await p.locator(TOP+' .tree .tn').count());
await p.click(TOP+' .tree button.tn >> nth=0'); await p.waitForTimeout(450);
log.push('하위 아이템 페이지: '+await stack(p)+' 트리 펼침 유지 '+await p.locator(TOP+' .tgl').getAttribute('aria-expanded')+' 모두 닫기 버튼 '+await p.locator(TOP+' [data-act=close-all]').count());
await back(p); log.push('뒤로: '+await stack(p));
await back(p); log.push('뒤로: '+await stack(p));
// 룬·주문 정보
await p.click('.ro.key.on'); await p.waitForTimeout(450); log.push('룬 페이지 높이 '+await topH(p)); await back(p);
await p.click('.sp >> nth=0'); await p.waitForTimeout(450); log.push('주문 페이지: '+(await p.locator(TOP+' .idet h3').innerText())); await back(p);
// 초상화 → 챔피언 정보
await p.click('.bh-por'); await p.waitForTimeout(900);
log.push('챔피언 정보: 칼바람 '+(await p.locator(TOP+' .amod').count())+'개 · 스킬 '+await p.locator(TOP+' .skd').count()+' · 스킬 그림 '+JSON.stringify(await p.evaluate(()=>[...new Set([...document.querySelectorAll('.sico .ico')].map(e=>e.style.backgroundImage.replace(/^url\("?|\?.*$/g,'')))])));
await p.screenshot({path:SP+'/b-champ.png'});
await p.click(TOP+' .jump [data-to=sk-E]'); await p.waitForTimeout(800);
log.push('E로 이동 표시: '+await p.evaluate(()=>[...document.querySelectorAll('.jump button[aria-current=true]')].map(b=>b.dataset.to).join()));
await back(p);
await p.click('.mx'); await p.waitForTimeout(900);
log.push('선마 칩 → 스킬 위치 '+await p.evaluate(()=>{ const pgs=[...document.querySelectorAll('#stack > .page')]; return pgs[pgs.length-1].querySelector('.pg-b').scrollTop; }));
await back(p);
// 편집: 자리 고정
const pv = await pos(p); await p.click('#fab'); await p.waitForTimeout(300); const pe = await pos(p);
log.push('열람/편집 위치 같음 '+(pv===pe)+' ('+pv+')');
log.push('편집 진동 '+await vib(p));
await p.click('.mx'); await p.waitForTimeout(250);
log.push('선마 팝업 '+await p.evaluate(()=>{ const r=document.querySelector('#pop').getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width)].join(',')+(r.width>=200&&r.right<=innerWidth&&r.left>=0?' OK':' BAD'); })+' 위치 유지 '+((await pos(p))===pe));
await p.click('.mxo[data-k=Q]'); await p.waitForTimeout(200);
await p.click('.sp >> nth=1'); await p.waitForTimeout(250);
log.push('주문 팝업 '+await p.evaluate(()=>{ const r=document.querySelector('#pop').getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width)].join(',')+(r.width>=200&&r.right<=innerWidth&&r.left>=0?' OK':' BAD'); }));
await p.click('.pop-bg', {position:{x:20,y:760}}); await p.waitForTimeout(250);
log.push('팝업 닫힘 '+((await p.locator('#pop').count())===0)); await vib(p);
// 끌어서 순서 바꾸기 + 칸마다 진동
const before = await p.$$eval('.igrid .ib[data-drag]', els=>els.map(e=>e.dataset.id));
await drag(p, '.igrid .ib[data-drag] >> nth=0', '.igrid .ib[data-drag] >> nth=3');
const after = await p.$$eval('.igrid .ib[data-drag]', els=>els.map(e=>e.dataset.id));
log.push('끌기 '+before.join(',')+' → '+after.join(',')+' 진동 '+await vib(p)+' 페이지 열림? '+(await stack(p)));
// 편집 중 아이템 → 빼기
await p.click('.igrid .ib[data-drag] >> nth=1'); await p.waitForTimeout(450);
log.push('아이템 페이지 버튼: '+await p.locator(TOP+' .pg-f').innerText());
await p.click(TOP+' .pg-f [data-act=item-toggle]'); await p.waitForTimeout(450);
log.push('뺀 뒤 '+await p.locator('.igrid .ib[data-drag]').count()+'개 '+await stack(p)+' 알림 '+await p.locator('#toast').innerText());
await p.click('[data-act=toast-act]'); await p.waitForTimeout(250);
log.push('되돌린 뒤 '+await p.locator('.igrid .ib[data-drag]').count());
// 아이템 추가 페이지
await p.click('.ib.add'); await p.waitForTimeout(600);
log.push('아이템 추가: '+await stack(p)+' 높이 '+await topH(p)+' 트레이 '+await p.locator('.tray .tb').count()+' 목록 '+await p.locator('#pick-grid .pit').count());
const tb = await p.$$eval('.tray .tb', els=>els.map(e=>e.dataset.id)); await vib(p);
await drag(p, '.tray .tb >> nth=4', '.tray .tb >> nth=0');
log.push('트레이 끌기 '+tb.join(',')+' → '+(await p.$$eval('.tray .tb', els=>els.map(e=>e.dataset.id))).join(',')+' 진동 '+await vib(p));
await p.click('.tray .tb >> nth=0'); await p.waitForTimeout(200);
await p.click('#pick-grid .pit >> nth=0'); await p.waitForTimeout(200);
log.push('트레이 '+await p.locator('.tray .tb').count());
await p.click(TOP+' .pg-f [data-act=pick-info]'); await p.waitForTimeout(450);
log.push('추가 → 정보: '+await stack(p)+' 버튼 '+await p.locator(TOP+' .pg-f').innerText());
await p.click(TOP+' .pg-f [data-act=item-toggle]'); await p.waitForTimeout(450);
log.push('정보에서 빼고 돌아옴: '+await stack(p)+' 트레이 '+await p.locator('.tray .tb').count()+' 체크 '+await p.locator('#pick-grid .pit.in').count());
await p.click(TOP+' .pg-f [data-act=close-all]'); await p.waitForTimeout(450);
log.push('완료: '+await stack(p)+' 빌드 아이템 '+await p.locator('.igrid .ib[data-drag]').count());
// 제목 바꾸고 뒤로 → 목록 카드에 반영
await p.fill('#f-title', '샤코 새 이름'); await p.waitForTimeout(150);
await p.click('#fab'); await p.waitForTimeout(300);
await back(p);
log.push('목록 카드 제목: '+(await p.locator('.bcard-title >> nth=0').innerText())+' | '+await stack(p));
// 메뉴 (아래 작은 메뉴)
await p.click('[data-act=open-build][data-id=example-garen]'); await p.waitForTimeout(500);
await p.click('[data-act=build-menu]'); await p.waitForTimeout(350);
log.push('메뉴 높이 '+await p.evaluate(()=>Math.round(document.querySelector('#sheet .sheet').getBoundingClientRect().height))+' 페이지 '+await stack(p));
await p.click('[data-act=ask-del]'); await p.waitForTimeout(200);
await p.click('[data-act=del-build]'); await p.waitForTimeout(600);
log.push('삭제 후: '+await stack(p)+' 카드 '+await p.locator('.bcard').count()+' 알림 '+await p.locator('#toast').innerText());
await p.click('[data-act=toast-act]'); await p.waitForTimeout(400);
log.push('되살림 카드 '+await p.locator('.bcard').count());
await p.screenshot({path:SP+'/b-home.png'});
log.push('가로 넘침 '+await p.evaluate(()=>document.documentElement.scrollWidth));
// 라이트 360
p = await page({viewport:{width:360,height:740}, deviceScaleFactor:2, isMobile:true, hasTouch:true},'light');
await p.click('[data-act=open-build][data-id=b-shaco]'); await p.waitForTimeout(500);
await p.screenshot({path:SP+'/b-360.png'});
await p.click('.bh-por'); await p.waitForTimeout(800);
log.push('360 바로 가기 맞음 '+await p.evaluate(()=>{ const j=document.querySelector('.jump'); return j.scrollWidth<=j.clientWidth; }));
await p.click(TOP+' .jump [data-to=sk-Q]'); await p.waitForTimeout(800);
await p.screenshot({path:SP+'/b-360champ.png'});
await back(p); await back(p);
await p.click('[data-act=tab][data-v=champs]'); await p.waitForTimeout(300);
await p.click('[data-act=open-champ][data-id=Shaco]'); await p.waitForTimeout(500);
await p.click('.skrow[data-k=W]'); await p.waitForTimeout(900);
log.push('챔피언 화면 W: '+await p.evaluate(()=>[...document.querySelectorAll('.jump button[aria-current=true]')].map(b=>b.dataset.to).join()));
await p.screenshot({path:SP+'/b-360W.png'});
await back(p);
await p.click('[data-act=about]').catch(()=>{});
// PC
p = await page({viewport:{width:1280,height:900}},'light');
await p.click('[data-act=open-build][data-id=b-shaco]'); await p.waitForTimeout(600);
await p.screenshot({path:SP+'/b-desk.png'});
await p.click('.bh-por'); await p.waitForTimeout(800);
await p.screenshot({path:SP+'/b-desk-champ.png'});
await back(p);
await p.click('#fab'); await p.waitForTimeout(300);
await p.click('.ib.add'); await p.waitForTimeout(600);
await p.screenshot({path:SP+'/b-desk-picker.png'});
console.log(log.join('\n')); console.log('ERRORS', JSON.stringify(errs)); console.log('HTTP', JSON.stringify(bad.filter(x=>!x.includes('fonts'))));
await browser.close();
