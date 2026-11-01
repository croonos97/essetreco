#!/usr/bin/env bash
# Prévias leves em lotes de até 6 quadros (meia escala, nice 19), usando o entry principal.
# Cada lote roda dentro da trava compartilhada /home/claude/et/.render.lock (um processo pesado por vez na máquina).
# Uso: tools/previa_animais.sh <Comp> <saida_dir> t1 t2 ... ; gera f_*.jpg e mostra s/quadro
cd "$(dirname "$0")/.."
comp="$1"; out="$2"; shift 2
while [ $# -gt 0 ]; do
  batch=("${@:1:6}"); shift $(( $# < 6 ? $# : 6 ))
  ENTRY=src/index.ts flock /home/claude/et/.render.lock nice -n 19 node tools/stills_animais.mjs "$comp" "$out" 0.5 "${batch[@]}" 2>&1 | grep -E "^ok|rror"
done
