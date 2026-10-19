#!/usr/bin/env python3
"""템트리 노트 데이터 생성기.

Data Dragon 미러(InFinity54/lol_ddragon)의 한국어·영문 데이터와 이미지,
CommunityDragon 기반 스킬 수치(shepherdjerred/monorepo ability-facts)로
data.json, skills.json, 스프라이트 이미지(sprites/*.webp)를 만든다.

사용법:
  python3 build_data.py <lol_ddragon 체크아웃 경로> <출력 폴더> [ability-facts 폴더] [칼바람 자료 폴더]

칼바람 자료 폴더(선택, 기본값은 이 스크립트가 있는 폴더):
  aram_raw.txt  챔피언별 칼바람 보정 원문(영문, 한 줄 = 이름|주는 피해|받는 피해|기타 능력치|스킬 변경)
  aram_ko.json  스킬 변경 문구 번역표(영문 → 한국어). 번역표에 없고 규칙으로도 못 바꾼 문구는
                영문 그대로 넣고 마지막 출력 JSON의 aram_untranslated 목록에 표시

필요한 lol_ddragon 체크아웃 경로(sparse):
  /latest/data/ko_KR/  /latest/data/en_US/championFull.json  /latest/manifest.json
  /latest/img/item/  /latest/img/champion/  /latest/img/spell/  /latest/img/passive/
  /img/perk-images/
ability-facts 폴더(선택, shepherdjerred/monorepo):
  packages/scout-for-lol/packages/data/src/data-dragon/assets/ability-facts/
  (같은 assets 폴더의 version.json 으로 수치 기준 버전을 기록)
"""
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone, timedelta

from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]
FACTS = sys.argv[3] if len(sys.argv) > 3 else ""
ARAM_DIR = sys.argv[4] if len(sys.argv) > 4 else os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(SRC, "latest", "data", "ko_KR")
DATA_EN = os.path.join(SRC, "latest", "data", "en_US")
IMG = os.path.join(SRC, "latest", "img")
PERK = os.path.join(SRC, "img")

os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)


def load(name, base=DATA):
    with open(os.path.join(base, name), encoding="utf-8") as f:
        return json.load(f)


manifest = json.load(open(os.path.join(SRC, "latest", "manifest.json"), encoding="utf-8"))
dd_version = manifest["v"]  # 예: 16.20.1
major, minor = dd_version.split(".")[:2]
patch = f"{int(major) + 10}.{minor}"  # 16.20 -> 26.20 (2025년부터 연도 표기)

# ---------------------------------------------------------------- 텍스트 정리
# Riot 설명문 태그 → 화면 색상 구분 클래스
#   kn 효과 이름(금색)  km 마법 피해(하늘색)  kap 주문력 계수(보라)  kp 물리·공격력·공격 속도(주황)  kt 고정 피해  kh 회복·체력
#   ks 보호막  kc 상태 이상  ksp 속도  kmn 마나  ka 방어력  kr 마법 저항력
#   kb 강조  kg 골드  ki 규칙·보조 설명  kl 레벨 비례  kd 경고
TAG_CLASS = {
    "passive": "kn", "active": "kn", "raritymythic": "kn", "raritylegendary": "kn", "raritygeneric": "kn",
    "spellname": "kn", "unique": "kn", "keywordmajor": "kn", "spellpassive": "kn", "spellactive": "kn",
    "recast": "kn", "keywordname": "kn", "toggle": "kn", "charge": "kn", "release": "kn", "evolve": "kn",
    "tap": "kn", "hold": "kn",
    "b": "kb", "strong": "kb", "attention": "kb", "keyword": "kb", "keywordstealth": "kb", "onhit": "kb",
    "lol-uikit-tooltipped-keyword": "kb", "buffedstat": "kb",
    "magicdamage": "km", "scaleap": "kap", "magicpen": "km",
    "physicaldamage": "kp", "scalead": "kp", "scalelethality": "kp", "armorpen": "kp", "scalecrit": "kp",
    "truedamage": "kt",
    "healing": "kh", "scalehealth": "kh", "health": "kh", "lifesteal": "kh", "omnivamp": "kh", "statgood": "kh",
    "shield": "ks",
    "status": "kc", "slow": "kc",
    "speed": "ksp", "attackspeed": "kp", "ms": "ksp",
    "scalemana": "kmn",
    "scalearmor": "ka", "scalemr": "kr",
    "gold": "kg",
    "rules": "ki", "flavortext": "ki", "i": "ki", "specialrules": "ki", "jaderules": "ki",
    "scalelevel": "kl", "danger": "kd",
}


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


EMPTY_SPAN = re.compile(r'<span class="[a-z ]+">(\s*)</span>')


