#!/usr/bin/env python3
"""아이템 설명 세부 수치 채우기 (CommunityDragon 게임 원본 자료).

공식 Data Dragon 아이템 설명은 '추가 마법 피해'처럼 수치가 빠져 있어,
게임 원본 아이템 자료(items.cdtb.bin.json: 수치값·계산식)와 한국어 툴팁 원문
(lol.stringtable.json: @변수@ 자리 표시)을 합쳐 수치가 든 설명문을 만든다.

안전장치: 한 아이템에서 변수 하나라도 해석하지 못하면 그 아이템은 기존 설명을 그대로 둔다.

build_data.py에서 enrich(items, clean, fmt_value)로 호출.
단독 실행(이미 만든 data.json만 고칠 때):
  python3 item_calc.py <data.json> [캐시 폴더]
"""
import json
import os
import re
import sys
import urllib.request

CD = "https://raw.communitydragon.org/latest"
URL_BIN = CD + "/game/items.cdtb.bin.json"
URL_STR = CD + "/game/ko_kr/data/menu/en_us/lol.stringtable.json"

# 계산식 능력치 번호 → (이름, 추가 능력치 이름). 게임 자료에서 쓰임새로 확인한 번호만 (모르는 번호는 해석 실패 처리)
STAT = {0: ("주문력", "추가 주문력"), 1: ("방어력", "추가 방어력"), 2: ("공격력", "추가 공격력"),
        6: ("마법 저항력", "추가 마법 저항력"), 7: ("이동 속도", "추가 이동 속도"),
        12: ("최대 체력", "추가 체력")}
STAT_BASE = {2: "기본 공격력", 1: "기본 방어력", 6: "기본 마법 저항력", 12: "기본 체력"}


class Fail(Exception):
    pass


def fnv(s):
    h = 0x811C9DC5
    for c in s.lower().encode():
        h = ((h ^ c) * 0x01000193) & 0xFFFFFFFF
    return "{%08x}" % h


def num(x, prec=None):
    r = round(float(x), prec if prec is not None else 3)
    if abs(r - round(r)) < 1e-9:
        return str(int(round(r)))
    return f"{r:.3f}".rstrip("0").rstrip(".")


