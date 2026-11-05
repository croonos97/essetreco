"""Trilha de fundo + efeitos sonoros sintetizados, sincronizados à linha do tempo.

Uso: python3 tools/trilha.py chuveiro
Lê public/<id>/timeline.json e public/<id>/eventos.json; grava public/<id>/trilha.wav
"""
import json, os, sys, wave
import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)


def env(n, a, d, s=0.0, r=0.0):
    e = np.ones(n)
    na, nd = int(a * SR), int(d * SR)
    e[:na] = np.linspace(0, 1, max(na, 1))[:na]
    if nd:
        e[na:na + nd] = np.linspace(1, s, nd)[: max(0, min(nd, n - na))]
    e[na + nd:] = s
    if r:
        nr = int(r * SR)
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff, passes=2):
    # filtro passa-baixa vetorizado via FFT (rápido para sinais longos)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 / (1 + (f / cutoff) ** (2 * passes))
    return np.fft.irfft(X * h, len(x))


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 - 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * h, len(x))


def pluck(freq, dur, bright=0.5):
    # Karplus-Strong
    n = int(dur * SR)
    p = int(SR / freq)
    buf = rng.uniform(-1, 1, p)
    buf = lowpass(buf, 2000 + bright * 6000)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * env(n, 0.002, 0, 1, min(0.2, dur * 0.4))


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def music(length):
    bpm = 100
    beat = 60 / bpm
    n = int(length * SR)
    mix = np.zeros(n + SR * 4)
    # progressão I–V–vi–IV em Dó (C G Am F), um acorde por compasso
    chords = [[48, 55, 60, 64], [43, 50, 59, 62], [45, 52, 60, 64], [41, 48, 57, 60]]
    arp_pattern = [0, 2, 3, 2, 1, 3, 2, 3]
    bar = beat * 4
    t = 0.0
    k = 0
    pluck_cache = {}
    while t < length:
        ch = chords[k % 4]
        # pad suave
        pn = int(bar * SR)
        tt = np.arange(pn) / SR
        pad = np.zeros(pn)
        for m in ch[1:]:
            f = note(m)
            for det in (-0.12, 0.12):
                pad += np.sin(2 * np.pi * f * (1 + det / 100) * tt + np.sin(2 * np.pi * 0.3 * tt) * 0.4)
        pad = pad * env(pn, 0.4, 0.0, 1, 0.5) * 0.035
        i0 = int(t * SR)
        mix[i0:i0 + pn] += pad
        # baixo
        bf = note(ch[0] - 12)
        bn = int(bar * SR)
        bass = np.sin(2 * np.pi * bf * np.arange(bn) / SR) * env(bn, 0.01, 0.3, 0.6, 0.2) * 0.12
        mix[i0:i0 + bn] += bass
        # arpejo em colcheias
        for s in range(8):
            m = ch[arp_pattern[s]] + 12
            key = m
            if key not in pluck_cache:
                pluck_cache[key] = pluck(note(m), beat * 0.9, 0.35)
            pl = pluck_cache[key]
            j = int((t + s * beat / 2) * SR)
            mix[j:j + len(pl)] += pl * (0.10 if s % 2 == 0 else 0.07)
        # bumbo suave e chimbal
        for b in range(4):
            j = int((t + b * beat) * SR)
            kn = int(0.25 * SR)
            kt = np.arange(kn) / SR
            kick = np.sin(2 * np.pi * (45 + 70 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 14) * 0.22
            mix[j:j + kn] += kick
            hj = int((t + b * beat + beat / 2) * SR)
            hn = int(0.05 * SR)
            hat = hp_fast(rng.uniform(-1, 1, hn), 7000) * np.exp(-np.arange(hn) / SR * 70) * 0.05
            mix[hj:hj + hn] += hat
        t += bar
        k += 1
    mix = mix[:n]
    fade = int(2.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    return lp_fast(mix, 9000)


# ---------- efeitos ----------
def whoosh(d=0.45):
    n = int(d * SR)
    x = rng.uniform(-1, 1, n)
    tt = np.linspace(0, 1, n)
    # varredura passa-banda aproximada por janelas
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        c = 400 + 5000 * np.sin(np.pi * min(1, i / n)) ** 2
        out[i:i + seg] = lp_fast(x[i:i + seg], c)
    e = np.sin(np.pi * tt) ** 2
    return hp_fast(out * e, 200) * 0.5


def pop():
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    f = 900 * np.exp(-tt * 18) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 30) * 0.35


def ding(good=True):
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    base = 880 if good else 220
    x = np.sin(2 * np.pi * base * tt) + 0.5 * np.sin(2 * np.pi * base * 1.5 * tt) + 0.3 * np.sin(2 * np.pi * base * 2 * tt)
    if not good:
        x = np.sign(np.sin(2 * np.pi * 110 * tt)) * 0.5 + np.sin(2 * np.pi * 116 * tt) * 0.5
        return lp_fast(x, 1200) * np.exp(-tt * 6) * 0.3
    return x * np.exp(-tt * 5) * 0.18


def crackle(d=0.8):
    n = int(d * SR)
    x = np.zeros(n)
    for _ in range(int(60 * d)):
        j = rng.integers(0, n - 400)
        l = rng.integers(40, 300)
        x[j:j + l] += rng.uniform(-1, 1, l) * np.exp(-np.arange(l) / 60) * rng.uniform(0.3, 1)
    return hp_fast(x, 1500) * 0.35


def snap():
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    click = rng.uniform(-1, 1, n) * np.exp(-tt * 60)
    thump = np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 12)
    return (hp_fast(click, 2000) * 0.6 + thump * 0.6) * 0.8