def tidy(r):
    for _ in range(3):
        r = EMPTY_SPAN.sub(r"\1", r)
    r = re.sub(r"(\s*<br>\s*){3,}", "<br><br>", r)
    r = re.sub(r"^(\s*<br>\s*)+|(\s*<br>\s*)+$", "", r)
    r = re.sub(r"[ \t]{2,}", " ", r)
    r = re.sub(r"\(\s+", "(", r)
    r = re.sub(r"\s+\)", ")", r)
    r = re.sub(r"\s+(</span>)?\)", r"\1)", r)
    return r.strip()


def clean(html):
    """Riot 설명문을 <br>과 색상 클래스 <span>만 남긴 안전한 HTML로 변환."""
    if not html:
        return ""
    s = re.sub(r"<li>", "<br>• ", html, flags=re.I)
    out, stack, pos = [], [], 0
    for m in re.finditer(r"<\s*(/?)\s*([a-zA-Z][\w\-]*)[^>]*?(/?)>", s):
        out.append(esc(s[pos:m.start()]))
        pos = m.end()
        closing, tag, selfclose = m.group(1), m.group(2).lower(), m.group(3)
        if tag in ("br", "hr"):
            out.append("<br>")
            continue
        if selfclose:
            continue
        if not closing:
            cls = TAG_CLASS.get(tag)
            stack.append((tag, bool(cls)))
            if cls:
                out.append(f'<span class="{cls}">')
            continue
        idx = next((i for i in range(len(stack) - 1, -1, -1) if stack[i][0] == tag), -1)
        if idx < 0:
            continue
        while len(stack) > idx:
            _, emitted = stack.pop()
            if emitted:
                out.append("</span>")
    out.append(esc(s[pos:]))
    out.extend("</span>" for _, e in stack if e)
    r = "".join(out)
    r = r.replace("&amp;nbsp;", " ").replace("&amp;amp;", "&amp;")
    r = re.sub(r"\{\{[^}]*\}\}", "?", r)
    return polish(tidy(r))


VQ = '<span class="v q">?</span>'


def polish(html):
    """설명문에 남은 게임 내부 표기 정리.
    아이콘 표시(%i:OnHit% 등) 삭제, 못 채운 변수(@HealAmount@ 등)는 '…만큼'·괄호 설명째 삭제,
    짝 잃은 템플릿 괄호({{ }})와 빈 괄호 삭제, 겹친 공백 정리"""
    s = re.sub(r"%i:[A-Za-z]+%", "", html)
    s = re.sub(r'<span class="[^"]*"></span>', "", s)
    s = re.sub(r"\s*\([^()<>]*@[A-Za-z0-9_.*]+@[^()<>]*\)", "", s)
    s = re.sub(r"@[A-Za-z0-9_.*]+@\s*만큼\s*", "", s)
    s = re.sub(r"@[A-Za-z0-9_.*]+@", "?", s)
    s = re.sub(r"\s*(?:" + re.escape(VQ) + r"|\?)?\s*\}\}", "", s)
    s = s.replace("{{", "")
    s = re.sub(r"\(\s*(?:" + re.escape(VQ) + r"|\?)?\s*\)", "", s)
    s = re.sub(r"\s*\((?!\s*\+)[^()<>?]{1,12}?:?\s*" + re.escape(VQ) + r"\)", "", s)   # '(최대 ?)'처럼 값을 모르는 짧은 괄호 설명
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r" ((?:<[^>]+>)+) ", r" \1", s)   # 태그 사이에 낀 겹친 공백
    s = re.sub(r"\s+(?:" + re.escape(VQ) + r"|\?)\s*(?=<br>|$)", "", s)   # 문장 끝에 홀로 남은 ?
    s = re.sub(r"[ \t]+([.,)])", r"\1", s)
    return s


def drop_live_lines(html):
    """'현재: ?/100'처럼 게임 중에만 값이 생기는 줄은 빼기 (여기서는 항상 ?로만 보여 의미 없음)"""
    segs = html.split("<br>")
    keep = [g for g in segs if not (re.sub(r"<[^>]+>", "", g).strip().startswith("현재") and 'class="v q"' in g
                                    and g.count("<span") == g.count("</span>"))]
    out = "<br>".join(keep)
    out = re.sub(r"(?:<br>){3,}", "<br><br>", out)
    return re.sub(r"^(?:<br>)+|(?:<br>)+$", "", out)


NZ = r"(?<![\d.~\-+])"  # 앞이 숫자가 아닌 단독 0


def fix_zero(s):
    """공식 데이터에서 동적 수치가 0으로 비어 나오는 부분을 자연스럽게 정리."""
    s = re.sub(r"\s*\(0초\)", "", s)
    s = re.sub(NZ + r"\(0\)", "", s)
    s = re.sub(NZ + r"0초(?!\d)", "일정 시간", s)
    s = re.sub(r"(?<=[가-힣])0%?(?=의)", " 일정량", s)
    s = re.sub(NZ + r"0%?(?=의)(?!~)", "일정량", s)
    s = re.sub(NZ + r"0%?\s*(?=(증가|상승|감소|얻|회복|흡수|만큼|씩))(?!~)", "", s)
    s = re.sub(NZ + r"0%?(?=,)", "", s)
    s = re.sub(r"\s+,", ",", s)
    return tidy(s)


