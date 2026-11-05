"""Marca palavras-chave de várias palavras na timeline (sequência exata). Uso: python3 tools/fix_kw.py <id> roteiros/<arquivo>.json"""
import json, re, sys, unicodedata
def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))
vid, rot = sys.argv[1], sys.argv[2]
p = f"public/{vid}/timeline.json"; tl = json.load(open(p)); r = json.load(open(rot))
num = {"2%":"dois por cento","18":"dezoito"}
tot=0
for c, s in zip(tl["cenas"], r["cenas"]):
    ws = [norm(w["w"]) for w in c["words"]]
    for k in s.get("keywords", []):
        toks = [norm(t) for t in k.split() if norm(t)]
        n=len(toks)
        for i in range(len(ws)-n+1):
            if ws[i:i+n]==toks:
                for j in range(i,i+n): c["words"][j]["kw"]=True
                tot+=1
json.dump(tl, open(p,"w"), ensure_ascii=False, indent=1)
print(vid, "keywords marcadas:", tot)
