# Folha de contato: python3 tools/sheet_predio.py out/dir saida.jpg [colunas]
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
lo = float(sys.argv[4]) if len(sys.argv) > 4 else -1
hi = float(sys.argv[5]) if len(sys.argv) > 5 else 1e9
fs = sorted(glob.glob(os.path.join(d, "f_*.jpg")), key=lambda f: float(os.path.basename(f)[2:-4]))
fs = [f for f in fs if lo <= float(os.path.basename(f)[2:-4]) < hi]
W = 240; H = int(W * 1920 / 1080)
rows = (len(fs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + 22)), "black")
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except: font = None
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y + 22))
    dr.text((x + 4, y + 2), os.path.basename(f)[2:-4].lstrip("0") + "s", fill="yellow", font=font)
sheet.save(out, quality=85)
print(out, len(fs))