def stats_lines(desc):
    m = re.search(r"<stats>(.*?)</stats>", desc or "", flags=re.S | re.I)
    if not m:
        return [], desc or ""
    inner = m.group(1)
    lines = [re.sub(r"<[^>]+>", "", x).strip() for x in re.split(r"<br\s*/?>", inner)]
    lines = [re.sub(r"\s+", " ", x) for x in lines if x]
    rest = (desc[:m.start()] + desc[m.end():])
    return lines, rest


# ---------------------------------------------------------------- 스킬 세부 수치
TOKEN = re.compile(r"\{\{\s*([^}]*?)\s*\}\}")
EN_KO = [
    ("of target's maximum Health", "대상 최대 체력"), ("of target's max Health", "대상 최대 체력"),
    ("of target's missing Health", "대상 잃은 체력"), ("of target's current Health", "대상 현재 체력"),
    ("target's maximum Health", "대상 최대 체력"), ("target's missing Health", "대상 잃은 체력"),
    ("target's current Health", "대상 현재 체력"), ("of maximum Health", "최대 체력"),
    ("of bonus Health", "추가 체력"), ("of missing Health", "잃은 체력"),
    ("bonus Attack Damage", "추가 공격력"), ("Attack Damage", "공격력"), ("Ability Power", "주문력"),
    ("bonus Magic Resist", "추가 마법 저항력"), ("Magic Resist", "마법 저항력"),
    ("bonus Armor", "추가 방어력"), ("Armor", "방어력"),
    ("bonus Attack Speed", "추가 공격 속도"), ("Attack Speed", "공격 속도"),
    ("bonus Move Speed", "추가 이동 속도"), ("Move Speed", "이동 속도"),
    ("maximum Health", "최대 체력"), ("max Health", "최대 체력"), ("missing Health", "잃은 체력"),
    ("current Health", "현재 체력"), ("bonus Health", "추가 체력"),
    ("maximum Mana", "최대 마나"), ("bonus Mana", "추가 마나"),
    ("Critical Strike Chance", "치명타 확률"), ("Critical Strike Damage", "치명타 피해량"),
    ("Lethality", "물리 관통력"), ("Magic Penetration", "마법 관통력"), ("Ability Haste", "스킬 가속"),
    ("based on level", "레벨에 비례"), ("based on Level", "레벨에 비례"),
    ("per 100 AP", "주문력 100당"), ("per 100 bonus AD", "추가 공격력 100당"), ("per 100 AD", "공격력 100당"),
    ("bonus AD", "추가 공격력"), ("bonus AP", "추가 주문력"),
    ("Health", "체력"), ("Mana", "마나"), ("Energy", "기력"),
    ("per second", "초당"), ("seconds", "초"), ("second(s)", "초"), ("second", "초"),
    ("stacks", "중첩"), ("stack", "중첩"), ("at level", "레벨"), ("at rank", "랭크"), ("levels", "레벨"), ("level", "레벨"),
]
EN_KO_RE = [(re.compile(r"(?<![A-Za-z])" + re.escape(a) + r"(?![A-Za-z])"), b) for a, b in EN_KO]
SHORT = [(re.compile(r"(?<![A-Za-z])AD(?![A-Za-z])"), "공격력"), (re.compile(r"(?<![A-Za-z])AP(?![A-Za-z])"), "주문력")]


def ko_terms(s):
    for r, b in EN_KO_RE:
        s = r.sub(b, s)
    for r, b in SHORT:
        s = r.sub(b, s)
    return s


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", " ", s or "", flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def fmt_num(v):
    if isinstance(v, (int, float)):
        r = round(float(v), 3)
        return str(int(r)) if r == int(r) else f"{r:.3f}".rstrip("0").rstrip(".")
    return str(v)


def per_rank(vals, mult=1.0, max_rank=None):
    if not vals:
        return ""
    vals = list(vals)
    if max_rank and len(vals) > max_rank:
        vals = vals[:max_rank]
    vs = [fmt_num(v * mult) if isinstance(v, (int, float)) else str(v) for v in vals]
    return vs[0] if len(set(vs)) == 1 else " / ".join(vs)


def norm_token(t):
    return re.sub(r"\s+", "", t).lower()


