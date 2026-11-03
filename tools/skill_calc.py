#!/usr/bin/env python3
"""챔피언 패시브·스킬 세부 수치 채우기 (CommunityDragon 게임 원본 자료).

공식 Data Dragon 패시브 설명은 '추가 마법 피해'처럼 수치가 없고, 일부 스킬은 수치를 못 채워 '?'로 남는다.
챔피언별 게임 원본 자료(characters/<id>/<id>.bin.json: 수치값·계산식)와 한국어 툴팁 원문
(lol.stringtable.json)을 합쳐 수치가 든 설명으로 바꾼다. 계산 방식은 item_calc.py와 같음.

대상: 모든 패시브 + 기존 설명에 '?'가 남은 스킬
안전장치: 한 설명에서 변수 하나라도 해석하지 못하면 그 설명은 기존 그대로 둔다.

build_data.py에서 enrich(skill_out, clean, fmt_value)로 호출.
단독 실행(이미 만든 skills.json·data.json만 고칠 때):
  python3 skill_calc.py <skills.json> <data.json> [캐시 폴더]
"""
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import item_calc as ic   # noqa: E402

URL_CHAMP = ic.CD + "/game/data/characters/{c}/{c}.bin.json"


class Spell(ic.Item):
    """스킬 한 랭크의 값 보기 (item_calc.Item 계산 재사용)"""
    def __init__(self, sp, rank):
        self.raw = {}
        self.sp = sp
        self.rank = rank
        self.dv = {}
        for x in sp.get("DataValues") or []:
            n, vs = x.get("name", ""), x.get("values") or []
            v = float(vs[rank]) if rank < len(vs) else (float(vs[-1]) if vs else 0.0)
            self.dv[n] = v
            if not n.startswith("{"):
                self.dv[ic.fnv(n)] = v
                self.dv[n.lower()] = v
        self.calc = {}
        for k, v in (sp.get("mSpellCalculations") or {}).items():
            self.calc[k] = v
            if not k.startswith("{"):
                self.calc[ic.fnv(k)] = v
                self.calc[k.lower()] = v

    def value(self, name):
        for k in (name, name.lower(), ic.fnv(name)):
            if k in self.dv:
                return self.dv[k]
        m = re.fullmatch(r"Effect(\d+)Amount", name)
        if m:
            ea = self.sp.get("mEffectAmount") or []
            i = int(m.group(1)) - 1
            if 0 <= i < len(ea):
                vs = ea[i].get("value") or []
                if vs:
                    return float(vs[self.rank] if self.rank < len(vs) else vs[-1])
        raise ic.Fail(name)


def merge(vals):
    """랭크별 문자열 → '45 / 75 / 105 (+ 70% 추가 공격력)' 꼴로 합침"""
    if len(set(vals)) == 1:
        return vals[0]
    parts = [re.match(r"^(-?[\d.]+%?)(.*)$", v) for v in vals]
    if all(parts) and len({p.group(2) for p in parts}) == 1:
        return " / ".join(p.group(1) for p in parts) + parts[0].group(2)
    return " / ".join(vals)


MAIN = re.compile(r"<mainText>(.*?)</mainText>", re.S)
DROP = ("SpellModifierDescriptionAppend",)


def body(entries, key):
    for suf in ("tooltipextended", "tooltip"):
        t = entries.get(f"{key}_{suf}")
        if t:
            m = MAIN.search(t)
            return m.group(1) if m else None
    return None


