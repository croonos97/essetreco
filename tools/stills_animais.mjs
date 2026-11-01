// Prévia leve do kit de animais: node tools/stills_animais.mjs <Comp> <outDir> <scale> t1 t2 ...
// Usa o entry isolado src/index_animais.ts. Mede o tempo de cada quadro.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [comp, outDir, scaleS, ...times] = process.argv.slice(2);
const entry = process.env.ENTRY ?? "src/index_animais.ts";
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve(entry) });
const chromiumOptions = { gl: "swangle" };
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, inputProps });
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * composition.fps));
  const output = path.join(outDir, `f_${String(s).padStart(5, "0")}.jpg`);
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 85, chromiumOptions, inputProps, scale: parseFloat(scaleS), timeoutInMilliseconds: 240000 });
  console.log("ok", s, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
// o bundle copia public/ inteiro para /tmp: apaga ao terminar para não encher o disco
fs.rmSync(serveUrl, { recursive: true, force: true });