def align(template_en, resolved):
    """영문 툴팁 템플릿과 수치가 채워진 해석본을 맞춰 {{토큰}} → 값 사전을 만든다."""
    tpl = strip_tags(template_en)
    res = re.sub(r"\s+", " ", resolved or "").strip()
    parts = TOKEN.split(tpl)
    if len(parts) < 3 or not res:
        return {}
    pattern, toks = "", []
    for i, p in enumerate(parts):
        if i % 2 == 0:
            pattern += r"\s*".join(re.escape(w) for w in p.split(" ")) if p.strip() else r"\s*"
        else:
            toks.append(norm_token(p))
            pattern += r"\s*(.*?)\s*"
    try:
        m = re.fullmatch(pattern, res, flags=re.S)
    except re.error:
        return {}
    if not m:
        return {}
    out = {}
    for t, v in zip(toks, m.groups()):
        v = v.strip()
        if v and "{{" not in v:
            out.setdefault(t, v)
    return out


def dv_lookup(token, dv, max_rank):
    name, mult = token, 1.0
    m = re.match(r"^([a-z0-9_]+)\*([0-9.]+)$", token)
    if m:
        name, mult = m.group(1), float(m.group(2))
    if name.endswith("nl"):
        return None
    lower = {k.lower(): v for k, v in dv.items()}
    return per_rank(lower[name], mult, max_rank) if name in lower else None


def fill(text, mapping, dv, max_rank, extra):
    vals = []

    def repl(m):
        t = norm_token(m.group(1))
        if t == "spellmodifierdescriptionappend":
            return ""
        v = mapping.get(t) or extra.get(t) or dv_lookup(t, dv, max_rank)
        vals.append(ko_terms(v) if v else "?")
        return f"{len(vals) - 1}"

    return TOKEN.sub(repl, text or ""), vals


RATIO_CLASS = [("마법 저항력", "kr"), ("주문력", "kap"), ("공격력", "kp"), ("방어력", "ka"), ("체력", "kh"),
               ("마나", "kmn"), ("이동 속도", "ksp"), ("공격 속도", "kp")]


def fmt_value(v):
    """'25/35 (+60% 추가 공격력)' → 랭크 구분 ' / ', 계수 괄호는 종류별 색상."""
    v = re.sub(r"\s*/\s*", " / ", v.strip())
    v = re.sub(r"\(\s*\+\s*", "(+ ", v)
    out = []
    for part in re.split(r"(\([^()]*\))", v):
        if not part:
            continue
        if part.startswith("(") and part.endswith(")"):
            cls = next((c for k, c in RATIO_CLASS if k in part), "kl")
            out.append(f'<span class="{cls}">{esc(part)}</span>')
        else:
            out.append(esc(part))
    return "".join(out)


def finish(text, vals):
    html = clean(text)

    def sub(m):
        v = vals[int(m.group(1))]
        if not v:
            return ""
        return '<span class="v q">?</span>' if v == "?" else f'<span class="v">{fmt_value(v)}</span>'

    html = re.sub("(\\d+)", sub, html)
    html = re.sub(r'([가-힣])(<span class="v)', r"\1 \2", html)  # '대상을3초' → '대상을 3초'
    html = re.sub(r"\s+([.,])", r"\1", html)
    return drop_live_lines(polish(html))


PARTYPE_SKIP = {"", "없음", "소모값 없음", "None"}


def resource_text(tpl, partype, cost, dv, mr, mapping):
    """스킬 비용 문구: '{{ abilityresourcename }} {{ cost }}' → '40 / 45 마나'."""
    res = partype.strip() if partype.strip() not in PARTYPE_SKIP else ""
    c = per_rank(cost, 1, mr) if any(cost) else ""
    t = re.sub(r"\s+", " ", tpl or "").strip()
    if not t or t == "소모값 없음":
        return f"{c} {res}".strip() if c else ""
    if norm_token(t) in ("{{abilityresourcename}}{{cost}}", "{{cost}}{{abilityresourcename}}"):
        return f"{c} {res}".strip() if c else ""
    bad = False

    def repl(m):
        nonlocal bad
        tok = norm_token(m.group(1))
        if tok == "abilityresourcename":
            return res
        if tok == "cost":
            return c or "?"
        v = None if ":" in tok else (mapping.get(tok) or dv_lookup(tok, dv, mr))
        if not v:
            bad = True
            return "?"
        return ko_terms(v)

    out = re.sub(r"\s{2,}", " ", TOKEN.sub(repl, t)).strip()
    if bad:
        return f"{c} {res}".strip() if c else ""
    return out


