// Renderiza vários quadros de uma composição com um único bundle.
// Uso: node tools/stills.mjs Chuveiro out/check 1.5 4 7 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [comp, outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions });
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * composition.fps));
  const output = path.join(outDir, `f_${String(s).padStart(5, "0")}.jpg`);
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 80, chromiumOptions, scale: 0.5, timeoutInMilliseconds: 180000 });
  console.log("ok", s);
}
