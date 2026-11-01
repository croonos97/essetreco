"""Gera a narração por cena e a linha do tempo palavra a palavra.

Uso:
  python3 tools/narrar.py roteiros/chuveiro.json            # voz rascunho (Piper)
  python3 tools/narrar.py roteiros/chuveiro.json audio_dir  # MP3/WAV por cena já gravados (01.mp3, 02.mp3...) ou narracao_completa.mp3

Saída: public/<id>/narracao.wav e public/<id>/timeline.json
"""
import json, os, re, subprocess, sys, wave, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = "/home/claude/voices/pt_BR-faber-medium.onnx"
GAP = 0.22  # pausa entre cenas, em segundos
SR = 44100


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def sh(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def to_wav(src, dst):
    sh(["ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", str(SR), "-sample_fmt", "s16", dst])


def dur(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def main():
    roteiro = json.load(open(sys.argv[1]))
    src_dir = sys.argv[2] if len(sys.argv) > 2 else None
    out = os.path.join(ROOT, "public", roteiro["id"])
    tmp = os.path.join(out, "_cenas")
    os.makedirs(tmp, exist_ok=True)

    parts = []
    for i, cena in enumerate(roteiro["cenas"]):
        wav = os.path.join(tmp, f"{i+1:02d}.wav")
        given = None
        if src_dir:
            for ext in ("mp3", "wav", "m4a"):
                p = os.path.join(src_dir, f"{i+1:02d}.{ext}")
                if os.path.exists(p):
                    given = p
        if given:
            # voz real: corta silêncio das pontas, iguala volume entre cenas e comprime de leve
            sh(["ffmpeg", "-y", "-i", given, "-af",
                "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
                "highpass=f=60,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7",
                "-ar", str(SR), "-ac", "1", "-sample_fmt", "s16", wav])
        else:
            raw = wav + ".raw.wav"
            subprocess.run(["python3", "-m", "piper", "-m", VOICE, "-f", raw, "--length-scale", "0.9",
                            "--sentence-silence", "0.12"], input=cena["text"].encode(), check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # tira silêncio das pontas e dá corpo de locução
            sh(["ffmpeg", "-y", "-i", raw, "-af",
                "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                "highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1:g=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=60",
                "-ar", str(SR), "-ac", "1", wav])
            os.remove(raw)
        parts.append(wav)

    # concatena com pausas
    silence = os.path.join(tmp, "gap.wav")
    sh(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", str(GAP), "-sample_fmt", "s16", silence])
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\nfile '{silence}'\n")
    full = os.path.join(out, "narracao_raw.wav")
    sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", full])
    sh(["ffmpeg", "-y", "-i", full, "-af", "loudnorm=I=-15:TP=-1.5:LRA=7", "-ar", "44100", os.path.join(out, "narracao.wav")])

    # tempos por palavra com faster-whisper, alinhados ao texto do roteiro
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    t = 0.0
    timeline = []
    for cena, wav in zip(roteiro["cenas"], parts):
        d = dur(wav)
        import numpy as np
        with wave.open(wav) as ww:
            arr = np.frombuffer(ww.readframes(ww.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if SR != 16000:
            idx = np.arange(0, len(arr), SR / 16000)
            arr = np.interp(idx, np.arange(len(arr)), arr).astype(np.float32)
        segs, _ = model.transcribe(arr, language="pt", word_timestamps=True, initial_prompt=cena["text"])
        heard = [w for s in segs for w in s.words]
        words = cena["text"].split()
        kws = {norm(k) for k in cena.get("keywords", [])}
        # alinhamento sequencial: cada palavra do roteiro pega o tempo da próxima palavra ouvida parecida
        out_words, j = [], 0
        for k, w in enumerate(words):
            nw, hit = norm(w), None
            for jj in range(j, min(j + 4, len(heard))):
                if norm(heard[jj].word) == nw or (nw and norm(heard[jj].word).startswith(nw[:4])):
                    hit = jj
                    break
            if hit is None and j < len(heard) and len(heard) >= len(words) - k:
                hit = j
            if hit is not None:
                s, e = heard[hit].start, heard[hit].end
                j = hit + 1
            else:
                s = e = None
            out_words.append({"w": w, "s": s, "e": e, "kw": norm(w) in kws})
        # preenche buracos por interpolação
        known = [i for i, x in enumerate(out_words) if x["s"] is not None]
        for i, x in enumerate(out_words):
            if x["s"] is None:
                prev = max([k for k in known if k < i], default=None)
                nxt = min([k for k in known if k > i], default=None)
                a = out_words[prev]["e"] if prev is not None else 0.0
                b = out_words[nxt]["s"] if nxt is not None else d
                span = [k for k in range(prev + 1 if prev is not None else 0, nxt if nxt is not None else len(out_words))]
                step = (b - a) / max(len(span), 1)
                idx = span.index(i)
                x["s"], x["e"] = a + idx * step, a + (idx + 1) * step
        for x in out_words:
            x["s"] = round(t + x["s"], 3)
            x["e"] = round(t + x["e"], 3)
        timeline.append({"id": cena["id"], "label": cena.get("label", ""), "start": round(t, 3),
                         "end": round(t + d, 3), "words": out_words})
        t += d + GAP
    json.dump({"id": roteiro["id"], "cta": roteiro.get("cta", ""), "duration": round(t, 3), "cenas": timeline},
              open(os.path.join(out, "timeline.json"), "w"), ensure_ascii=False, indent=1)
    print(f"ok: {t:.1f}s, {len(timeline)} cenas")


if __name__ == "__main__":
    main()

# palavras-chave de várias palavras: rode depois  python3 tools/fix_kw.py <id> <roteiro.json>