def skill_details(ko, en, facts):
    partype = ko.get("partype") or ""
    fa = (facts or {}).get("abilities", {})
    slots = [("P", ko["passive"], en["passive"] if en else None, fa.get("passive"))]
    for i, key in enumerate("QWER"):
        slots.append((key, ko["spells"][i], en["spells"][i] if en else None, fa.get(key)))
    out = []
    for key, ks, es, f in slots:
        f = f or {}
        dv = f.get("dataValues") or {}
        mr = f.get("maxRank") or ks.get("maxrank") or 1
        entry = {"k": key}
        if key == "P":
            mapping = align(es.get("description") if es else "", f.get("resolvedDescription")) if f else {}
            text, vals = fill(ks.get("description", ""), mapping, dv, mr, {})
            entry["tt"] = finish(text, vals)
            out.append(entry)
            continue
        cd = f.get("cooldownByRank") or ks.get("cooldown") or []
        cost = f.get("costByRank") or ks.get("cost") or []
        rng = f.get("rangeByRank") or ks.get("range") or []
        extra = {"cooldown": per_rank(cd, 1, mr), "cost": per_rank(cost, 1, mr)}
        if f:
            mapping = align(es.get("tooltip") if es else "", f.get("resolvedDescription"))
            text, vals = fill(ks.get("tooltip") or ks.get("description", ""), mapping, dv, mr, extra)
        else:
            mapping, text, vals = {}, ks.get("description", ""), []
        entry["tt"] = finish(text, vals)
        if not re.sub(r"<[^>]+>|\s|\?", "", entry["tt"]):   # 설명이 템플릿뿐이라 비거나 ?만 남으면(예: 아펠리오스 Q·E, 아크샨 W) 공식 요약 설명으로 대신
            entry["tt"] = finish(ks.get("description", ""), [])
        meta = []
        if any(rng):
            meta.append(["범위", "전역" if all(x >= 25000 for x in rng[:mr]) else per_rank(rng, 1, mr)])
        cost_txt = resource_text(ks.get("resource") or "", partype, cost, dv, mr, mapping)
        if cost_txt:
            meta.append(["비용", cost_txt])
        if any(cd):
            meta.append(["재사용 대기시간", per_rank(cd, 1, mr) + "초"])
        entry["meta"] = meta
        entry["mr"] = mr
        out.append(entry)
    return out


# ---------------------------------------------------------------- 스프라이트
_DIRS = {}
def resolve_path(path):
    """이미지 경로 찾기. 공식 데이터의 파일 이름과 실제 파일 이름의 대소문자가 다른 경우가 있어
    (예: VelKoz_Passive.png ↔ Velkoz_Passive.png, 공식 CDN은 대소문자를 가리지 않음) 같은 폴더에서 대소문자 무시하고 다시 찾음"""
    if os.path.exists(path):
        return path
    d, fn = os.path.split(path)
    if d not in _DIRS:
        try:
            _DIRS[d] = {x.lower(): x for x in os.listdir(d)}
        except OSError:
            _DIRS[d] = {}
    hit = _DIRS[d].get(fn.lower())
    return os.path.join(d, hit) if hit else None


