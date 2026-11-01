import { useMemo } from "react";
import * as THREE from "three";
import { rnd, texCanvas, V3 } from "./CupimComum";
import { GAL_VAZIA, Galerias, gerarGalerias, PecaMadeira, PecaProps } from "./Madeira";
import { MontinhoGraos } from "./Graos";

// =====================================================================
// CANTO DE CASA BRASILEIRA (cm). Chão y = 0 (piso cerâmico bege 45×45), parede do fundo no plano z = 0
// (face para +z), parede da esquerda em x = −140 (face para +x). Pé-direito 270.
// Vão da porta na parede do fundo: x de 0 a 82, altura 212, parede com 15 cm de espessura (z −15…0).
// Batente de madeira envernizada (3,5 cm) forrando o vão + guarnição (alizar 7 × 1,5 cm) na face da parede,
// soleira de granito escuro no vão (topo y = 1,2). O BATENTE ESQUERDO é a peça com cupim (PecaMadeira).
// Mesa de trabalho encostada na parede do fundo à esquerda (tampo y = 78) para a "peça curta na bancada".
// Nada coplanar: todas as peças encostadas têm folga ≥ 0,05 cm ou polygonOffset.
// =====================================================================
export const CASA = {
  pe: 270,
  vao: { x0: 0, x1: 82, y1: 212, esp: 15 },
  soleira: 1.2,
  bat: { D: 3.5, W: 15 }, // batente: espessura (x) e largura (= espessura da parede)
  mesa: { x0: -128, x1: -40, z0: 3, z1: 63, y: 78 },
  parEsq: -140,
};
// batente esquerdo: local x (comprimento) → mundo +y; local y (normal da face vista) → mundo +x; local z → mundo −z
const baseBat = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1));
export const BAT_ROT = new THREE.Euler().setFromRotationMatrix(baseBat).toArray().slice(0, 3) as V3;
export const BAT_POS: V3 = [CASA.bat.D / 2, CASA.soleira + 0.05, -CASA.bat.W / 2];
export const BAT_L = CASA.vao.y1 - CASA.soleira - 0.05;
// galerias do batente (altura 30–60 cm do chão)
export const GAL_BAT: Galerias = gerarGalerias(7, 28, 60, CASA.bat.W / 2, { ramos: 26 });
// local do batente → mundo
export const batParaMundo = (p: V3): V3 => {
  const v = new THREE.Vector3(...p).applyEuler(new THREE.Euler(...BAT_ROT));
  return [v.x + BAT_POS[0], v.y + BAT_POS[1], v.z + BAT_POS[2]];
};
// furinho de expulsão no batente (mundo) e montinho na soleira embaixo dele
export const FURO_MUNDO = (): V3 => batParaMundo([GAL_BAT.furo.x, CASA.bat.D / 2, GAL_BAT.furo.z]);
export const MONTE_MUNDO = (): V3 => {
  const f = FURO_MUNDO();
  return [f[0] + 1.6, CASA.soleira + 0.002, f[2]];
};

// ---------- texturas ----------
const texPiso = () =>
  texCanvas("cupPiso", 1024, 1024, (g, W, H) => {
    // 2×2 placas de 45 cm (90 cm por textura); rejunte 0,4 cm
    g.fillStyle = "#D9CDB6";
    g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        const n = (rnd(Math.floor(x / 6) * 733 + Math.floor(y / 6), 1) - 0.5) * 10 + (rnd(x * 997 + y, 2) - 0.5) * 6 + Math.sin(x * 0.02 + y * 0.013) * 3;
        img.data[k] += n;
        img.data[k + 1] += n;
        img.data[k + 2] += n * 0.8;
      }
    g.putImageData(img, 0, 0);
    g.fillStyle = "#A99C86";
    const rj = (0.4 / 90) * W;
    for (let i = 0; i <= 2; i++) {
      g.fillRect((i * W) / 2 - rj / 2, 0, rj, H);
      g.fillRect(0, (i * H) / 2 - rj / 2, W, rj);
    }
  });
