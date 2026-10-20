/* 설정 화면 시험: 테마·상태 표시줄 색·첫 화면 깜빡임·화면 전환·진동·화면 꺼짐 방지·빌드 기본값(동기화) */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771', OUT='/tmp/ttn-test/';
await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
const browser = await chromium.launch(); const errs = []; const log = [];
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'light'});
await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(''+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
await p.goto(SITE); await p.waitForTimeout(1500);
const top = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
const st = () => p.evaluate(() => ({theme: document.documentElement.dataset.theme||'(없음)', bg: getComputedStyle(document.body).backgroundColor, bar: [...document.querySelectorAll('meta[name=theme-color]')].map(m=>m.content).join('/'), rm: document.documentElement.classList.contains('rm')}));
log.push('홈 오른쪽 위 버튼: '+await p.evaluate(() => document.querySelector('[data-act=about]').getAttribute('aria-label')));
await top('[data-act=about]'); await p.waitForTimeout(500);
log.push('설정 제목: '+await p.evaluate(() => [...document.querySelectorAll('#stack > .page')].pop().querySelector('.top').textContent.trim()));
log.push('설정 항목: '+await p.evaluate(() => [...document.querySelectorAll('.set-row .lab b')].map(e=>e.textContent).join(', ')));
log.push('처음(라이트 기기): '+JSON.stringify(await st()));
await p.screenshot({path:OUT+'set-light.png'});
await top('[data-act=set][data-k=theme][data-v=dark]'); await p.waitForTimeout(300);
log.push('다크 선택: '+JSON.stringify(await st()));
await p.screenshot({path:OUT+'set-dark.png'});
// 다시 열 때 첫 화면부터 다크인지 (스크립트 실행 전 상태 확인)
await p.goto(SITE, {waitUntil:'commit'}); await p.waitForSelector('body');
log.push('다시 열기 직후: '+await p.evaluate(() => document.documentElement.dataset.theme+' '+getComputedStyle(document.body).backgroundColor+' '+[...document.querySelectorAll('meta[name=theme-color]')].map(m=>m.content).join('/')));
await p.waitForTimeout(1500);
await p.screenshot({path:OUT+'set-dark-home.png'});
// 시스템으로 되돌리면 기기 설정(라이트)
await top('[data-act=about]'); await p.waitForTimeout(500);
await top('[data-act=set][data-k=theme][data-v=system]'); await p.waitForTimeout(200);
log.push('시스템 선택: '+JSON.stringify(await st()));
await top('[data-act=set][data-k=theme][data-v=dark]'); await p.waitForTimeout(200);
// 화면 전환: 빠르게 → 넘김 시간, 끔 → 움직임 없음
await top('[data-act=set][data-k=motion][data-v=fast]'); await p.waitForTimeout(200);
await top('[data-act=back]'); await p.waitForTimeout(500);
const pushDur = async () => { await p.evaluate(() => document.querySelector('[data-act=open-build]').click()); const d = await p.evaluate(() => document.getAnimations().map(a => a.effect.getTiming().duration).filter(Boolean)); await p.waitForTimeout(500); await top('[data-act=back]'); await p.waitForTimeout(500); return d.length ? Math.max(...d) : 0; };
log.push('빠르게: 넘김 '+await pushDur()+'ms');
await top('[data-act=about]'); await p.waitForTimeout(400); await top('[data-act=set][data-k=motion][data-v=off]'); await p.waitForTimeout(200);
log.push('끔: '+JSON.stringify(await st())); await top('[data-act=back]'); await p.waitForTimeout(300);
log.push('끔: 넘김 '+await pushDur()+'ms');
await top('[data-act=about]'); await p.waitForTimeout(400); await top('[data-act=set][data-k=motion][data-v=normal]'); await top('[data-act=back]'); await p.waitForTimeout(500);
log.push('기본: 넘김 '+await pushDur()+'ms');
// 진동·화면 꺼짐 방지
await top('[data-act=about]'); await p.waitForTimeout(400);
await top('[data-act=set][data-k=haptic][data-v=off]'); await p.waitForTimeout(200);
log.push('진동 끔 저장: '+await p.evaluate(() => JSON.parse(localStorage.getItem('ttn.v1.ui')).haptic));
const hasWake = await p.evaluate(() => !!document.querySelector('[data-k=wake]'));
if(hasWake){ await top('[data-act=set][data-k=wake][data-v=on]'); await p.waitForTimeout(500); log.push('화면 꺼짐 방지: '+await p.evaluate(() => document.querySelector('[data-k=wake][aria-pressed=true]').dataset.v)+' / 알림 '+await p.locator('#toast').innerText().catch(()=>'')); }
else log.push('화면 꺼짐 방지: 이 브라우저 미지원으로 항목 숨김');
// 빌드 기본값: 새 빌드 맵 칼바람 → 새 빌드 mode, 저장소 반영
await top('[data-act=set][data-k=nbm][data-v=aram]'); await top('[data-act=set][data-k=cdm][data-v=sr]'); await p.waitForTimeout(2500);
const sd = await (await fetch(GH+'/__state')).json();
log.push('저장소 설정: '+JSON.stringify(sd.doc.prefs));
await top('[data-act=back]'); await p.waitForTimeout(400);
await top('[data-act=tab][data-v=champs]'); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('[data-act=open-champ]').click()); await p.waitForTimeout(500);
const nb = await p.evaluate(() => { const t=[...document.querySelectorAll('#stack > .page')].pop(); const b=t.querySelector('[data-act=new-build]'); if(b) b.click(); return !!b; }); await p.waitForTimeout(800);
log.push('새 빌드 버튼: '+nb+' / 새 빌드 맵: '+await p.evaluate(() => { const m=JSON.parse(localStorage.getItem('ttn.v1.ghm')||'{}'); const bs=Object.values(m.builds||{}).sort((a,b)=>(b.created||0)-(a.created||0)); return bs.length ? bs[0].title+' '+bs[0].mode : '(없음)'; }));
await p.screenshot({path:OUT+'set-dark-build.png'});
console.log(log.join('\n')); console.log('ERRORS', JSON.stringify(errs));
await browser.close();
