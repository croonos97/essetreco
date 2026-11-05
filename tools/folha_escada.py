"""Folha de contato da Escada: python3 tools/folha_escada.py <dir> <saida.jpg> [colunas] [largura_celula]
Rotula cada quadro com o tempo, a cena (timeline) e o tempo de render (tempos.tsv)."""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
cw = int(sys.argv[4]) if len(sys.argv) > 4 else 270
tl = json.load(open(os.path.join(os.path.dirname(__file__), "..", "public", "escada", "timeline.json")))
tempos = {}
tp = os.path.join(d, "tempos.tsv")
if os.path.exists(tp):
    for ln in open(tp):
        a = ln.strip().split("\t")
        if len(a) == 2: tempos[float(a[0])] = float(a[1])
fs = sorted(glob.glob(os.path.join(d, "f_*.jpg")), key=lambda x: float(os.path.basename(x)[2:-4]))
ch = int(cw * 16 / 9)
rows = (len(fs) + cols - 1) // cols
img = Image.new("RGB", (cols * cw, rows * ch), (0, 0, 0))
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(12, cw // 15))
def cena(t):
    for c in tl["cenas"]:
        if c["start"] - 0.25 <= t < c["end"] + 0.22: return c["id"]
    return "fim"
for i, f in enumerate(fs):
    t = float(os.path.basename(f)[2:-4])
    im = Image.open(f).convert("RGB").resize((cw, ch))
    x, y = (i % cols) * cw, (i // cols) * ch
    img.paste(im, (x, y))
    dr = ImageDraw.Draw(img)
    lab = f"{t:.1f}s {cena(t)}" + (f" {tempos[t]:.1f}s/q" if t in tempos else "")
    dr.rectangle([x, y, x + cw, y + font.size + 6], fill=(0, 0, 0))
    dr.text((x + 4, y + 2), lab, fill=(255, 220, 0), font=font)
img.save(out, quality=86)
print(out, img.size)