def fetch(url, cache_dir, name):
    path = os.path.join(cache_dir, name) if cache_dir else ""
    if path and os.path.exists(path) and os.path.getsize(path) > 1000:
        return json.load(open(path, encoding="utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": "tem-tree-note"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    if path:
        os.makedirs(cache_dir, exist_ok=True)
        open(path, "wb").write(raw)
    return json.loads(raw)


class Item:
    def __init__(self, it):
        self.raw = it
        self.dv = {}
        for x in it.get("mDataValues") or []:
            n, v = x.get("mName", ""), x.get("mValue", 0.0)
            self.dv[n] = v
            if not n.startswith("{"):
                self.dv[fnv(n)] = v
                self.dv[n.lower()] = v
        self.calc = {}
        for k, v in (it.get("mItemCalculations") or {}).items():
            self.calc[k] = v
            if not k.startswith("{"):
                self.calc[fnv(k)] = v
                self.calc[k.lower()] = v

    def value(self, name):
        for k in (name, name.lower(), fnv(name)):
            if k in self.dv:
                return self.dv[k]
        m = re.fullmatch(r"Effect(\d+)Amount", name)   # 예전 형식 효과 수치
        if m:
            ea = self.raw.get("mEffectAmount") or []
            i = int(m.group(1)) - 1
            if 0 <= i < len(ea):
                return float(ea[i])
        for k in ("m" + name, name[:1].lower() + name[1:]):   # 기본 능력치 (FlatHPRegenMod 등)
            if isinstance(self.raw.get(k), (int, float)):
                return float(self.raw[k])
        raise Fail(name)

    # 계산식 한 조각 → (고정값, [(계수, 능력치 이름)])
    def part(self, p):
        t = p.get("__type")
        if t == "NamedDataValueCalculationPart":
            return self.value(p["mDataValue"]), []
        if t == "NumberCalculationPart":
            return float(p.get("mNumber", 0)), []
        if t in ("StatByNamedDataValueCalculationPart", "StatByCoefficientCalculationPart"):
            st, f = p.get("mStat", 0), p.get("mStatFormula")
            if st not in STAT:
                raise Fail(f"stat {st}")
            coef = self.value(p["mDataValue"]) if "mDataValue" in p else float(p.get("mCoefficient", 0))
            name = STAT_BASE.get(st) if f == 1 else STAT[st][1] if f == 2 else STAT[st][0]
            if not name:
                raise Fail(f"stat {st}/{f}")
            return 0.0, [(coef, name)]
        if t == "AbilityResourceByCoefficientCalculationPart":
            f = p.get("mStatFormula")
            return 0.0, [(float(p.get("mCoefficient", 0)), "추가 마나" if f == 2 else "기본 마나" if f == 1 else "최대 마나")]
        if t == "ByCharLevelBreakpointsCalculationPart":
            v1 = float(p.get("mLevel1Value", 0))
            v18, per = v1, 0.0
            bps = {b.get("mLevel", 0): b for b in p.get("mBreakpoints") or []}
            for lv in range(2, 19):
                b = bps.get(lv)
                if b:
                    per = float(b.get("mBonusPerLevelAtAndAfter", per))
                    v18 += float(b.get("mAdditionalBonusAtThisLevel", 0))
                v18 += per
            return ("lv", (v1, v18)), []
        if t == "ProductOfSubPartsCalculationPart":
            a, ra = self.part(p["mPart1"])
            b, rb = self.part(p["mPart2"])
            if ra and rb:
                raise Fail("product")
            if ra:
                return a * b, [(c * b, n) for c, n in ra]
            if rb:
                return a * b, [(c * a, n) for c, n in rb]
            return a * b, []
        if t == "SumOfSubPartsCalculationPart":
            base, rs = 0.0, []
            for q in p.get("mSubparts") or []:
                v, r = self.part(q)
                base += v
                rs += r
            return base, rs
        raise Fail(t)

    def calc_text(self, c):
        t = c.get("__type")
        if t == "GameCalculationModified":
            inner = self.calc.get(c.get("mModifiedGameCalculation", "")) or self.calc.get(fnv(c.get("mModifiedGameCalculation", "")))
            if not inner:
                raise Fail("modified")
            m, r = self.part(c.get("mMultiplier") or {"__type": "NumberCalculationPart", "mNumber": 1})
            if r:
                raise Fail("modified mult")
            return self.calc_text(dict(inner, mMultiplier={"__type": "NumberCalculationPart", "mNumber": m}))
        ranged = None
        if t == "{e9a3c91d}" and c.get("mRangedMultiplier"):   # 근접·원거리 값이 다른 계산
            rm, r = self.part(c["mRangedMultiplier"])
            if r:
                raise Fail("ranged stat")
            melee = self.calc_text(dict(c, __type="GameCalculation"))
            rc = dict(c, __type="GameCalculation")
            mm, _ = self.part(c["mMultiplier"]) if c.get("mMultiplier") else (1.0, [])
            rc["mMultiplier"] = {"__type": "NumberCalculationPart", "mNumber": mm * rm}
            far = self.calc_text(rc)
            return melee if melee == far else f"{melee} / 원거리 {far}"
        if t != "GameCalculation":
            raise Fail(t)
        base, ratios, lv = 0.0, [], None
        for p in c.get("mFormulaParts") or []:
            if p.get("__type") == "ByCharLevelInterpolationCalculationPart":
                if lv:
                    raise Fail("lv2")
                lv = (float(p.get("mStartValue", 0)), float(p.get("mEndValue", 0)))
                continue
            v, r = self.part(p)
            if isinstance(v, tuple):
                if lv:
                    raise Fail("lv2")
                lv = v[1]
                continue
            base += v
            ratios += r
        mult = 1.0
        if c.get("mMultiplier"):
            mult, r = self.part(c["mMultiplier"])
            if r:
                raise Fail("mult stat")
        pct = bool(c.get("mDisplayAsPercent"))
        k = mult * (100 if pct else 1)
        prec = c.get("mPrecision")
        u = "%" if pct else ""
        if lv:
            a, b = (lv[0] + base) * k, (lv[1] + base) * k
            head = f"{num(a, prec)}~{num(b, prec)}{u}(레벨에 따라)"
        elif base or not ratios:
            head = f"{num(base * k, prec)}{u}"
        else:
            head = ""
        tail = " ".join(f"(+ {num(cf * mult * 100, 2)}% {n})" for cf, n in ratios)
        if not head:   # 계수만 있는 값: '최대 체력의 2%' 꼴
            if len(ratios) == 1:
                cf, n = ratios[0]
                return f"{n}의 {num(cf * mult * 100, 2)}%"
            return tail
        return f"{head} {tail}".strip()

    def token(self, tok):
        mul = 1.0
        name = tok
        m = re.fullmatch(r"([A-Za-z0-9_{}]+)\*(-?[\d.]+)", tok)
        if m:
            name, mul = m.group(1), float(m.group(2))
        c = self.calc.get(name) or self.calc.get(name.lower()) or self.calc.get(fnv(name))
        if c is not None:
            if mul != 1.0:
                raise Fail("calc*")
            return self.calc_text(c)
        return num(self.value(name) * mul)


SEC = re.compile(r"<section>(.*?)</section>", re.S)
STATS_SEC = re.compile(r"%i:scale|@Flat\w*Mod@|@\w*Mod@|@ExtendedStats@")


def body_template(entries, iid):
    tpl = entries.get(f"generatedtip_item_{iid}_description")
    if not tpl:
        return None
    secs = SEC.findall(tpl) or [tpl]
    keep = [s for s in secs if s.strip() and "<flavorText>" not in s and not STATS_SEC.search(s)
            and "#FF0000" not in s.upper()]   # 빨간 글씨 = 구매 조건 안내(퀘스트·레벨 제한)는 제외
    return "<br><br>".join(keep)


def build_one(item, tpl, clean, fmt_value, entries=None):
    vals = []

    def rep(m):
        v = item.token(m.group(1))
        if m.string[m.end():m.end() + 1] == "%" and not re.fullmatch(r"-?[\d.]+", v):
            raise Fail("pct ratio")   # 계수 값 뒤에 % → 게임 안에서만 계산되는 값
        vals.append(v)
        return f"\u0001{len(vals) - 1}\u0002"

    t = re.sub(r"\{\{\s*Item_Cooldown\s*\}\}", "", tpl)
    if entries:   # 게임 공통 문구 ({{ Item_Keyword_OnHit }} 등)
        t = re.sub(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", lambda m: entries.get(m.group(1).lower(), m.group(0)), t)
    t = re.sub(r"%i:[A-Za-z]+%", "", t)
    t = re.sub(r"@([A-Za-z0-9_{}]+(?:\*-?[\d.]+)?)@", rep, t)
    if "@" in t or "{{" in t:
        raise Fail("leftover")
    html = clean(t)
    html = re.sub("\u0001(\\d+)\u0002", lambda m: f'<span class="v">{fmt_value(vals[int(m.group(1))])}</span>', html)
    if "\u0001" in html or "?" in re.sub(r"<[^>]+>", "", html):
        raise Fail("broken")
    html = re.sub(r'([가-힣])(<span class="v)', r"\1 \2", html)
    html = re.sub(r"\s+([.,])", r"\1", html)
    return html.strip()


def enrich(items, clean, fmt_value, cache_dir=None, log=print):
    """items(data.json 'items')의 'd'를 수치가 든 설명으로 바꿈. 바꾼 개수 반환. 자료를 못 받으면 0."""
    try:
        b = fetch(URL_BIN, cache_dir, "items.cdtb.bin.json")
        st = fetch(URL_STR, cache_dir, "lol.stringtable.ko.json")
    except Exception as ex:   # 접속 불가 등: 기존 설명 유지
        log(f"[item_calc] 자료 받기 실패, 기존 설명 유지: {ex}")
        return 0
    entries = st.get("entries", st)
    done, fails = 0, {}
    for iid, it in items.items():
        raw = b.get(f"Items/{iid}")
        tpl = body_template(entries, iid)
        if not raw or not tpl or "@" not in tpl:
            continue
        try:
            html = build_one(Item(raw), tpl, clean, fmt_value, entries)
        except Fail as ex:
            fails[iid] = str(ex)
            continue
        if html:
            it["d"] = html
            done += 1
    log(f"[item_calc] 수치 채움 {done}개, 기존 유지 {len(fails)}개")
    return done


def _load_builder():
    """build_data.py의 설명문 정리 함수만 가져오기 (스크립트 본문은 실행하지 않음)."""
    import ast
    src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_data.py")
    tree = ast.parse(open(src_path, encoding="utf-8").read())
    want_fn = {"esc", "tidy", "clean", "polish", "fmt_value"}
    want_var = {"TAG_CLASS", "EMPTY_SPAN", "VQ", "RATIO_CLASS"}
    body = [n for n in tree.body if (isinstance(n, ast.FunctionDef) and n.name in want_fn)
            or (isinstance(n, ast.Assign) and any(getattr(t, "id", "") in want_var for t in n.targets))]
    ns = {"re": re}
    exec(compile(ast.Module(body=body, type_ignores=[]), src_path, "exec"), ns)
    return ns["clean"], ns["fmt_value"]


if __name__ == "__main__":
    path = sys.argv[1]
    cache = sys.argv[2] if len(sys.argv) > 2 else None
    clean, fmt_value = _load_builder()
    d = json.load(open(path, encoding="utf-8"))
    n = enrich(d["items"], clean, fmt_value, cache)
    if n:
        json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
