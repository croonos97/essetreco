// Renderiza uma capa em PNG em resolução cheia: node tools/capa.mjs CapaJato out/capa_jato.png
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [comp, output] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions });
await renderStill({ serveUrl, composition, frame: 0, output, imageFormat: "png", chromiumOptions });
console.log("ok", output);
