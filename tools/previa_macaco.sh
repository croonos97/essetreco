#!/usr/bin/env bash
# Prévias do Macaco pelo entry ISOLADO (src/index_animais.ts): não mexe no bundle dos renders dos outros vídeos.
# Roda tsc + verificador de planos antes; cada lote de 6 quadros entra na trava compartilhada.
# Uso: tools/previa_macaco.sh <saida_dir> t1 t2 ...
cd "$(dirname "$0")/.."
npx tsc --noEmit -p . || { echo "tsc falhou"; exit 1; }
python3 tools/checa_planos.py src/videos/Macaco.tsx public/animal_macaco/timeline.json 0.4 | grep -q "OK" || { echo "planos com erro"; exit 1; }
out="$1"; shift
while [ $# -gt 0 ]; do
  batch=("${@:1:6}"); shift $(( $# < 6 ? $# : 6 ))
  ENTRY=src/index_animais.ts flock /home/claude/et/.render.lock nice -n 19 node tools/stills_animais.mjs Macaco "$out" 0.5 "${batch[@]}" 2>&1 | grep -E "^ok|rror"
done
