// Capa a partir de um quadro do vídeo, sem legendas, com título por cima.
// Uso: node tools/capa_quadro.mjs Panela panela 58.5 "ESSA PANELA PODE" "VIRAR UM PERIGO?"
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [comp, name, sec, top, big] = process.argv.slice(2);
const chromiumOptions = { gl: "swangle" };
fs.mkdirSync("public/capas", { recursive: true });
let serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const c1 = await selectComposition({ serveUrl, id: comp, chromiumOptions, inputProps: { cover: true } });
await renderStill({ serveUrl, composition: c1, frame: Math.round(parseFloat(sec) * c1.fps), output: `public/capas/${name}.png`, imageFormat: "png", chromiumOptions, inputProps: { cover: true } });
serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const props = { img: name, top, big };
const c2 = await selectComposition({ serveUrl, id: "CapaQuadro", chromiumOptions, inputProps: props });
await renderStill({ serveUrl, composition: c2, frame: 0, output: `out/capa_${name}.png`, imageFormat: "png", chromiumOptions, inputProps: props });
console.log("ok", `out/capa_${name}.png`);
