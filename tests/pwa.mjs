/* 설치 가능 여부(크롬 판정)·오프라인 실행·설치 모드 화면 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch(); const errs=[];
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://127.0.0.1:8770/'); await p.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(p);
const inst = await cdp.send('Page.getInstallabilityErrors');
console.log('설치 가능 판정 오류:', JSON.stringify(inst.installabilityErrors));
const man = await cdp.send('Page.getAppManifest'); console.log('manifest 오류:', JSON.stringify(man.errors));
console.log('서비스 워커:', await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active ? r.active.state : 'none'; }));
await p.reload(); await p.waitForTimeout(1500);   // 이미지까지 보관되도록 한 번 더
await p.evaluate(() => document.querySelector('[data-act=tab][data-v=champs]').click()); await p.waitForTimeout(800);
await ctx.setOffline(true);
await p.reload(); await p.waitForTimeout(2500);
console.log('오프라인 실행:', await p.evaluate(() => document.querySelectorAll('#stack > .page').length+'페이지, 챔피언 '+document.querySelectorAll('.ctile').length+'명, 그림 '+getComputedStyle(document.querySelector('.ctile .ico')).backgroundImage.slice(0,60)));
await p.screenshot({path:'/tmp/ttn-test/g-offline.png'});
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
