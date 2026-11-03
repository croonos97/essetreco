const fs=require("fs"),assert=require("node:assert/strict"),path=require("path");
const root=path.resolve(__dirname,".."),load=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const roteiro=load("roteiros/pombo.json"),tl=load("public/pombo/timeline.json");
assert.equal(tl.id,"pombo");assert.equal(tl.cenas.length,9);assert.ok(tl.duration>60&&tl.duration<120);
let last=0;
for(let i=0;i<tl.cenas.length;i++){
 const c=tl.cenas[i],r=roteiro.cenas[i];assert.equal(c.id,r.id);assert.ok(c.start>=last-.005);assert.ok(c.end>c.start);last=c.end;
 assert.deepEqual(c.words.map(w=>w.w),r.text.split(/\s+/));let wlast=c.start;
 for(const w of c.words){assert.ok(Number.isFinite(w.s)&&Number.isFinite(w.e));assert.ok(w.s>=c.start-.01&&w.e<=c.end+.05&&w.e>=w.s);assert.ok(w.s>=wlast-.05,c.id+": word sequence");wlast=w.s;}
}
for(const p of ["public/pombo/narracao.wav","public/pombo/trilha.wav","src/index_pombo.ts","src/videos/Pombo.tsx"]){assert.ok(fs.statSync(path.join(root,p)).size>100,p);}
assert.ok(!roteiro.cenas[8].text.includes("você cresceu no leite do papo, driblou"),"recap actor continuity");
console.log("Pombo: "+tl.cenas.length+" scenes, "+tl.cenas.reduce((n,c)=>n+c.words.length,0)+" words; assets and timeline verified.");
