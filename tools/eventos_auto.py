"""Efeitos sonoros automáticos a partir da linha do tempo (piscina, telhado, prédio).

Uso: python3 tools/eventos_auto.py <id>
Regras: whoosh no começo de cada cena; "pop" quando a peça é nomeada ("Esse é o…");
snap/crackle/roar nas palavras de desastre; ok nas soluções; riser antes do "Parabéns".
Palavras específicas por vídeo em ESPECIAIS.
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = sys.argv[1]
base = os.path.join(ROOT, "public", vid)
tl = json.load(open(os.path.join(base, "timeline.json")))


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


DESASTRE = {"desmorona": "roar", "racham": "crackle", "desmoronar": "roar", "afundar": "roar", "arrebentar": "snap", "envergam": "crackle",
            "escorregar": "whoosh", "cai": "snap", "sai": "roar", "lama": "shiver", "verde": "shiver", "vizinho": "x", "cabelo": "x",
            "forno": "shiver", "rasgo": "whoosh", "cama": "x", "balanca": "roar"}
ESPECIAIS = {
    "piscina": {"cavar": "clank", "agua": None, "concreto": "clank", "azulejo": "pop", "cloro": "pop", "bomba": "spinup", "boca": "pop", "dois": "pop", "valvula": "clank"},
    "telhado": {"pregar": "clank", "telhas": "pop", "triangulos": "clank", "ripas": "clank", "curvas": "pop", "canaleta": "clank", "aluminio": "whoosh"},
    "ornitorrinco": {"mergulha": "whoosh", "sinalzinho": "spinup", "balancando": "whoosh", "bochechas": "pop", "veneno": "shiver", "cachorro": "snap", "chute": "snap", "ovo": "pop", "lambe": "pop", "tesoura": "snap", "ia": "pop"},
    "predio": {"empilhar": "pop", "pilares": "clank", "crava": "clank", "torre": "riser", "cabine": "clank", "garras": "snap", "corda": "snap", "bomba": "spinup", "metal": "clank"},
}.get(vid, {})

ev = []
last_label = ""
for i, c in enumerate(tl["cenas"]):
    if i > 0:
        ev.append({"kind": "whoosh", "t": c["start"], "lead": -0.25, "gain": 0.55})
    used = set()
    for w in c["words"]:
        k = norm(w["w"])
        if k in ("esse", "essa", "essas", "esses") and c["label"] and c["label"] != last_label:
            # nome da peça logo depois
            ev.append({"kind": "pop", "t": w["e"] + 0.15, "gain": 0.75})
            ev.append({"kind": "ok", "t": w["e"] + 0.35, "gain": 0.45})
        kind = DESASTRE.get(k) or ESPECIAIS.get(k)
        if kind and k not in used:
            used.add(k)
            e = {"kind": kind, "t": w["s"], "gain": 0.7}
            if kind == "roar":
                e["dur"] = 1.6
            if kind == "x":
                e["t"] = w["e"]
            ev.append(e)
    last_label = c["label"] or last_label
fim = tl["cenas"][-1]
ev.append({"kind": "riser", "t": fim["start"] - 1.2, "gain": 0.6})
ev.append({"kind": "ok", "t": fim["words"][-1]["s"], "gain": 0.8})
ev.sort(key=lambda e: e["t"])
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(vid, len(ev), "eventos")
