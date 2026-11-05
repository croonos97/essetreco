#!/usr/bin/env bash
# Clipe curto do Macaco (meia escala, sem áudio) para o detector de piscadas, dentro da trava.
# Uso: tools/clip_macaco.sh <saida.mp4> <seg_ini> <seg_fim>
cd "$(dirname "$0")/.."
out="$1"; a=$(python3 -c "print(round($2*30))"); b=$(python3 -c "print(round($3*30)-1)")
flock /home/claude/et/.render.lock nice -n 10 npx remotion render src/index_animais.ts Macaco "$out" --frames=$a-$b --scale=0.5 --gl=swangle --concurrency=2 --muted --crf=20 --timeout=300000 > "$out.log" 2>&1 || { tail -5 "$out.log"; exit 1; }
python3 /home/claude/et/tools/flicker.py "$out" "$(python3 -c "print(-$2)")"
