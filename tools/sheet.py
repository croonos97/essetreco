"""Monta folhas de contato (3x2) a partir de out/<dir>/f_*.jpg."""
import glob, os, subprocess, sys

d = sys.argv[1]
fs = sorted(glob.glob(os.path.join(d, "f_*.jpg")), key=lambda x: float(os.path.basename(x)[2:-4]))
for k in range(0, len(fs), 6):
    grp = fs[k:k + 6]
    args = []
    for f in grp:
        args += ["-i", f]
    n = len(grp)
    if n == 1:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", grp[0], "-vf", "scale=360:640", os.path.join(d, f"sheet_{k // 6}.jpg")], check=True)
        continue
    filt = "".join(f"[{i}]scale=360:640,drawtext=text={os.path.basename(grp[i])[2:-4]}:x=8:y=8:fontsize=28:fontcolor=yellow:box=1:boxcolor=black[v{i}];" for i in range(n))
    filt += "".join(f"[v{i}]" for i in range(n)) + f"xstack=inputs={n}:layout=" + "|".join(f"{(i % 3) * 360}_{(i // 3) * 640}" for i in range(n)) + (":fill=black" if n < 6 else "")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", filt, os.path.join(d, f"sheet_{k // 6}.jpg")], check=True)
print("ok")
