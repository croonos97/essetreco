#!/usr/bin/env bash
# Baixa os áudios do Fish Audio na ordem das cenas: tools/baixar_voz.sh <video> <task_id1> <task_id2> ...
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="$1"; shift
mkdir -p "voz/$NAME"
i=1
for id in "$@"; do
  f="voz/$NAME/$(printf %02d $i).mp3"
  curl -sS -m 60 --retry 3 -o "$f" "https://platform.r2.fish.audio/tasks/${DATE:-2026-10-29}/$id.mp3"
  echo "$f $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  i=$((i + 1))
done
