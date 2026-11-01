# Confere os planos de um vídeo do kit: python3 tools/checa_planos.py src/videos/Macaco.tsx public/animal_macaco/timeline.json [extra_s]
# Avalia P(de, ate, ...) com wordAt (com repetição) e acusa duração negativa, buracos e sobreposição.
import json, re, sys, unicodedata, math
src, tl = sys.argv[1], sys.argv[2]
extra = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
T = json.load(open(tl))
norm = lambda s: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower())
C = {c['id']: c for c in T['cenas']}
def w(c, word, n=0): return [x for x in C[c]['words'] if norm(x['w']) == norm(word)][n]['s']
def S(c): return C[c]['start']
FPS = 30
FIM = (math.ceil((T['duration'] + extra) * FPS) - 1) / FPS
code = open(src).read()
mo = re.search(r'^const OFF = ([\d.]+);', code, re.M)
OFF = float(mo.group(1)) if mo else 0.0
_w, _S = w, S
w = lambda c, word, n=0: _w(c, word, n) + OFF
S = lambda c: _S(c) + OFF
FIM = (math.ceil((T['duration'] + OFF + extra) * FPS) - 1) / FPS
env = dict(w=w, S=S, FIM=FIM, FPS=FPS)
# constantes simples "const X = <expr com w/S>;"
for m in re.finditer(r'^const (\w+) = ([^;\n]*(?:w\(|S\()[^;\n]*);', code, re.M):
    try: env[m.group(1)] = eval(m.group(2).replace('/ FPS', '/FPS'), env)
    except Exception: pass
out = []
for m in re.finditer(r'^  P\((.+?), \{', code, re.M):
    args = m.group(1); d = 0
    for i, ch in enumerate(args):
        d += ch == '('; d -= ch == ')'
        if ch == ',' and d == 0: a, b = args[:i], args[i + 1:]; break
    try: out.append((eval(a, env), eval(b, env), m.start()))
    except Exception as e: out.append((None, None, m.start())); print('não avaliou:', args[:60], e)
ok = True
for i, (a, b, _) in enumerate(out):
    if a is None: continue
    if b <= a: print(f'plano {i}: duração negativa {a:.2f} → {b:.2f}'); ok = False
    if i and out[i - 1][1] is not None and abs(out[i - 1][1] - a) > 0.02: print(f'plano {i}: começa em {a:.2f}, anterior termina em {out[i-1][1]:.2f}')
print(len(out), 'planos;', 'OK' if ok else 'COM ERROS', f'FIM={FIM:.2f}')
print(' '.join(f'{a:.2f}' for a, b, _ in out if a is not None))