def riser(d=1.2):
    n = int(d * SR)
    tt = np.arange(n) / SR
    f = 200 + 1200 * (tt / d) ** 2
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + hp_fast(rng.uniform(-1, 1, n), 3000) * 0.2
    return x * (tt / d) ** 2 * 0.5


def shiver():
    n = int(0.8 * SR)
    tt = np.arange(n) / SR
    x = lp_fast(rng.uniform(-1, 1, n), 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 22 * tt)) * np.exp(-tt * 3)
    return x * 0.25


def clank():
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) * a for f, d, a in [(523, 9, 0.5), (1371, 14, 0.35), (2210, 20, 0.25), (3480, 30, 0.15)])
    click = hp_fast(rng.uniform(-1, 1, n), 3000) * np.exp(-tt * 120) * 0.5
    thump = np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 25) * 0.6
    return (x * 0.5 + click + thump) * 0.6


def roar(d=3.0):
    n = int(d * SR)
    x = lp_fast(rng.uniform(-1, 1, n), 700) * 2.5 + hp_fast(lp_fast(rng.uniform(-1, 1, n), 4000), 1500) * 0.4
    e = np.ones(n)
    f = min(int(0.6 * SR), n // 3)
    e[:f] = np.linspace(0, 1, f)
    e[-f:] = np.linspace(1, 0, f)
    return x * e * 0.35


def spinup(d=1.5):
    n = int(d * SR)
    tt = np.arange(n) / SR
    f = 120 + 900 * (tt / d) ** 1.5
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * 0.1
    return x * np.minimum(1, tt / 0.2) * 0.6


SFX = {"whoosh": whoosh, "pop": pop, "ok": lambda: ding(True), "x": lambda: ding(False), "crackle": crackle, "snap": snap, "riser": riser, "shiver": shiver, "clank": clank, "roar": roar, "spinup": spinup}


def main():
    vid = sys.argv[1]
    base = os.path.join(ROOT, "public", vid)
    tl = json.load(open(os.path.join(base, "timeline.json")))
    ev = json.load(open(os.path.join(base, "eventos.json")))
    length = tl["duration"] + float(os.environ.get("TAIL", "1.0"))
    n = int(length * SR)

    m = music(length)
    # abaixa a trilha quando há voz (ducking pela narração)
    with wave.open(os.path.join(base, "narracao.wav")) as w:
        vo = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            vo = vo.reshape(-1, 2).mean(1)
    vo = np.pad(np.abs(vo), (0, max(0, n - len(vo))))[:n]
    win = int(0.25 * SR)
    envv = np.convolve(vo, np.ones(win) / win, mode="same")
    duck = 1 - 0.55 * np.clip(envv / (envv.max() * 0.25 + 1e-9), 0, 1)
    music_mix = m[:n] * duck * 0.55

    fx = np.zeros(n + SR * 2)
    for e in ev:
        fn = SFX[e["kind"]]
        s = fn(e["dur"]) if "dur" in e else fn()
        j = int(max(0, e["t"] + e.get("lead", 0)) * SR)
        fx[j:j + len(s)] += s * e.get("gain", 1.0)
    out = music_mix + fx[:n]
    out = out / max(1e-9, np.abs(out).max()) * 0.6
    pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(base, "trilha.wav"), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("trilha ok", round(length, 1), "s,", len(ev), "efeitos")


if __name__ == "__main__":
    main()
