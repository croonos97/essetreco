# Folha de contato de uma pasta de prévias: python3 tools/folha_r5.py <pasta> <saida.jpg> [colunas]
import glob, re, sys
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 9
key = lambda f: float(re.search(r'f_([\d.]+?)\.jpg', f).group(1))
fs = sorted(glob.glob(d + '/f_*.jpg'), key=key)
ims = [Image.open(f).convert('RGB').resize((270, 480)) for f in fs]
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (270 * cols, 480 * rows), (15, 15, 15)); g = ImageDraw.Draw(S)
for k, (im, f) in enumerate(zip(ims, fs)):
    x, y = (k % cols) * 270, (k // cols) * 480; S.paste(im, (x, y)); g.rectangle([x, y, x + 52, y + 14], fill=(0, 0, 0)); g.text((x + 3, y + 1), f'{key(f):g}s', fill=(255, 255, 0))
S.save(out, quality=86); print(len(fs), S.size)
