"""Efeitos sonoros do vídeo da barragem."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "barragem")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["paredao", "base", "cortina", "vertedouro", "degraus"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.7} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"] + 0.3, "lead": 0.02, "gain": 0.6})
    last = c["label"]
ev += [
    {"kind": "clank", "t": W("gancho", "terra"), "gain": 0.5},
    {"kind": "roar", "t": W("gancho", "trava"), "dur": 2.5, "gain": 0.25},
    {"kind": "ok", "t": W("gancho", "lago"), "gain": 0.6},
    {"kind": "roar", "t": W("transborda", "cima"), "dur": 2.5, "gain": 0.6},
    {"kind": "x", "t": W("transborda", "arrasta"), "gain": 0.8},
    {"kind": "clank", "t": W("paredao", "levanta"), "gain": 0.7},
    {"kind": "ok", "t": W("paredao", "paredão"), "gain": 0.6},
    {"kind": "whoosh", "t": W("racha", "empurra"), "lead": -0.2, "gain": 0.5},
    {"kind": "crackle", "t": W("racha", "trinca"), "gain": 0.8},
    {"kind": "snap", "t": W("racha", "pé"), "gain": 0.8},
    {"kind": "x", "t": W("racha", "pé") + 0.2, "gain": 0.7},
    {"kind": "pop", "t": W("racha", "fundo"), "gain": 0.6},
    {"kind": "whoosh", "t": W("base", "largo"), "lead": -0.2, "gain": 0.6},
    {"kind": "ok", "t": W("base", "triângulo"), "gain": 0.6},
    {"kind": "shiver", "t": W("infiltra", "caminho"), "gain": 0.4},
    {"kind": "x", "t": W("infiltra", "túnel"), "gain": 0.7},
    {"kind": "clank", "t": W("cortina", "finca"), "gain": 0.8},
    {"kind": "clank", "t": W("cortina", "rocha"), "gain": 0.8},
    {"kind": "ok", "t": W("cortina", "atravessa"), "gain": 0.6},
    {"kind": "shiver", "t": W("cheia", "chuvarada"), "gain": 0.5},
    {"kind": "x", "t": W("cheia", "tudo"), "gain": 0.7},
    {"kind": "roar", "t": W("vertedouro", "desce"), "dur": 3.0, "gain": 0.5},
    {"kind": "ok", "t": W("vertedouro", "vertedouro"), "gain": 0.6},
    {"kind": "roar", "t": W("erosao", "rápido"), "dur": 2.5, "gain": 0.6},
    {"kind": "x", "t": W("erosao", "buraco"), "gain": 0.8},
    {"kind": "clank", "t": W("degraus", "escada"), "gain": 0.7},
    {"kind": "ok", "t": W("degraus", "mansinha"), "gain": 0.7},
    {"kind": "spinup", "t": W("bonus", "turbinas"), "dur": 1.5, "gain": 0.6},
    {"kind": "ok", "t": W("bonus", "cidade"), "gain": 0.7},
    {"kind": "riser", "t": W("revelacao", "barragem"), "lead": -1.0, "gain": 0.6},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
