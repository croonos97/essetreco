"""Efeitos sonoros do vídeo do aterro."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "aterro")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["manta", "drenos", "poco", "conserva", "tampa"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.7} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"] + 0.3, "lead": 0.02, "gain": 0.6})
    last = c["label"]
ev += [
    {"kind": "clank", "t": W("gancho", "despejar"), "gain": 0.7},
    {"kind": "roar", "t": W("gancho", "despejar"), "dur": 1.5, "gain": 0.4},
    {"kind": "ok", "t": W("gancho", "aterro"), "gain": 0.6},
    {"kind": "crackle", "t": W("ratos", "ratos"), "gain": 0.5},
    {"kind": "x", "t": W("ratos", "casas"), "gain": 0.8},
    {"kind": "whoosh", "t": W("cobertura", "camada"), "lead": -0.2, "gain": 0.6},
    {"kind": "ok", "t": W("cobertura", "comida"), "gain": 0.6},
    {"kind": "pop", "t": W("lota", "espaço"), "gain": 0.5},
    {"kind": "pop", "t": W("lota", "lota"), "gain": 0.5},
    {"kind": "whoosh", "t": W("lota", "voar"), "lead": -0.2, "gain": 0.6},
    {"kind": "x", "t": W("lota", "estrada"), "gain": 0.7},
    {"kind": "roar", "t": W("compactador", "passa"), "dur": 3.0, "gain": 0.5},
    {"kind": "snap", "t": W("compactador", "esmaga"), "gain": 0.8},
    {"kind": "ok", "t": W("compactador", "compacta"), "gain": 0.6},
    {"kind": "shiver", "t": W("chorume", "chove"), "gain": 0.4},
    {"kind": "x", "t": W("chorume", "vizinho"), "gain": 0.8},
    {"kind": "whoosh", "t": W("manta", "forra"), "lead": -0.2, "gain": 0.6},
    {"kind": "ok", "t": W("manta", "manta"), "gain": 0.6},
    {"kind": "shiver", "t": W("banheira", "enchendo"), "gain": 0.4},
    {"kind": "x", "t": W("banheira", "transbordar"), "gain": 0.8},
    {"kind": "clank", "t": W("drenos", "canos"), "gain": 0.6},
    {"kind": "spinup", "t": W("drenos", "bomba"), "dur": 1.2, "gain": 0.5},
    {"kind": "ok", "t": W("drenos", "tratado"), "gain": 0.6},
    {"kind": "crackle", "t": W("gas", "faísca"), "gain": 0.8},
    {"kind": "snap", "t": W("gas", "explodir"), "gain": 1.0},
    {"kind": "roar", "t": W("gas", "explodir"), "dur": 1.5, "gain": 0.9},
    {"kind": "x", "t": W("gas", "explodir") + 0.6, "gain": 0.8},
    {"kind": "clank", "t": W("poco", "crava"), "gain": 0.7},
    {"kind": "roar", "t": W("poco", "queima"), "dur": 2.0, "gain": 0.4},
    {"kind": "ok", "t": W("poco", "poço"), "gain": 0.6},
    {"kind": "x", "t": W("usina", "toa"), "gain": 0.6},
    {"kind": "spinup", "t": W("usina", "motores"), "dur": 1.4, "gain": 0.6},
    {"kind": "ok", "t": W("usina", "energia"), "gain": 0.7},
    {"kind": "pop", "t": W("conserva", "pote"), "gain": 0.6},
    {"kind": "pop", "t": W("conserva", "jornal"), "gain": 0.7},
    {"kind": "whoosh", "t": W("tampa", "plástico"), "lead": -0.2, "gain": 0.6},
    {"kind": "ok", "t": W("tampa", "grama"), "gain": 0.6},
    {"kind": "riser", "t": W("revelacao", "sanitário"), "lead": -1.0, "gain": 0.6},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
