"""Lista de efeitos sonoros do vídeo do chuveiro, nos mesmos instantes usados nas cenas."""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = os.path.join(ROOT, "public", "chuveiro")
tl = json.load(open(os.path.join(base, "timeline.json")))


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def C(i):
    return next(c for c in tl["cenas"] if c["id"] == i)


def W(i, w, nth=0):
    return [x["s"] for x in C(i)["words"] if norm(x["w"]) == norm(w)][nth]


cuts = [C("abertura")["start"], C("gravidade")["start"], C("diafragma")["start"], C("virada")["start"], W("virada", "sete"), C("queima")["start"], C("dica")["start"], C("seguranca")["start"], C("fechamento")["start"]]
ev = [{"kind": "whoosh", "t": t, "lead": -0.25, "gain": 0.8} for t in cuts]

# rótulo do topo: "pop" quando muda
last = ""
for c in tl["cenas"]:
    if c["label"] and c["label"] != last:
        ev.append({"kind": "pop", "t": c["start"], "lead": 0.02, "gain": 0.7})
    last = c["label"]

ev += [
    {"kind": "shiver", "t": 0.1, "gain": 0.8},
    {"kind": "crackle", "t": W("gancho", "queima"), "gain": 0.6},
    {"kind": "crackle", "t": W("diafragma", "encosta"), "gain": 0.5},
    {"kind": "pop", "t": W("virada", "verão"), "gain": 0.6},
    {"kind": "pop", "t": W("virada", "inverno"), "gain": 0.6},
    {"kind": "riser", "t": W("queima", "arrebenta"), "lead": -1.2, "gain": 0.6},
    {"kind": "snap", "t": W("queima", "arrebenta"), "gain": 1.0},
    {"kind": "crackle", "t": W("queima", "arrebenta"), "gain": 0.8},
    {"kind": "x", "t": W("queima", "queimou"), "gain": 0.8},
    {"kind": "crackle", "t": W("queima", "chave"), "gain": 0.8},
    {"kind": "ok", "t": W("dica", "quente", 1), "gain": 0.9},
    {"kind": "ok", "t": W("seguranca", "eletricista"), "gain": 0.9},
    {"kind": "riser", "t": C("cta")["start"], "lead": -1.1, "gain": 0.5},
    {"kind": "pop", "t": C("cta")["start"], "gain": 0.8},
    {"kind": "pop", "t": C("cta")["start"] + 0.2, "gain": 0.8},
]
json.dump(ev, open(os.path.join(base, "eventos.json"), "w"), indent=1)
print(len(ev), "eventos")
