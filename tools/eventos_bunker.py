"""Efeitos sonoros do vídeo do bunker."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "bunker")
tl = json.load(open(os.path.join(base, "timeline.json")))
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
def C(i): return next(c for c in tl["cenas"] if c["id"] == i)
def W(i, w, nth=0): return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]
cuts = [C(k)["start"] for k in ["caixa", "abobada", "respiros", "escotilha", "saida"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.7} for t in cuts]
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"] + 0.3, "lead": 0.02, "gain": 0.6})
    last = c["label"]
ev += [
    {"kind": "clank", "t": W("gancho", "buraco"), "gain": 0.5},
    {"kind": "whoosh", "t": W("gancho", "esconder"), "lead": -0.2, "gain": 0.6},
    {"kind": "ok", "t": W("gancho", "abrigo"), "gain": 0.6},
    {"kind": "shiver", "t": W("desaba", "chuva"), "gain": 0.4},
    {"kind": "roar", "t": W("desaba", "cedem"), "dur": 1.6, "gain": 0.6},
    {"kind": "snap", "t": W("desaba", "desabam"), "gain": 0.9},
    {"kind": "x", "t": W("desaba", "desabam") + 0.3, "gain": 0.8},
    {"kind": "clank", "t": W("caixa", "ferro"), "gain": 0.7},
    {"kind": "ok", "t": W("caixa", "armado"), "gain": 0.6},
    {"kind": "clank", "t": W("peso", "toneladas"), "gain": 0.8},
    {"kind": "crackle", "t": W("trinca", "trincar"), "gain": 0.8},
    {"kind": "snap", "t": W("trinca", "ceder"), "gain": 0.8},
    {"kind": "x", "t": W("trinca", "ceder") + 0.2, "gain": 0.7},
    {"kind": "pop", "t": W("abobada", "arco"), "gain": 0.8},
    {"kind": "whoosh", "t": W("abobada", "laterais"), "lead": -0.3, "gain": 0.6},
    {"kind": "ok", "t": W("abobada", "aguenta"), "gain": 0.6},
    {"kind": "shiver", "t": W("pinga", "atravessa"), "gain": 0.4},
    {"kind": "x", "t": W("pinga", "pingar"), "gain": 0.7},
    {"kind": "whoosh", "t": W("manta", "envolve"), "lead": -0.1, "gain": 0.7},
    {"kind": "ok", "t": W("manta", "borracha"), "gain": 0.6},
    {"kind": "x", "t": W("vela", "sumir"), "gain": 0.7},
    {"kind": "clank", "t": W("respiros", "canos"), "gain": 0.6},
    {"kind": "roar", "t": W("respiros", "entra"), "dur": 2.0, "gain": 0.3},
    {"kind": "ok", "t": W("respiros", "sai"), "gain": 0.6},
    {"kind": "roar", "t": W("enxurrada", "enxurrada"), "dur": 2.5, "gain": 0.5},
    {"kind": "x", "t": W("enxurrada", "abaixo"), "gain": 0.8},
    {"kind": "clank", "t": W("escotilha", "fecha") + 0.4, "gain": 1.0},
    {"kind": "ok", "t": W("escotilha", "escotilha"), "gain": 0.6},
    {"kind": "crackle", "t": W("arvore", "árvore"), "gain": 0.6},
    {"kind": "whoosh", "t": W("arvore", "escotilha"), "lead": -0.5, "gain": 0.8},
    {"kind": "snap", "t": W("arvore", "escotilha") + 0.1, "gain": 1.0},
    {"kind": "clank", "t": W("arvore", "trancado"), "gain": 0.7},
    {"kind": "x", "t": W("arvore", "trancado") + 0.3, "gain": 0.7},
    {"kind": "roar", "t": W("saida", "túnel"), "dur": 2.0, "gain": 0.4},
    {"kind": "ok", "t": W("saida", "emergência"), "gain": 0.8},
    {"kind": "riser", "t": W("revelacao", "bunker"), "lead": -1.0, "gain": 0.6},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
