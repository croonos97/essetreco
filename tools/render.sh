#!/usr/bin/env bash
# Renderiza uma composição em blocos (retoma de onde parou se o ambiente reiniciar)
# e junta tudo num MP4 final com o áudio completo.
# Uso: tools/render.sh Chuveiro chuveiro
#      PROPS='{"peloMult":0.6}' tools/render.sh Ornitorrinco ornitorrinco   (input props opcionais)
set -euo pipefail
cd "$(dirname "$0")/.."
COMP="$1"; NAME="$2"; CHUNK=300
PROPS_ARG=(); if [ -n "${PROPS:-}" ]; then PROPS_ARG=(--props="$PROPS"); echo "props $PROPS"; fi
DIR="out/chunks_$NAME"; mkdir -p "$DIR"
TOTAL=$(node -e "
const {bundle}=require('@remotion/bundler');const {selectComposition}=require('@remotion/renderer');
(async()=>{const u=await bundle({entryPoint:require('path').resolve('src/index.ts')});
const c=await selectComposition({serveUrl:u,id:'$COMP',chromiumOptions:{gl:'swangle'}});console.log(c.durationInFrames)})()" 2>/dev/null | tail -1)
echo "total $TOTAL"
i=0; NEW=0; MAXB=${MAXBLOCKS:-999}
while [ $i -lt "$TOTAL" ]; do
  end=$((i + CHUNK - 1)); [ $end -ge "$TOTAL" ] && end=$((TOTAL - 1))
  f="$DIR/$(printf %05d $i).mp4"
  if [ ! -s "$f" ]; then
    if [ $NEW -ge $MAXB ]; then echo "PARCIAL: limite de $MAXB blocos atingido"; exit 0; fi
    flock /home/claude/et/.render.lock nice -n 5 npx remotion render src/index.ts "$COMP" "$f.tmp.mp4" --frames=$i-$end --gl=swangle --concurrency=2 --crf=16 --muted --timeout=300000 "${PROPS_ARG[@]}" > "$DIR/log_$i.txt" 2>&1
    mv "$f.tmp.mp4" "$f"
    echo "bloco $i-$end ok"; NEW=$((NEW + 1))
  fi
  i=$((end + 1))
done
ls "$DIR"/*.mp4 | grep -v tmp | sed "s|^|file '$PWD/|;s|$|'|" > "$DIR/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$DIR/list.txt" -c copy "$DIR/video.mp4"
# áudio: narração + trilha
ffmpeg -v error -y -i "public/$NAME/narracao.wav" -i "public/$NAME/trilha.wav" -filter_complex "[0]aresample=48000[a];[1]aresample=48000,volume=0.9[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95" -ar 48000 "$DIR/audio.wav"
ffmpeg -v error -y -i "$DIR/video.mp4" -i "$DIR/audio.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "out/${NAME}_v1.mp4"
echo "FINAL out/${NAME}_v1.mp4"
