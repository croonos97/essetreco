// Prévias da Escada: um bundle (no scratchpad, apagado no fim), um navegador, tempo por quadro.
// Uso: SCALE=0.5 node tools/stills_escada.mjs out/dir 0.5 3 7 ...
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const scale = parseFloat(process.env.SCALE ?? "0.5");
const bdir = path.resolve(process.env.BUNDLE_DIR ?? "/tmp/claude-0/-home-claude/12c0ae63-b0e1-52fb-8ef8-e79d3310b292/scratchpad/bundle_escada");
fs.rmSync(bdir, { recursive: true, force: true });
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY ?? "src/index_escada.ts"), outDir: bdir });
const chromiumOptions = { gl: "swangle" };
const browser = await openBrowser("chrome", { chromiumOptions });
const composition = await selectComposition({ serveUrl, id: "Escada", chromiumOptions, puppeteerInstance: browser });
const log = [];
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * composition.fps));
  const output = path.join(outDir, `f_${String(s).padStart(6, "0")}.jpg`);
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 80, chromiumOptions, scale, timeoutInMilliseconds: 240000, puppeteerInstance: browser });
  const dt = (Date.now() - t0) / 1000;
  log.push(`${s}\t${dt.toFixed(2)}`);
  console.log("ok", s, dt.toFixed(1) + "s");
}
fs.writeFileSync(path.join(outDir, "tempos.tsv"), log.join("\n") + "\n");
await browser.close({ silent: true });
fs.rmSync(bdir, { recursive: true, force: true });
