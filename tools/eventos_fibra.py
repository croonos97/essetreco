"""Efeitos sonoros do vídeo da fibra."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "fibra")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["vidro", "reflexao", "central", "rua", "splitter", "casa", "virada", "fechamento"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.8} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.7})
    last = c["label"]
ev += [
    {"kind": "snap", "t": W("gancho", "cortasse") + 0.3, "gain": 0.7},
    {"kind": "riser", "t": W("gancho", "luz"), "lead": -0.9, "gain": 0.6},
    {"kind": "ok", "t": W("gancho", "luz"), "gain": 0.6},
    {"kind": "pop", "t": W("central", "acesa"), "gain": 0.8},
    {"kind": "pop", "t": W("central", "apagada"), "gain": 0.8},
    {"kind": "ok", "t": W("casa", "roteador", 1), "gain": 0.6},
    {"kind": "pop", "t": W("virada", "download"), "gain": 0.6},
    {"kind": "pop", "t": W("virada", "upload"), "gain": 0.6},
    {"kind": "crackle", "t": W("dica", "dobra"), "gain": 0.6},
    {"kind": "x", "t": W("dica", "cai"), "gain": 0.8},
    {"kind": "riser", "t": C("cta")["start"], "lead": -1.1, "gain": 0.5},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