const texParede = () =>
  texCanvas("cupParede", 1024, 1024, (g, W, H) => {
    // tinta acrílica "palha" sobre reboco (textura de rolo), 100 cm por textura
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = 0.95 + (rnd(Math.floor(x / 5) * 911 + Math.floor(y / 5), 3) - 0.5) * 0.035 + (rnd(x * 31 + y * 7919, 4) - 0.5) * 0.03;
        const k = (y * W + x) * 4;
        img.data[k] = 238 * v;
        img.data[k + 1] = 226 * v;
        img.data[k + 2] = 198 * v;
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
const texGranito = () =>
  texCanvas("cupGranito2", 1024, 1024, (g, W, H) => {
    // granito cinza (tipo "andorinha"): fundo cinza médio, grãos arredondados pretos, cinza e brancos (40 cm por textura)
    g.fillStyle = "#7C7873";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) {
      const c = rnd(i, 1);
      g.fillStyle = c < 0.42 ? "rgba(34,32,32,0.85)" : c < 0.8 ? "rgba(150,146,141,0.8)" : "rgba(228,224,218,0.75)";
      const r = 0.6 + Math.pow(rnd(i, 2), 3) * 3.2;
      g.beginPath();
      g.ellipse(rnd(i, 3) * W, rnd(i, 4) * H, r, r * (0.6 + rnd(i, 5) * 0.5), rnd(i, 6) * 3.14, 0, Math.PI * 2);
      g.fill();
    }
  });

// caixa com material e uv em cm (repete a textura a cada "rep" cm)
export const Caixa: React.FC<{ p0: V3; p1: V3; m: THREE.Material; sombra?: boolean; recebe?: boolean }> = ({ p0, p1, m, sombra = true, recebe = true }) => {
  const s: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const g = useMemo(() => {
    const b = new THREE.BoxGeometry(s[0], s[1], s[2]);
    const pos = b.attributes.position as THREE.BufferAttribute, nor = b.attributes.normal as THREE.BufferAttribute, uv = b.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (p0[0] + p1[0]) / 2, y = pos.getY(i) + (p0[1] + p1[1]) / 2, z = pos.getZ(i) + (p0[2] + p1[2]) / 2;
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      if (ny > 0.5) uv.setXY(i, x, z);
      else if (nx > 0.5) uv.setXY(i, z, y);
      else uv.setXY(i, x, y);
    }
    return b;
  }, [s[0], s[1], s[2], p0[0], p0[1], p0[2]]);
  return <mesh geometry={g} material={m} position={[(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2]} castShadow={sombra} receiveShadow={recebe} />;
};
export const comRep = (tx: THREE.Texture, rep: number) => {
  const c = tx.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(1 / rep, 1 / rep);
  c.needsUpdate = true;
  return c;
};

export type CasaProps = {
  t: number;
  batente?: Partial<PecaProps>; // props extras da peça com cupim (g, raioX, abrir, furo, children…)
  montinho?: number; // 0..1 (0 = sem montinho)
  semMesa?: boolean;
  sombras?: boolean;
};
export const Casa: React.FC<CasaProps> = (P) => {
  const { vao, pe, soleira, bat, mesa } = CASA;
  const M = useMemo(() => {
    const piso = new THREE.MeshStandardMaterial({ map: comRep(texPiso(), 90), roughness: 0.38, metalness: 0 });
    const parede = new THREE.MeshStandardMaterial({ map: comRep(texParede(), 100), roughness: 0.92 });
    const paredeFundo = new THREE.MeshStandardMaterial({ map: comRep(texParede(), 100), roughness: 0.92, color: "#E6E0D2" });
    const rodape = new THREE.MeshStandardMaterial({ map: comRep(texPiso(), 90), roughness: 0.4 });
    const granito = new THREE.MeshStandardMaterial({ map: comRep(texGranito(), 40), roughness: 0.25, metalness: 0.05 });
    const tampo = new THREE.MeshStandardMaterial({ color: "#C9CCCB", roughness: 0.55 });
    const ferro = new THREE.MeshStandardMaterial({ color: "#3B3F44", roughness: 0.5, metalness: 0.4 });
    return { piso, parede, paredeFundo, rodape, granito, tampo, ferro };
  }, []);
  const sombras = P.sombras ?? true;
  const e = vao.esp;
  return (
    <group>
      {/* chão (esta sala e a do outro lado do vão) */}
      <Caixa p0={[-140, -2, -330]} p1={[330, 0, 400]} m={M.piso} sombra={false} />
      {/* parede do fundo, com o vão */}
      <Caixa p0={[-140, 0, -e]} p1={[vao.x0, pe, 0]} m={M.parede} />
      <Caixa p0={[vao.x1, 0, -e]} p1={[330, pe, 0]} m={M.parede} />
      <Caixa p0={[vao.x0, vao.y1, -e]} p1={[vao.x1, pe, 0]} m={M.parede} />
      {/* parede da esquerda */}
      <Caixa p0={[CASA.parEsq - 15, 0, -e]} p1={[CASA.parEsq, pe, 400]} m={M.parede} />
      {/* sala do outro lado (mais escura, sem sol direto) */}
      <Caixa p0={[-140, 0, -330]} p1={[330, pe, -315]} m={M.paredeFundo} />
      <Caixa p0={[-140, pe, -330]} p1={[330, pe + 5, 0]} m={M.paredeFundo} sombra={false} />
      {/* rodapé cerâmico (7 cm) */}
      <Caixa p0={[CASA.parEsq + 0.05, 0.05, 0.05]} p1={[vao.x0 - 7.2, 7, 1.0]} m={M.rodape} />
      <Caixa p0={[vao.x1 + 7.2, 0.05, 0.05]} p1={[330, 7, 1.0]} m={M.rodape} />
      <Caixa p0={[CASA.parEsq + 0.05, 0.05, 1.05]} p1={[CASA.parEsq + 1.0, 7, 400]} m={M.rodape} />
      {/* soleira de granito no vão */}
      <Caixa p0={[vao.x0 + 0.03, 0.02, -e + 0.03]} p1={[vao.x1 - 0.03, soleira, 0.6]} m={M.granito} />
      {/* BATENTE ESQUERDO = peça com cupim */}
      <PecaMadeira L={BAT_L} W={bat.W} D={bat.D} gal={GAL_BAT} g={1} furo position={BAT_POS} rotation={BAT_ROT} sombras={sombras} {...P.batente} />
      {/* batente direito e travessa de cima (lisos) */}
      <PecaMadeira L={BAT_L} W={bat.W} D={bat.D} gal={GAL_VAZIA} position={[vao.x1 - bat.D / 2, soleira + 0.05, -bat.W / 2]} rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1))).toArray().slice(0, 3) as V3} />
      <PecaMadeira L={vao.x1 - vao.x0 - 2 * bat.D - 0.1} W={bat.W} D={bat.D} gal={GAL_VAZIA} position={[vao.x0 + bat.D + 0.05, vao.y1 - bat.D / 2, -bat.W / 2]} rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1))).toArray().slice(0, 3) as V3} />
      {/* guarnição (alizar) na face da parede: 7 × 1,5 cm, levemente à frente da parede */}
      <PecaMadeira L={vao.y1 + 7} W={7} D={1.5} gal={GAL_VAZIA} position={[vao.x0 - 3.55, 0.05, 0.8]} rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0))).toArray().slice(0, 3) as V3} />
      <PecaMadeira L={vao.y1 + 7} W={7} D={1.5} gal={GAL_VAZIA} position={[vao.x1 + 3.55, 0.05, 0.8]} rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0))).toArray().slice(0, 3) as V3} />
      <PecaMadeira L={vao.x1 - vao.x0} W={6.9} D={1.5} gal={GAL_VAZIA} position={[vao.x0, vao.y1 + 3.55, 0.8]} rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0))).toArray().slice(0, 3) as V3} />
      {/* montinho de grânulos na soleira, embaixo do furinho */}
      {(P.montinho ?? 0) > 0.001 ? <MontinhoGraos cresce={P.montinho} raio={1.1} altura={0.62} position={MONTE_MUNDO()} cor="#C59C70" /> : null}
      {/* mesa de trabalho */}
      {P.semMesa ? null : (
        <>
          <Caixa p0={[mesa.x0, mesa.y - 3, mesa.z0]} p1={[mesa.x1, mesa.y, mesa.z1]} m={M.tampo} />
          {[
            [mesa.x0 + 3, mesa.z0 + 3],
            [mesa.x1 - 6, mesa.z0 + 3],
            [mesa.x0 + 3, mesa.z1 - 6],
            [mesa.x1 - 6, mesa.z1 - 6],
          ].map(([x, z], i) => (
            <Caixa key={i} p0={[x, 0.05, z]} p1={[x + 3, mesa.y - 3.05, z + 3]} m={M.ferro} />
          ))}
        </>
      )}
    </group>
  );
};
