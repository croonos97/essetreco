"""Efeitos sonoros do vídeo do motor a jato."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "jato")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
tO = W("revelacao", "O")
cuts = [C("ventilador")["start"], C("compressor")["start"], tO]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.8} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.6})
    last = c["label"]
st = W("compressor", "fileiras")
ev += [{"kind": "clank", "t": W("compressor", "Então") + 0.25, "gain": 0.7}, {"kind": "clank", "t": W("compressor", "aperta") + 0.2, "gain": 0.8}]
ev += [{"kind": "clank", "t": st + i * 0.27 + 0.2, "gain": 0.55} for i in range(6)]
ev += [
    {"kind": "spinup", "t": W("ventilador", "Você"), "dur": 2.0, "gain": 0.6},
    {"kind": "x", "t": W("fraco", "fraco"), "gain": 0.7},
    {"kind": "spinup", "t": st + 0.5, "dur": 2.0, "gain": 0.5},
    {"kind": "clank", "t": W("camara", "joga") + 0.2, "gain": 0.8},
    {"kind": "crackle", "t": W("camara", "acende"), "gain": 0.6},
    {"kind": "snap", "t": W("camara", "violência"), "gain": 0.7},
    {"kind": "roar", "t": W("camara", "acende"), "dur": W("problema", "apaga") - W("camara", "acende"), "gain": 0.45},
    {"kind": "clank", "t": W("bocal", "trás") , "gain": 0.8},
    {"kind": "riser", "t": W("bocal", "jato"), "lead": -0.8, "gain": 0.5},
    {"kind": "x", "t": W("problema", "apaga"), "gain": 0.7},
    {"kind": "clank", "t": W("turbina", "cata-vento") + 0.2, "gain": 0.8},
    {"kind": "clank", "t": W("turbina", "eixo") + 0.2, "gain": 0.8},
    {"kind": "roar", "t": W("turbina", "jato", 1), "dur": tO - W("turbina", "jato", 1), "gain": 0.45},
    {"kind": "spinup", "t": W("turbina", "girando") - 0.3, "dur": 1.5, "gain": 0.5},
    {"kind": "ok", "t": W("turbina", "sozinho"), "gain": 0.8},
    {"kind": "x", "t": W("gasta", "demais"), "gain": 0.7},
    {"kind": "clank", "t": W("fan", "ventilador") + 0.2, "gain": 0.9},
    {"kind": "clank", "t": W("fan", "frente") + 0.2, "gain": 0.8},
    {"kind": "clank", "t": W("fan", "cata-ventos") + 0.2, "gain": 0.6},
    {"kind": "clank", "t": W("fan", "cata-ventos") + 0.45, "gain": 0.6},
    {"kind": "ok", "t": W("fan", "economia"), "gain": 0.8},
    {"kind": "riser", "t": W("revelacao", "jato"), "lead": -1.0, "gain": 0.6},
    {"kind": "roar", "t": tO, "dur": tl["duration"] - tO + 0.8, "gain": 0.55},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
