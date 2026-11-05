# Folha de contato: python3 tools/folha_animais.py saida.jpg cols img1 img2 ... (rótulo = nome do arquivo)
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert("RGB") for f in files]
h = 640
ims = [im.resize((int(im.width * h / im.height), h)) for im in ims]
w = max(im.width for im in ims)
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (w * cols, h * rows), (20, 20, 20))
d = ImageDraw.Draw(S)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im, (x, y))
    d.rectangle([x, y, x + 150, y + 18], fill=(0, 0, 0))
    d.text((x + 4, y + 3), f.split("/")[-1][:24], fill=(255, 255, 0))
S.save(out, quality=88)
print(out, S.size)
