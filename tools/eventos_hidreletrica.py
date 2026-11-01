"""Efeitos sonoros do vídeo da hidrelétrica."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "hidreletrica")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C("roda")["start"], C("chegada")["start"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.8} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.6})
    last = c["label"]
ev += [
    {"kind": "clank", "t": W("ima", "ímã") - 0.2, "gain": 0.6},
    {"kind": "clank", "t": W("ima", "fio") + 0.1, "gain": 0.6},
    {"kind": "crackle", "t": W("ima", "corrente"), "gain": 0.4},
    {"kind": "pop", "t": W("ima", "pisca"), "gain": 0.6},
    {"kind": "x", "t": W("para", "apagou"), "gain": 0.6},
    {"kind": "clank", "t": W("gerador", "eixo"), "gain": 0.7},
    {"kind": "spinup", "t": W("gerador", "girar"), "dur": 1.2, "gain": 0.5},
    {"kind": "clank", "t": W("gerador", "bobinas"), "gain": 0.6},
    {"kind": "clank", "t": W("gerador", "bobinas") + 0.25, "gain": 0.6},
    {"kind": "ok", "t": W("gerador", "acesa"), "gain": 0.7},
    {"kind": "clank", "t": W("cansa", "manivela"), "gain": 0.7},
    {"kind": "x", "t": W("cansa", "aguenta"), "gain": 0.6},
    {"kind": "clank", "t": W("roda", "roda"), "gain": 0.7},
    {"kind": "roar", "t": C("roda")["start"], "dur": C("represa")["start"] - C("roda")["start"], "gain": 0.18},
    {"kind": "ok", "t": W("roda", "você", 1), "gain": 0.7},
    {"kind": "x", "t": W("fraco", "falha"), "gain": 0.7},
    {"kind": "snap", "t": W("represa", "muro"), "gain": 0.9},
    {"kind": "riser", "t": W("represa", "gigante"), "lead": -1.0, "gain": 0.5},
    {"kind": "clank", "t": W("turbina", "abre"), "gain": 0.7},
    {"kind": "clank", "t": W("turbina", "túnel"), "gain": 0.7},
    {"kind": "roar", "t": W("turbina", "despenca"), "dur": C("longe")["start"] - W("turbina", "despenca") + 1, "gain": 0.45},
    {"kind": "spinup", "t": W("turbina", "turbina"), "dur": 1.5, "gain": 0.5},
    {"kind": "crackle", "t": W("turbina", "gerador"), "gain": 0.5},
    {"kind": "x", "t": W("longe", "calor"), "gain": 0.7},
    {"kind": "clank", "t": W("tensao", "tensão"), "gain": 0.8},
    {"kind": "ok", "t": W("tensao", "pequena"), "gain": 0.7},
    {"kind": "clank", "t": W("chegada", "transformadores"), "gain": 0.7},
    {"kind": "ok", "t": W("chegada", "tomada"), "gain": 0.8},
    {"kind": "riser", "t": W("revelacao", "hidrelétrica"), "lead": -1.0, "gain": 0.6},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
ev += [{"kind": "clank", "t": W("tensao", "pendura") + i * 0.3 + 0.2, "gain": 0.45} for i in range(5)]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
