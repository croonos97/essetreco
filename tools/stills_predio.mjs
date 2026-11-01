// Prévias do Prédio v4: um bundle, um navegador, tempo por quadro.
// Uso: node tools/stills_predio.mjs out/dir 0.5 3 7 ...   (prefixo opcional SCALE=1)
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const scale = parseFloat(process.env.SCALE ?? "0.5");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "swangle" };
const browser = await openBrowser("chrome", { chromiumOptions });
const composition = await selectComposition({ serveUrl, id: "Predio", chromiumOptions, puppeteerInstance: browser });
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * composition.fps));
  const output = path.join(outDir, `f_${String(s).padStart(6, "0")}.jpg`);
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 80, chromiumOptions, scale, timeoutInMilliseconds: 240000, puppeteerInstance: browser });
  console.log("ok", s, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
await browser.close({ silent: true });
