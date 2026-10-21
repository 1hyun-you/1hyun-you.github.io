/* 조건 겹침 점검: 아이템 필터(분류·능력치·검색·정렬·맵) 조합, 세트 담기 중 막대, 탭 다시 누르기, 화면 회전·작은 화면,
   키보드(검색 입력 중 화면 줄어듦), 아이템 추가 창 조합, 가로 넘침, 오류 로그 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SITE='http://127.0.0.1:8770/', GH='http://127.0.0.1:8771', OUT='/tmp/ttn-test/';
const D = JSON.parse(fs.readFileSync('/home/claude/tem-tree/data.json','utf8'));
const SEED = JSON.parse(fs.readFileSync('/home/claude/tem-tree-sync/builds.json','utf8')); if(SEED.prefs) SEED.prefs.sets = [];
await fetch(GH+'/__seed', {method:'PUT', body: JSON.stringify(SEED)});
const browser = await chromium.launch(); const log = [], bad = [];
process.on('uncaughtException', e => { console.log(log.join('\n')); console.log('중단', e.message); process.exit(1); });
const check = (name, ok, info='') => { log.push(`${ok?'통과':'실패'} · ${name}${info!==''?' · '+info:''}`); if(!ok) bad.push(name); };

async function open(w, h, scheme='dark'){
  const ctx = await browser.newContext({viewport:{width:w,height:h}, isMobile:true, hasTouch:true, deviceScaleFactor:2, colorScheme:scheme});
  await ctx.addInitScript(() => { try{ if(!localStorage.getItem('ttn.v1.gh')) localStorage.setItem('ttn.v1.gh', JSON.stringify({owner:'tester', api:'http://127.0.0.1:8771', token:'github_pat_TEST'})); }catch{} });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(''+e)); p.on('console', m => { if(m.type()==='error' && !/TUNNEL|fonts|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(SITE); await p.waitForTimeout(2000);
  return {ctx, p};
}
const TOP = `[...document.querySelectorAll('#stack > .page:not(.leaving)')].pop()`;
const click = (p, sel, wait=250) => p.evaluate(([s,T]) => { const el = eval(T).querySelector(s); if(!el) throw new Error('없음 '+s); el.click(); }, [sel, TOP]).then(() => p.waitForTimeout(wait));
const val = (p, fn, arg) => p.evaluate(fn, arg);
const ids = p => val(p, () => [...document.querySelectorAll('#it-list .pit')].map(e => e.dataset.id));
const pids = p => val(p, () => [...document.querySelectorAll('#pick-grid .pit')].map(e => e.dataset.id));
const cyc = (p, c='it') => val(p, c => document.querySelector(`[data-act=if-cyc][data-c=${c}]`).dataset.v, c);
async function cycTo(p, v, c='it'){ for(let i=0;i<5 && (await cyc(p,c))!==v;i++) await click(p, `[data-act=if-cyc][data-c=${c}]`, 200); }
const tierOk = (it, t) => t==='all' || (t==='legend' ? it.tier==='legend' : t==='boots' ? it.c.includes('boots') : it.c.includes('start'));
const railBox = (p, c='it') => val(p, c => { const r = document.querySelector('#rail-'+c), sc = r.closest('.hm-pane, .pg-b'), a = r.getBoundingClientRect(), b = sc.getBoundingClientRect(); const sb = document.querySelector('#setbar'); const sbt = sb && !sb.hidden ? sb.getBoundingClientRect().top : b.bottom; return {top: Math.round(a.top - b.top), bottom: Math.round(a.bottom), limit: Math.round(Math.min(b.bottom, sbt)), pos: getComputedStyle(r).position, chh: getComputedStyle(r).getPropertyValue('--chh')}; }, c);
const overflowX = p => val(p, () => document.documentElement.scrollWidth - innerWidth);

// ================= 1. 아이템 탭 필터 조합 (412×915, 사용자 휴대폰 크기)
{
  const {ctx, p} = await open(412, 915);
  await click(p, '.hm-seg [data-v=items]', 500);
  const mapKey = () => val(p, () => document.querySelector('[data-act=it-map][aria-pressed=true]').dataset.v==='sr' ? 'sr' : 'ar');
  let allOk = true, info = '';
  for(const t of ['legend','boots','start','all']){
    await cycTo(p, t);
    for(const st of [[], ['ap'], ['ad','crit'], ['hp','ar']]){
      for(const k of st) await click(p, `[data-act=it-stat][data-v=${k}]`, 120);
      const list = await ids(p), mk = await mapKey();
      const wrong = list.filter(id => { const it = D.items[id]; return !it || !it[mk] || !tierOk(it, t); });
      if(wrong.length){ allOk = false; info += `${t}/${st}: ${wrong.slice(0,3)} `; }
      for(const k of st) await click(p, `[data-act=it-stat][data-v=${k}]`, 120);
    }
  }
  check('분류×능력치 조합: 목록이 분류·맵 조건을 지킴', allOk, info);
  // 능력치 조건 확인 (주문력+스킬 가속 → 모든 아이템이 두 능력치를 가짐)
  await cycTo(p, 'all'); await click(p, '[data-act=it-stat][data-v=ap]', 120); await click(p, '[data-act=it-stat][data-v=ah]', 200);
  const apah = await ids(p);
  const has = (id, names) => names.some(n => D.items[id].st.some(l => l.startsWith(n)));
  check('능력치 둘 다 고르면 둘 다 있는 아이템만', apah.length>3 && apah.every(id => has(id,['주문력']) && has(id,['스킬 가속'])), String(apah.length));
  // 정렬 3종
  const golds = async () => (await ids(p)).map(id => D.items[id].g);
  let g = await golds(); check('낮은 가격순', g.every((x,i) => !i || x >= g[i-1]));
  await click(p, '[data-act=if-sort][data-c=it]', 200); g = await golds(); check('높은 가격순', g.every((x,i) => !i || x <= g[i-1]));
  await click(p, '[data-act=if-sort][data-c=it]', 200); const nm = (await ids(p)).map(id => D.items[id].n);
  check('이름순', nm.every((x,i) => !i || x.localeCompare(nm[i-1], 'ko') >= 0), nm.slice(0,4).join(','));
  await click(p, '[data-act=if-sort][data-c=it]', 200);
  // 검색 + 필터: 검색어는 분류·능력치와 함께 적용
  await click(p, '[data-act=it-reset]', 200);
  await click(p, '[data-act=if-search][data-c=it]', 200);
  check('검색 아이콘 → 입력창·커서', await val(p, () => document.activeElement && document.activeElement.id==='q-items'));
  await p.fill('#q-items', '검'); await p.waitForTimeout(300);
  const sq = await ids(p); check('검색: 완성 + 이름에 "검"', sq.length>0 && sq.every(id => D.items[id].tier==='legend'), String(sq.length));
  check('검색 중 초기화 링크 표시', await val(p, () => !!document.querySelector('#it-filters [data-act=it-reset]')));
  // 검색 중 탭 이동 후 복귀: 검색어 유지
  await click(p, '.hm-seg [data-v=champs]', 400); await click(p, '.hm-seg [data-v=items]', 400);
  check('탭 다녀와도 검색어·결과 유지', (await val(p, () => document.querySelector('#q-items')?.value))==='검' && (await ids(p)).length===sq.length);
  // 초기화 → 검색 닫힘·완성·능력치 해제
  await click(p, '[data-act=it-stat][data-v=ad]', 150); await click(p, '[data-act=it-reset]', 300);
  check('초기화: 검색창 닫힘·완성·능력치 해제', await val(p, () => !document.querySelector('#q-items') && document.querySelector('[data-act=if-cyc][data-c=it]').dataset.v==='legend' && !document.querySelector('#rail-it .sc[aria-pressed=true]')));
  // 맵 바꿔도 분류·능력치 유지
  await click(p, '[data-act=it-stat][data-v=ap]', 150); await click(p, '[data-act=it-map][data-v=sr]', 300);
  const srl = await ids(p);
  check('맵 바꿔도 분류·능력치 유지·협곡 상점만', srl.length>0 && srl.every(id => D.items[id].sr && D.items[id].tier==='legend') && await val(p, () => document.querySelector('#rail-it [data-v=ap]').getAttribute('aria-pressed')==='true'), String(srl.length));
  await click(p, '[data-act=it-map][data-v=aram]', 300); await click(p, '[data-act=it-reset]', 300);
  // 막대: 스크롤 중 위치·화면 안
  let rb = await railBox(p); const top0 = rb.top;
  await val(p, () => document.querySelector('.hm-pane[data-tab=items]').scrollTop = 2000); await p.waitForTimeout(200);
  rb = await railBox(p); check('스크롤 끝까지 막대 위치 그대로·화면 안', rb.top===top0 && rb.bottom<=rb.limit, JSON.stringify(rb));
  // 필터 바꾸면 목록 처음으로 (위 줄은 보이게)
  await click(p, '[data-act=it-stat][data-v=hp]', 300);
  check('목록 중간에서 필터 바꾸면 목록 처음으로', await val(p, () => { const f = document.querySelector('#it-filters').getBoundingClientRect(), pn = document.querySelector('.hm-pane[data-tab=items]').getBoundingClientRect(); return f.top >= pn.top - 1 && f.top < pn.top + 60; }));
  await click(p, '[data-act=it-reset]', 200);
  // 세트 담기 중: 막대가 담기 막대 위에서 끝남
  await click(p, '[data-act=it-collect]', 500);
  rb = await railBox(p); check('세트 담기 중 막대가 아래 담기 막대에 가리지 않음', rb.bottom <= rb.limit + 1, JSON.stringify(rb));
  await click(p, '#it-list .pit', 200); await click(p, '[data-act=it-stat][data-v=ad]', 200); await click(p, '#it-list .pit', 200);
  check('담기 중 필터 바꿔도 담기 계속', await val(p, () => document.querySelectorAll('#sb-tray .tb').length===2));
  await click(p, '.sb-act [data-act=it-collect]', 500); await click(p, '[data-act=it-reset]', 200);
  // 탭 다시 누르기 = 맨 위 (검색창 열린 상태도)
  await val(p, () => document.querySelector('.hm-pane[data-tab=items]').scrollTop = 1500); await click(p, '.hm-seg [data-v=items]', 900);
  check('탭 다시 누르기 = 맨 위', (await val(p, () => document.querySelector('.hm-pane[data-tab=items]').scrollTop))===0);
  check('가로 넘침 없음(412)', (await overflowX(p))<=0);
  // 키보드: 검색 입력 중 화면 높이가 줄어도 막대 칸 높이 유지
  await click(p, '[data-act=if-search][data-c=it]', 200); const chh0 = (await railBox(p)).chh;
  await p.setViewportSize({width:412, height:520}); await p.waitForTimeout(300);
  const chh1 = (await railBox(p)).chh;
  await p.setViewportSize({width:412, height:915}); await p.waitForTimeout(300);
  check('키보드 열려도 막대 크기 그대로(입력 중)', chh0===chh1, `${chh0} → ${chh1}`);
  await click(p, '[data-act=if-sclose][data-c=it]', 200);
  // 정렬 기억 (새로 고침)
  await click(p, '[data-act=if-sort][data-c=it]', 200); await p.reload(); await p.waitForTimeout(2000); await click(p, '.hm-seg [data-v=items]', 400);
  check('정렬 기억', (await val(p, () => document.querySelector('[data-act=if-sort][data-c=it]').textContent)).includes('높은'));
  await click(p, '[data-act=if-sort][data-c=it]', 150); await click(p, '[data-act=if-sort][data-c=it]', 150);
  check('오류 없음(아이템 탭)', !p.errs.length, p.errs.join(' | '));
  await ctx.close();
}

// ================= 2. 가로 화면·작은 화면: 막대가 안 보이는 칸 없이 쓸 수 있어야 함
for(const [w,h,name] of [[915,412,'가로 화면'],[360,640,'작은 화면'],[320,568,'아주 작은 화면']]){
  const {ctx, p} = await open(w, h, 'light');
  await click(p, '.hm-seg [data-v=items]', 500);
  const rb = await railBox(p);
  // 고정이면 화면 안에 다 들어가야 하고, 다 안 들어가면 목록과 함께 스크롤(모든 칸 누를 수 있음)
  const reach = rb.pos==='sticky' ? rb.bottom <= rb.limit + 1 : true;
  await val(p, free => { const pn = document.querySelector('.hm-pane[data-tab=items]'); if(free) document.querySelector('#rail-it [data-v=ten]').scrollIntoView({block:'end'}); else pn.scrollTop = 99999; }, rb.pos!=='sticky'); await p.waitForTimeout(200);
  const lastVisible = await val(p, () => { const b = document.querySelector('#rail-it [data-v=ten]').getBoundingClientRect(), pn = document.querySelector('.hm-pane[data-tab=items]').getBoundingClientRect(); return b.bottom <= pn.bottom + 1 && b.top >= pn.top - 1; });
  check(`${name}: 막대 모든 칸 누를 수 있음`, reach && lastVisible, JSON.stringify(rb));
  check(`${name}: 가로 넘침 없음`, (await overflowX(p))<=0);
  const cols = await val(p, () => getComputedStyle(document.querySelector('#it-list .pgrid')).gridTemplateColumns.split(' ').length);
  log.push(`정보 · ${name} 아이템 ${cols}열 · 칸 ${rb.chh}`);
  check(`${name}: 오류 없음`, !p.errs.length, p.errs.join(' | '));
  await ctx.close();
}

// ================= 3. 아이템 추가 창 조합
{
  const {ctx, p} = await open(412, 915);
  await click(p, '.bcard', 700); await click(p, '#fab', 400); await click(p, '.ib.add', 900);
  check('추가 창 기본 완성·막대 화면 안', (await cyc(p,'pk'))==='legend' && (await railBox(p,'pk')).bottom <= (await railBox(p,'pk')).limit + 1, JSON.stringify(await railBox(p,'pk')));
  const mode = await val(p, () => { const t=[...document.querySelectorAll('#stack > .page:not(.leaving)')]; return document.querySelector('[data-act=build-map][aria-pressed=true]').dataset.v; });
  const mk = mode==='sr' ? 'sr' : 'ar';
  await click(p, '[data-act=pick-stat][data-v=ap]', 200);
  let l = await pids(p); check('추가 창: 맵·완성·주문력 조건', l.every(id => D.items[id][mk] && D.items[id].tier==='legend'), String(l.length));
  // 검색 입력 중 초기화 링크가 바로 보임
  await click(p, '[data-act=pick-stat][data-v=ap]', 200); await cycTo(p, 'all', 'pk');
  await click(p, '[data-act=if-search][data-c=pk]', 200); await p.fill('#q-item', '루'); await p.waitForTimeout(300);
  check('추가 창 검색 중 초기화 링크 표시', await val(p, () => !!document.querySelector('#ifbar-pk [data-act=pick-reset]')));
  const before = await val(p, () => document.querySelectorAll('#pick-tray .tb').length);
  await click(p, '#pick-grid .pit:not(.in)', 300);
  check('검색 결과에서 담기', (await val(p, () => document.querySelectorAll('#pick-tray .tb').length))===before+1);
  check('담은 뒤에도 검색어 유지', (await val(p, () => document.querySelector('#q-item')?.value))==='루');
  await click(p, '[data-act=pick-reset]', 300);
  check('추가 창 초기화', (await cyc(p,'pk'))==='legend' && await val(p, () => !document.querySelector('#q-item') && !document.querySelector('#rail-pk .sc[aria-pressed=true]')));
  // 빌드 맵 바꾸면 목록·막대 유지
  await click(p, `[data-act=build-map][data-v=${mode==='sr'?'aram':'sr'}]`, 500);
  const mk2 = mode==='sr' ? 'ar' : 'sr'; l = await pids(p);
  check('추가 창에서 맵 바꾸면 그 맵 상점만', l.length>0 && l.every(id => D.items[id][mk2]), String(l.length));
  check('맵 바꾼 뒤 막대 그대로', await val(p, () => !!document.querySelector('#rail-pk .cyc')) && (await railBox(p,'pk')).bottom <= (await railBox(p,'pk')).limit + 1);
  await click(p, `[data-act=build-map][data-v=${mode}]`, 500);
  // 분류 순환 끝까지 돌기
  const seen = []; for(let i=0;i<4;i++){ seen.push(await cyc(p,'pk')); await click(p, '[data-act=if-cyc][data-c=pk]', 200); }
  check('분류 순환 순서', seen.join()==='legend,boots,start,all' && (await cyc(p,'pk'))==='legend', seen.join());
  // 정보 보기 → 돌아오면 필터·스크롤 유지
  await click(p, '[data-act=pick-stat][data-v=ad]', 200);
  await val(p, ([T]) => eval(T).querySelector('.pg-b').scrollTop = 300, [TOP]);
  await click(p, '.pg-f [data-act=pick-info]', 600).catch(() => {});
  const inInfo = await val(p, ([T]) => eval(T).querySelector('.top').textContent.includes('아이템 정보'), [TOP]);
  if(inInfo){ await p.evaluate(() => history.back()); await p.waitForTimeout(600); }
  check('정보 보고 돌아와도 필터 유지', await val(p, () => document.querySelector('#rail-pk [data-v=ad]')?.getAttribute('aria-pressed')==='true'));
  check('가로 넘침 없음(추가 창)', (await overflowX(p))<=0);
  check('오류 없음(추가 창)', !p.errs.length, p.errs.join(' | '));
  await ctx.close();
}

// ================= 4. 다른 화면 영향 없음 (내 빌드·챔피언 여백, 화면 크기 설정)
{
  const {ctx, p} = await open(390, 844);
  const pad = sel => val(p, sel => getComputedStyle(document.querySelector(sel)).paddingLeft, sel);
  check('내 빌드·챔피언 탭 여백 16px 유지', (await pad('.hm-pane[data-tab=builds]>.wrap'))==='16px' && (await pad('.hm-pane[data-tab=champs]>.wrap'))==='16px');
  check('아이템 탭 여백 12px', (await pad('.hm-pane[data-tab=items]>.wrap'))==='12px');
  check('오류 없음(기타)', !p.errs.length, p.errs.join(' | '));
  await ctx.close();
}

console.log(log.join('\n')); console.log('실패', bad.length, JSON.stringify(bad));
await browser.close();
