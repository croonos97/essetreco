// Calcula a duração da composição e a lista de blocos para o GitHub Actions.
const path = require("path");
const fs = require("fs");
const { bundle } = require("@remotion/bundler");
const { selectComposition } = require("@remotion/renderer");

(async () => {
  const chunk = parseInt(process.env.CHUNK || "150", 10);
  let first = 0;
  let last;
  if (process.env.FRAMES) {
    [first, last] = process.env.FRAMES.split("-").map((n) => parseInt(n, 10));
  }
  const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY) });
  const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
  const c = await selectComposition({
    serveUrl,
    id: process.env.COMP,
    inputProps,
    chromiumOptions: { gl: "swangle" },
  });
  if (last === undefined) last = c.durationInFrames - 1;
  const starts = [];
  for (let s = first; s <= last; s += chunk) starts.push(s);
  const out = `total=${c.durationInFrames}\nstarts=${JSON.stringify(starts)}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, out);
  console.log(out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
