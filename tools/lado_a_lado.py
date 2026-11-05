# Lado a lado com a referência: python3 tools/lado_a_lado.py saida.jpg nosso1.jpg ref1.jpg nosso2.jpg ref2.jpg ...
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
h = 640
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    ims.append(im.resize((int(im.width * h / im.height), h)))
w = max(i.width for i in ims)
pairs = len(ims) // 2
S = Image.new("RGB", (w * 2 * min(pairs, 3), h * ((pairs + 2) // 3)), (18, 18, 18))
d = ImageDraw.Draw(S)
for k in range(pairs):
    x = (k % 3) * w * 2; y = (k // 3) * h
    for j, lab in enumerate(["NOSSO", "REFERÊNCIA"]):
        S.paste(ims[2 * k + j], (x + j * w, y))
        d.rectangle([x + j * w, y, x + j * w + 120, y + 18], fill=(0, 0, 0))
        d.text((x + j * w + 4, y + 3), lab, fill=(255, 255, 0) if j == 0 else (120, 220, 255))
S.save(out, quality=88)
print(out, S.size)