class Sheet:
    def __init__(self, name, size, cols):
        self.name, self.size, self.cols = name, size, cols
        self.paths = []
        self.index = {}

    def add(self, key, path):
        if key in self.index:
            return self.index[key]
        path = resolve_path(path)
        if not path:
            return -1
        self.index[key] = len(self.paths)
        self.paths.append(path)
        return self.index[key]

    def save(self):
        n = len(self.paths)
        rows = max(1, math.ceil(n / self.cols))
        sheet = Image.new("RGBA", (self.cols * self.size, rows * self.size), (0, 0, 0, 0))
        for i, p in enumerate(self.paths):
            im = Image.open(p).convert("RGBA").resize((self.size, self.size), Image.LANCZOS)
            sheet.paste(im, ((i % self.cols) * self.size, (i // self.cols) * self.size))
        fn = f"sprites/{self.name}.webp"
        sheet.save(os.path.join(OUT, fn), "WEBP", quality=90, method=6)
        h = hashlib.md5(open(os.path.join(OUT, fn), "rb").read()).hexdigest()[:10]  # 이미지가 바뀌면 주소도 바뀌어 예전 캐시를 쓰지 않음
        return {"url": fn, "size": self.size, "cols": self.cols, "rows": rows, "h": h}


sh_items = Sheet("items", 64, 20)
sh_champs = Sheet("champs", 128, 16)   # 원본 최대 해상도 (아이템·주문·스킬 64, 챔피언 128, 핵심 룬 256)
# 스킬 그림은 챔피언 24명씩 나눠 저장: 화면에 필요한 묶음만 내려받고 해독 (한 장 1.6MB → 묶음당 약 0.2MB)
SKILL_GROUP = 24
sh_skill_groups = []
sh_runes = Sheet("runes", 128, 12)
sh_spells = Sheet("spells", 64, 8)

# ---------------------------------------------------------------- 챔피언 + 스킬 상세
champ_full = load("championFull.json")["data"]
try:
    champ_en = load("championFull.json", DATA_EN)["data"]
except FileNotFoundError:
    champ_en = {}
facts_version = ""
if FACTS and os.path.isdir(FACTS):
    vf = os.path.join(os.path.dirname(os.path.normpath(FACTS)), "version.json")
    if os.path.exists(vf):
        facts_version = json.load(open(vf)).get("version", "")

STAT_KEYS = ["hp", "hpperlevel", "hpregen", "hpregenperlevel", "mp", "mpperlevel", "mpregen", "mpregenperlevel",
             "attackrange", "attackdamage", "attackdamageperlevel", "attackspeed", "attackspeedperlevel",
             "armor", "armorperlevel", "spellblock", "spellblockperlevel", "movespeed"]


def champ_stats(st):
    """기본 능력치와 레벨당 성장치(STAT_KEYS 순서)."""
    return [round(float(st.get(k, 0) or 0), 4) for k in STAT_KEYS]


champs = []
skill_out = {}
resolved = unresolved = 0
for ci, (cid, c) in enumerate(champ_full.items()):
    if ci % SKILL_GROUP == 0:
        sh_skill_groups.append(Sheet(f"skills{len(sh_skill_groups)}", 64, 12))
    sh_skills = sh_skill_groups[-1]
    skills = []
    p = c["passive"]
    skills.append({"k": "P", "n": p["name"], "i": sh_skills.add("P:" + cid, os.path.join(IMG, "passive", p["image"]["full"]))})
    for key, s in zip("QWER", c["spells"]):
        skills.append({"k": key, "n": s["name"], "i": sh_skills.add(cid + key, os.path.join(IMG, "spell", s["image"]["full"]))})
    champs.append({
        "id": cid, "key": c["key"], "n": c["name"], "t": c["title"], "tags": c["tags"],
        "res": c.get("partype", ""),
        "s": champ_stats(c.get("stats") or {}),
        "i": sh_champs.add(cid, os.path.join(IMG, "champion", c["image"]["full"])),
        "sk": skills, "ss": sh_skills.name,
    })
    facts = None
    fp = os.path.join(FACTS, cid + ".json") if FACTS else ""
    if fp and os.path.exists(fp):
        facts = json.load(open(fp, encoding="utf-8"))
    det = skill_details(c, champ_en.get(cid), facts)
    for d in det[1:]:
        if 'class="v q"' in d["tt"]:
            unresolved += 1
        else:
            resolved += 1
    skill_out[cid] = det
champs.sort(key=lambda x: x["n"])

# ---------------------------------------------------------------- 아이템
raw = load("item.json")["data"]


def available(v, m):
    return (v["gold"]["purchasable"] and v["maps"].get(m) and v.get("inStore", True) is not False
            and not v.get("hideFromAll") and not v.get("requiredChampion") and not v.get("requiredAlly")
            and len(v.get("tags", [])) <= 12)


def pick(mapid):
    chosen = {}
    for k, v in raw.items():
        if not available(v, mapid):
            continue
        cur = chosen.get(v["name"])
        if cur is None or (len(k), k) < (len(cur), cur):
            chosen[v["name"]] = k
    return set(chosen.values())


sr_ids = pick("11")
ar_ids = pick("12")
all_ids = sr_ids | ar_ids

ATTACK = {"Damage", "AttackSpeed", "CriticalStrike", "LifeSteal", "ArmorPenetration", "OnHit"}
MAGIC = {"SpellDamage", "Mana", "ManaRegen", "MagicPenetration", "SpellVamp"}
DEFENSE = {"Health", "Armor", "SpellBlock", "HealthRegen", "MagicResist", "Tenacity"}
UTILITY = {"Vision", "GoldPer", "Aura", "Consumable", "Trinket"}


def categories(v):
    t = set(v.get("tags", []))
    cats = []
    if "Boots" in t:
        cats.append("boots")
    if ({"Lane", "Jungle"} & t and v["gold"]["total"] <= 500) or "Consumable" in t or "Trinket" in t:
        cats.append("start")
    if t & ATTACK:
        cats.append("atk")
    if t & MAGIC:
        cats.append("mag")
    if t & DEFENSE:
        cats.append("def")
    if t & UTILITY:
        cats.append("util")
    return cats


items = {}
for k in sorted(all_ids, key=lambda x: (raw[x]["gold"]["total"], raw[x]["name"])):
    v = raw[k]
    st, rest = stats_lines(v.get("description", ""))
    frm = [x for x in v.get("from", []) if x in all_ids]
    into = [x for x in v.get("into", []) if x in all_ids]
    tier = "basic" if not v.get("from") else ("epic" if into else "legend")
    if "Boots" in v.get("tags", []):
        tier = "boots"
    if "Consumable" in v.get("tags", []) or "Trinket" in v.get("tags", []):
        tier = "consumable"
    items[k] = {
        "n": v["name"], "g": v["gold"]["total"], "b": v["gold"]["base"], "s": v["gold"].get("sell", 0),
        "st": st, "d": fix_zero(clean(rest)), "pt": v.get("plaintext", ""),
        "from": frm, "into": into, "c": categories(v), "tier": tier,
        "sr": 1 if k in sr_ids else 0, "ar": 1 if k in ar_ids else 0,
        "i": sh_items.add(k, os.path.join(IMG, "item", v["image"]["full"])),
    }

# ---------------------------------------------------------------- 룬
styles, runes = [], {}
for t in load("runesReforged.json"):
    slots = []
    for s in t["slots"]:
        ids = []
        for r in s["runes"]:
            runes[str(r["id"])] = {
                "n": r["name"], "d": clean(r.get("shortDesc")), "ld": clean(r.get("longDesc")),
                "i": sh_runes.add(r["id"], os.path.join(PERK, r["icon"])),
            }
            ids.append(str(r["id"]))
        slots.append(ids)
    styles.append({"id": str(t["id"]), "n": t["name"], "key": t["key"],
                   "i": sh_runes.add("style" + str(t["id"]), os.path.join(PERK, t["icon"])), "slots": slots})

SM = os.path.join(PERK, "perk-images", "StatMods")
# 능력치 파편: Data Dragon 미제공 → 2024 시즌 개편 이후 알려진 값
shard_defs = {
    "5008": ("적응형 능력치", "+9 (공격력 5.4 또는 주문력 9)", "StatModsAdaptiveForceIcon.png"),
    "5005": ("공격 속도", "+10%", "StatModsAttackSpeedIcon.png"),
    "5007": ("스킬 가속", "+8", "StatModsCDRScalingIcon.png"),
    "5010": ("이동 속도", "+2%", "StatModsMovementSpeedIcon.png"),
    "5001": ("체력 증가", "+10~180 (레벨 비례)", "StatModsHealthScalingIcon.png"),
    "5011": ("체력", "+65", "StatModsHealthPlusIcon.png"),
    "5013": ("강인함 및 둔화 저항", "+10%", "StatModsTenacityIcon.png"),
}
shard_info = {sid: {"n": n, "val": val, "i": sh_runes.add("shard" + sid, os.path.join(SM, fn))}
              for sid, (n, val, fn) in shard_defs.items()}
shard_rows = [
    {"n": "공격", "ids": ["5008", "5005", "5007"]},
    {"n": "유연", "ids": ["5008", "5010", "5001"]},
    {"n": "방어", "ids": ["5011", "5013", "5001"]},
]

# ---------------------------------------------------------------- 소환사 주문
# 칼바람 나락 오라: 소환사 주문 가속 70 (재사용 대기시간 × 100/170), 탈진은 칼바람 기본값 290초 (LoL Wiki 기준, Data Dragon 미제공)
ARAM_SPELL_HASTE = 70
ARAM_SPELL_BASE = {"SummonerExhaust": "290"}
spells = []
for k, v in load("summoner.json")["data"].items():
    modes = v.get("modes", [])
    if any(x in k for x in ("_Jade", "Cherry", "Poro", "UltBook", "SnowURF")):
        continue
    sr, ar = "CLASSIC" in modes, "ARAM" in modes
    if not (sr or ar):
        continue
    acd = ""
    if ar:
        try:
            acd = str(int(round(float(ARAM_SPELL_BASE.get(k, v.get("cooldownBurn", "0"))) * 100 / (100 + ARAM_SPELL_HASTE))))
        except ValueError:
            acd = ""
    spells.append({
        "id": k, "n": v["name"], "d": fix_zero(clean(v.get("description"))), "cd": v.get("cooldownBurn", ""), "acd": acd,
        "sr": 1 if sr else 0, "ar": 1 if ar else 0,
        "i": sh_spells.add(k, os.path.join(IMG, "spell", v["image"]["full"])),
    })
order = ["SummonerFlash", "SummonerTeleport", "SummonerDot", "SummonerSmite", "SummonerHeal",
         "SummonerExhaust", "SummonerBarrier", "SummonerBoost", "SummonerHaste", "SummonerMana", "SummonerSnowball"]
spells.sort(key=lambda s: order.index(s["id"]) if s["id"] in order else 99)

# ---------------------------------------------------------------- 칼바람 보정
MOD_KO = [("Healing done", "회복량"), ("Shielding done", "보호막"), ("Ability haste", "스킬 가속"),
          ("Total attack speed", "총 공격 속도"), ("Tenacity", "강인함"), ("Energy regeneration", "기력 회복")]


def ko_range(t):
    t = re.sub(r"(\d)-(\d)", r"\1~\2", t)
    t = re.sub(r"(\d)s\b", r"\1초", t)
    return t


AB_RULES = [  # 번역표에 없는 흔한 형식
    (r"^Cooldown (.+?) → (.+?)( at all ranks)?$", lambda m: f"재사용 대기시간 {ko_range(m.group(1))} → {'모든 레벨 ' if m.group(3) else ''}{ko_range(m.group(2))}"),
    (r"^(Total bonus AD|Bonus AD|Total AP|Heal AP|Shield AP|AP|AD) ratio (.+?) → (.+?)(?: bonus AD| AD| AP)?$",
     lambda m: {"Total bonus AD": "총 추가 공격력", "Bonus AD": "추가 공격력", "Total AP": "총 주문력", "Heal AP": "회복 주문력",
                "Shield AP": "보호막 주문력", "AP": "주문력", "AD": "공격력"}[m.group(1)] + f" 계수 {ko_range(m.group(2))} → {ko_range(m.group(3))}"),
    (r"^(Base damage|Duration|Base heal|Total heal) (.+?) → (.+)$",
     lambda m: {"Base damage": "기본 피해량", "Duration": "지속시간", "Base heal": "기본 회복량", "Total heal": "총 회복량"}[m.group(1)] + f" {ko_range(m.group(2))} → {ko_range(m.group(3))}"),
]


def aram_ab(seg, table, missing):
    if seg in table:
        return table[seg]
    for pat, fn in AB_RULES:
        m = re.match(pat, seg)
        if m:
            return fn(m)
    missing.append(seg)
    return seg


aram = {}
aram_missing = []
aram_src = ""
raw_path = os.path.join(ARAM_DIR, "aram_raw.txt")
if os.path.exists(raw_path):
    try:
        table = json.load(open(os.path.join(ARAM_DIR, "aram_ko.json"), encoding="utf-8"))
    except (OSError, ValueError):
        table = {}
    en_to_id = {c["name"]: cid for cid, c in champ_en.items()} if champ_en else {}
    for line in open(raw_path, encoding="utf-8"):
        line = line.strip()
        if line.startswith("#"):
            m = re.search(r"Patch\s*([\d.]+)", line)
            aram_src = m.group(1) if m else aram_src
            continue
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        cid = en_to_id.get(parts[0].strip())
        if not cid:
            continue
        mods = []
        for label, val, good_if_pos in (("주는 피해", parts[1], True), ("받는 피해", parts[2], False)):
            v = val.strip()
            if v and v not in ("0%", "+0%", "-0%"):
                mods.append([label, v, 1 if v.startswith("+") == good_if_pos else 0])
        for m in [x.strip() for x in (parts[3] if len(parts) > 3 else "").split(",") if x.strip()]:
            mm = re.match(r"^(.+?) (increased|reduced) by ([\d.]+%?)$", m)
            if not mm:
                aram_missing.append(m)
                continue
            label = next((ko for en, ko in MOD_KO if mm.group(1).lower() == en.lower()), None)
            if not label:
                aram_missing.append(m)
                continue
            up = mm.group(2) == "increased"
            mods.append([label, ("+" if up else "-") + mm.group(3), 1 if up else 0])
        abil, key = [], ""
        for seg in [x.strip() for x in "|".join(p for p in parts[4:] if p.strip()).split(";") if x.strip()]:
            km = re.match(r"^([PQWER])(?=[A-Z])", seg)
            if km:
                key, seg = km.group(1), seg[1:]
            abil.append([key, aram_ab(seg, table, aram_missing)])
        aram[cid] = {"m": mods, "ab": abil}
for c in champs:
    if aram:
        c["a"] = aram.get(c["id"], {"m": [], "ab": []})

# ---------------------------------------------------------------- 저장
sheets = {"items": sh_items.save(), "champs": sh_champs.save(), "runes": sh_runes.save(), "spells": sh_spells.save()}
for g in sh_skill_groups:
    sheets[g.name] = g.save()
kst = timezone(timedelta(hours=9))
out = {
    "v": dd_version, "patch": patch, "built": datetime.now(kst).strftime("%Y-%m-%d"), "sv": facts_version,
    "champs": champs, "items": items,
    "runes": {"styles": styles, "r": runes, "shards": shard_info, "shardRows": shard_rows},
    "spells": spells, "sheets": sheets, "aramSrc": aram_src,
}
# 내용 지문: 날짜·버전이 같아도 내용이 바뀌면 값이 달라져 폰에 저장된 예전 데이터를 확실히 교체
sk_text = json.dumps({"v": dd_version, "sv": facts_version, "champs": skill_out}, ensure_ascii=False, separators=(",", ":"))
out["skrev"] = hashlib.md5(sk_text.encode("utf-8")).hexdigest()[:10]
out["rev"] = hashlib.md5(json.dumps(out, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()[:10]
with open(os.path.join(OUT, "data.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(OUT, "skills.json"), "w", encoding="utf-8") as f:
    f.write(sk_text)

print(json.dumps({
    "version": dd_version, "patch": patch, "skill_data_version": facts_version or "없음",
    "champions": len(champs), "items": len(items), "sr_items": len(sr_ids), "aram_items": len(ar_ids),
    "runes": len(runes), "spells": len(spells), "skills_fully_resolved": resolved, "skills_partial": unresolved,
    "aram_champions": len(aram), "aram_source_patch": aram_src or "없음", "aram_untranslated": sorted(set(aram_missing)),
}, ensure_ascii=False))
