import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const off = process.env.OFF ?? "";
const ranges = process.argv.slice(2).map((r) => r.split("-").map(Number));
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: "Predio", chromiumOptions, inputProps: { off } });
for (const [a, b] of ranges) {
  const t0 = Date.now();
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: `out/perf_${a}.mp4`, frameRange: [a, b], chromiumOptions, concurrency: 1, muted: true, inputProps: { off }, timeoutInMilliseconds: 240000 });
  const s = (Date.now() - t0) / 1000;
  console.log(`frames ${a}-${b}: ${s.toFixed(1)}s total, ${(s / (b - a + 1)).toFixed(2)} s/frame`);
}
