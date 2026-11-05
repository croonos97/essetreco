"""Efeitos sonoros do vídeo da panela de pressão."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "panela")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["aberta", "feijao", "valvula", "perigo", "dicas", "fechamento"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.8} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.7})
    last = c["label"]
ev += [
    {"kind": "crackle", "t": 0.2, "gain": 0.35},
    {"kind": "riser", "t": W("gancho", "perigo"), "lead": -0.9, "gain": 0.5},
    {"kind": "x", "t": W("gancho", "perigo"), "gain": 0.5},
    {"kind": "pop", "t": W("aberta", "cem"), "gain": 0.8},
    {"kind": "snap", "t": W("tampa", "veda"), "gain": 0.5},
    {"kind": "pop", "t": W("pressao", "vinte"), "gain": 0.8},
    {"kind": "ok", "t": W("feijao", "pronto"), "gain": 0.7},
    {"kind": "crackle", "t": W("valvula", "levanta"), "gain": 0.5},
    {"kind": "crackle", "t": W("valvula", "chiado"), "gain": 0.6},
    {"kind": "riser", "t": W("perigo", "subir"), "lead": -1.2, "gain": 0.6},
    {"kind": "x", "t": W("perigo", "subir"), "gain": 0.8},
    {"kind": "snap", "t": W("seguranca", "estoura"), "gain": 1.0},
    {"kind": "ok", "t": W("seguranca", "libera"), "gain": 0.8},
    {"kind": "ok", "t": W("dicas", "encha"), "lead": 0.27, "gain": 0.6},
    {"kind": "ok", "t": W("dicas", "limpe"), "lead": 0.27, "gain": 0.6},
    {"kind": "ok", "t": W("dicas", "abra"), "lead": 0.27, "gain": 0.6},
    {"kind": "riser", "t": C("cta")["start"], "lead": -1.1, "gain": 0.5},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
