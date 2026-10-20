/* 올리는 도중에 생긴 변경이 빠지지 않는지 (느린 저장소) */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771';
await fetch(GH+'/__seed', {method:'PUT', body: fs.readFileSync('/home/claude/tem-tree-sync/builds.json')});
await fetch(GH+'/__slow', {method:'PUT', body:'2'});
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
const p = await ctx.newPage(); await p.goto(SITE); await p.waitForTimeout(2500);
const top = sel => p.evaluate(sel => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop(); const el=t.querySelector(sel); if(el) el.click(); return !!el; }, sel);
await p.evaluate(() => [...document.querySelectorAll('.bcard')].find(c => c.textContent.includes('파이크 빌드')).click()); await p.waitForTimeout(600);
await top('#fab'); await p.waitForTimeout(300);
await p.fill('#f-title', '파이크 A'); await p.waitForTimeout(2600);   // 첫 올리기 시작(2초 걸림)
await p.fill('#f-title', '파이크 B'); await top('#fab');
let t = '';
for(let i=0;i<15;i++){ await p.waitForTimeout(1000); const st = await (await fetch(GH+'/__state')).json(); t = Object.values(st.doc.builds).find(b=>b.champ==='Pyke').title; if(t==='파이크 B') { console.log(`올리는 중 변경 반영: 통과 (${i+1}초)`); break; } }
if(t!=='파이크 B') console.log('올리는 중 변경 반영: 실패', t);
await fetch(GH+'/__slow', {method:'PUT', body:'0'});
await browser.close();
