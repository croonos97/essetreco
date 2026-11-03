const fs=require("fs"),assert=require("node:assert/strict"),path=require("path");
const root=path.resolve(__dirname,".."),load=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const roteiro=load("roteiros/panda.json"),tl=load("public/panda/timeline.json");
assert.equal(tl.id,"panda");assert.equal(tl.cenas.length,9);assert.ok(tl.duration>60&&tl.duration<120);
let last=0;
for(let i=0;i<tl.cenas.length;i++){
 const c=tl.cenas[i],r=roteiro.cenas[i];assert.equal(c.id,r.id);assert.ok(c.start>=last-.005);assert.ok(c.end>c.start);last=c.end;
 assert.deepEqual(c.words.map(w=>w.w),r.text.split(/\s+/));let wlast=c.start;
 for(const w of c.words){assert.ok(Number.isFinite(w.s)&&Number.isFinite(w.e));assert.ok(w.s>=c.start-.01&&w.e<=c.end+.05&&w.e>=w.s);assert.ok(w.s>=wlast-.05,c.id+": word sequence");wlast=w.s;}
}
for(const p of ["public/panda/narracao.wav","public/panda/trilha.wav","src/index_panda.ts","src/videos/Panda.tsx"]){assert.ok(fs.statSync(path.join(root,p)).size>100,p);}
assert.equal(roteiro.cenas[0].text,"Você cai de boca no bambu.");
assert.ok(!roteiro.cenas[8].text.includes("um dia inteiro"),"feeding hours qualification");
assert.ok(fs.existsSync(path.join(root,"docs/panda/REVISAO_ROTEIRO.md")),"independent script review missing");
console.log("Panda: "+tl.cenas.length+" scenes, "+tl.cenas.reduce((n,c)=>n+c.words.length,0)+" words; assets and timeline verified.");
