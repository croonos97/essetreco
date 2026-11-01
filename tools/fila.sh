#!/usr/bin/env bash
# Renderiza em sequência (retomável), esperando qualquer render em andamento: tools/fila.sh Comp:nome ...
cd "$(dirname "$0")/.."
for item in "$@"; do
  comp="${item%%:*}"; name="${item##*:}"
  [ -f "out/${name}_final.ok" ] && continue
  while pgrep -f "^bash tools/render.sh" >/dev/null; do sleep 20; done
  bash tools/render.sh "$comp" "$name" >> "out/render_${name}_final.log" 2>&1 && touch "out/${name}_final.ok"
  echo "$name: $(tail -n 1 out/render_${name}_final.log)"
done
