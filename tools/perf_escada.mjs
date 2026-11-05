// Mede s/quadro em 1080x1920 (swangle, concurrency 1) em trechos: node tools/perf_escada.mjs 300-309 1500-1509
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const ranges = process.argv.slice(2).map((r) => r.split("-").map(Number));
const bdir = "/tmp/claude-0/-home-claude/12c0ae63-b0e1-52fb-8ef8-e79d3310b292/scratchpad/bundle_perf";
fs.rmSync(bdir, { recursive: true, force: true });
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY ?? "src/index_escada.ts"), outDir: bdir });
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: "Escada", chromiumOptions });
const out = "/tmp/claude-0/-home-claude/12c0ae63-b0e1-52fb-8ef8-e79d3310b292/scratchpad/perf.mp4";
for (const [a, b] of ranges) {
  const t0 = Date.now();
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: out, frameRange: [a, b], chromiumOptions, concurrency: 1, muted: true, timeoutInMilliseconds: 240000 });
  const s = (Date.now() - t0) / 1000;
  console.log(`frames ${a}-${b} (${(a / 30).toFixed(1)}s): ${s.toFixed(1)}s total, ${(s / (b - a + 1)).toFixed(2)} s/frame`);
}
fs.rmSync(bdir, { recursive: true, force: true });
