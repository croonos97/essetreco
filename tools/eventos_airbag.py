"""Efeitos sonoros do vídeo do airbag."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "airbag")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["cinto", "almofada", "guardar", "quimica", "sensor", "dura", "furos"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.7} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.6})
    last = c["label"]
impacts = [W("gancho", "para"), W("cinto", "Ajuda"), W("almofada", "pancada"), W("rapido", "acontece"), W("sensor", "brusca"), W("dura", "cheia"), W("furos", "momento")]
for i, t in enumerate(impacts):
    ev.append({"kind": "whoosh", "t": t, "lead": -0.5 if i else -1.2, "gain": 0.6})
    ev.append({"kind": "snap", "t": t, "gain": 1.0})
    ev.append({"kind": "clank", "t": t + 0.02, "gain": 0.8})
ev += [
    {"kind": "x", "t": W("inercia", "volante"), "gain": 0.8},
    {"kind": "clank", "t": W("cinto", "cinto"), "gain": 0.6},
    {"kind": "ok", "t": W("cinto", "muito"), "gain": 0.6},
    {"kind": "x", "t": W("cinto", "frente"), "gain": 0.8},
    {"kind": "pop", "t": W("almofada", "almofada"), "gain": 0.7},
    {"kind": "ok", "t": W("almofada", "macia"), "gain": 0.6},
    {"kind": "x", "t": W("almofada", "cara"), "gain": 0.7},
    {"kind": "ok", "t": W("guardar", "batida"), "gain": 0.6},
    {"kind": "clank", "t": W("rapido", "bomba"), "gain": 0.5},
    {"kind": "x", "t": W("rapido", "rápido"), "gain": 0.8},
    {"kind": "clank", "t": W("quimica", "pastilha"), "gain": 0.7},
    {"kind": "crackle", "t": W("quimica", "faísca"), "gain": 0.8},
    {"kind": "snap", "t": W("quimica", "queima"), "gain": 0.9},
    {"kind": "roar", "t": W("quimica", "queima"), "dur": 2.0, "gain": 0.5},
    {"kind": "whoosh", "t": W("quimica", "enche"), "lead": -0.1, "gain": 0.9},
    {"kind": "clank", "t": W("sensor", "sensor"), "gain": 0.6},
    {"kind": "crackle", "t": W("sensor", "manda"), "gain": 0.6},
    {"kind": "whoosh", "t": W("sensor", "hora"), "lead": -0.1, "gain": 0.8},
    {"kind": "x", "t": W("dura", "tudo"), "gain": 0.8},
    {"kind": "pop", "t": W("furos", "furinhos"), "gain": 0.7},
    {"kind": "roar", "t": W("furos", "saindo"), "dur": 2.0, "gain": 0.3},
    {"kind": "ok", "t": W("furos", "calma"), "gain": 0.8},
    {"kind": "riser", "t": W("revelacao", "airbag"), "lead": -1.0, "gain": 0.6},
    {"kind": "ok", "t": W("revelacao", "cinto"), "gain": 0.6},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