def build(sp, ranks, tpl, entries, clean, fmt_value, passive=False):
    vals = []
    objs = [Spell(sp, r) for r in ranks]

    def rep(m):
        tok = m.group(1)
        if tok in DROP:
            return ""
        per = [o.token(tok) for o in objs]
        if passive and len(set(per)) > 1:
            raise ic.Fail("passive varies")
        v = merge(per)
        if m.string[m.end():m.end() + 1] == "%" and not re.fullmatch(r"[-\d./ ]+", v):
            raise ic.Fail("pct ratio")
        vals.append(v)
        return f"\u0001{len(vals) - 1}\u0002"

    t = re.sub(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", lambda m: entries.get(m.group(1).lower(), m.group(0)), tpl)
    t = re.sub(r"%i:[A-Za-z]+%", "", t)
    t = re.sub(r"@([A-Za-z0-9_{}]+(?:\*-?[\d.]+)?)@", rep, t)
    if "@" in t or "{{" in t:
        raise ic.Fail("leftover")
    html = clean(t)
    html = re.sub("\u0001(\\d+)\u0002", lambda m: f'<span class="v">{fmt_value(vals[int(m.group(1))])}</span>', html)
    if "\u0001" in html or "?" in re.sub(r"<[^>]+>", "", html):
        raise ic.Fail("broken")
    html = re.sub(r'([가-힣])(<span class="v)', r"\1 \2", html)
    html = re.sub(r"\s+([.,])", r"\1", html)
    return html.strip()


def champ_bin(cid, cache_dir):
    c = cid.lower()
    try:
        return ic.fetch(URL_CHAMP.format(c=c), os.path.join(cache_dir, "champs") if cache_dir else None, c + ".json")
    except Exception:
        return None


def enrich(skill_out, clean, fmt_value, cache_dir=None, log=print):
    """skill_out = {챔피언 id: [{k:'P'|'Q'.., tt, ...}]} 의 tt를 수치가 든 설명으로 바꿈. 바꾼 개수 반환."""
    try:
        st = ic.fetch(ic.URL_STR, cache_dir, "lol.stringtable.ko.json")
    except Exception as ex:
        log(f"[skill_calc] 자료 받기 실패, 기존 설명 유지: {ex}")
        return 0, 0
    entries = st.get("entries", st)
    ids = list(skill_out)
    with ThreadPoolExecutor(8) as ex:
        bins = dict(zip(ids, ex.map(lambda c: champ_bin(c, cache_dir), ids)))
    done = {"P": 0, "S": 0}
    fails = 0
    for cid, sks in skill_out.items():
        b = bins.get(cid)
        if not b:
            continue
        root = next((v for k, v in b.items() if k.endswith("/CharacterRecords/Root")), None)
        if not root:
            continue
        spells = root.get("spells") or []
        for s in sks:
            k = s.get("k")
            try:
                if k == "P":
                    path = root.get("mCharacterPassiveSpell")
                    obj = b.get(path) if path else None
                    if not obj:
                        continue
                    sp = obj.get("mSpell") or {}
                    tpl = body(entries, f"generatedtip_passive_{obj.get('mScriptName', '').lower()}")
                    if not tpl:
                        continue
                    s["tt"] = build(sp, [1], tpl, entries, clean, fmt_value, passive=True)
                    done["P"] += 1
                elif k in "QWER" and 'class="v q"' in s.get("tt", ""):
                    i = "QWER".index(k)
                    if i >= len(spells):
                        continue
                    obj = b.get(spells[i])
                    if not obj:
                        continue
                    sp = obj.get("mSpell") or {}
                    tpl = body(entries, f"generatedtip_spell_{obj.get('mScriptName', '').lower()}")
                    if not tpl:
                        continue
                    n = s.get("mr") or (3 if k == "R" else 5)
                    s["tt"] = build(sp, list(range(1, n + 1)), tpl, entries, clean, fmt_value)
                    done["S"] += 1
            except (ic.Fail, TypeError, KeyError, ValueError, IndexError, ZeroDivisionError, AttributeError):
                fails += 1   # 해석 못 한 계산식은 기존 설명 유지
    log(f"[skill_calc] 패시브 {done['P']}개, '?' 스킬 {done['S']}개 수치 채움, 기존 유지 {fails}개")
    return done["P"], done["S"]   # (패시브 채운 수, '?' 스킬 채운 수)


if __name__ == "__main__":
    sk_path, data_path = sys.argv[1], sys.argv[2]
    cache = sys.argv[3] if len(sys.argv) > 3 else None
    clean, fmt_value = ic._load_builder()
    sk = json.load(open(sk_path, encoding="utf-8"))
    n = sum(enrich(sk["champs"], clean, fmt_value, cache))
    if n:
        sk_text = json.dumps(sk, ensure_ascii=False, separators=(",", ":"))
        open(sk_path, "w", encoding="utf-8").write(sk_text)
        # data.json의 스킬 지문(skrev)·내용 지문(rev) 갱신: 같으면 앱이 기기에 저장된 예전 설명을 계속 씀
        d = json.load(open(data_path, encoding="utf-8"))
        d["skrev"] = hashlib.md5(sk_text.encode("utf-8")).hexdigest()[:10]
        d.pop("rev", None)
        d["rev"] = hashlib.md5(json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()[:10]
        json.dump(d, open(data_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
