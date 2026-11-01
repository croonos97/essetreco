import * as THREE from "three";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { HumanoTranslucido } from "../animais/HumanoTranslucido";
import { BAT_L, BAT_POS, BAT_ROT, batParaMundo, Casa, CASA, FURO_MUNDO, GAL_BAT, MONTE_MUNDO } from "./Casa";
import { Casta, Cupim, CupimProps, pontaMandibula, pontaMandibulaPose } from "./Cupim";
import { clamp01, CupimCam, HUMANO, LKey, LuzCasa, MM, noPlano, PalcoCasa, seg01, sm, V3 } from "./CupimComum";
import { FibraAmpliada, FibraSoltando, FrenteMastigacao } from "./Fibra";
import { Grao, GRAO_L, MontinhoGraos, quedaGrao } from "./Graos";
import { CENTROS_PORTA, FURO_GR, GAL_GR, grParaMundo, GR, LAMPADA, MONTE_GR, PORTA, Quarto, TRILHA_FORMIGAS, vigaParaMundo, GAL_VIGA, FuroPrego, Comoda, FamiliaAzul } from "./Quarto";
import { MaoAzul, NOS_DEDOS, PONTA_POLEGAR } from "./Mao";
import { Formiga, naTrilha } from "./Formiga";

import { ChaoCru, Galerias, gerarGalerias, naGaleria, PecaMadeira, SecaoTransversal } from "./Madeira";

// =====================================================================
// LABORATÓRIO DO KIT CUPIM — cada setup tem a sua duração; LAB_INI[i] = segundo em que começa.
// Unidade: cm. Luz: LuzCasa (idêntica em todos os setups; só o recorte do mapa de sombra muda).
// =====================================================================
type S = { nome: string; dur?: number; cam: LKey[]; near?: number; luz?: { foco: V3; raio: number }; el: (t: number, tl: number) => React.ReactNode; overlay?: (tl: number) => React.ReactNode };

// ---------- peça curta na bancada (pedaço de batente: 30 × 9 × 3,5 cm) ----------
export const PECA = { L: 30, W: 9, D: 3.5 };
export const GAL_PECA: Galerias = gerarGalerias(3, 2.5, 27.5, PECA.W / 2, { ramos: 22 });
const ANG = -0.42; // a peça fica em diagonal na mesa
export const PECA_ROT: V3 = [0, ANG, 0];
const dirP = new THREE.Vector3(Math.cos(ANG), 0, -Math.sin(ANG));
const centroMesa = new THREE.Vector3(-86, CASA.mesa.y + PECA.D / 2 + 0.02, 30);
export const PECA_POS: V3 = centroMesa.clone().addScaledVector(dirP, -PECA.L / 2).toArray() as V3;
// local da peça → mundo
export const pecaParaMundo = (p: V3): V3 => new THREE.Vector3(...p).applyEuler(new THREE.Euler(...PECA_ROT)).add(new THREE.Vector3(...PECA_POS)).toArray() as V3;
const PC = (x: number, y: number, z: number) => pecaParaMundo([x, y, z]);
const UP = new THREE.Vector3(0, 1, 0);
const LADO = new THREE.Vector3(Math.sin(ANG), 0, Math.cos(ANG)); // local z da peça no mundo (lado da sala; a tampa deita para cá)
// câmera da peça na bancada: atrás de uma ponta e alta → a peça atravessa o quadro na diagonal vertical
const camPeca = (k = 1, lado = 0): { pos: V3; look: V3 } => {
  const c = new THREE.Vector3(...PC(15, 0, 0)).addScaledVector(LADO, lado);
  return { pos: c.clone().addScaledVector(dirP, -30 * k).addScaledVector(UP, 44 * k).addScaledVector(LADO, 15 * k).toArray() as V3, look: c.toArray() as V3 };
};

// chão curvo da galeria para os pés (mm): sobe nas laterais do sulco elíptico
export const pisoGaleria = (w: number, r: number) => (latMM: number) => {
  const l = (latMM * MM) / Math.max(1e-3, w);
  return (r - r * Math.sqrt(Math.max(0, 1 - Math.min(1, l * l)))) / MM;
};
// cupim no chão da galeria (referencial da peça)
const CupimGal: React.FC<{ gal: Galerias; ramo: number; s: number; g?: number; t: number; vel?: number; inverte?: boolean } & Partial<CupimProps>> = ({ gal, ramo, s, g = 1, t, vel = 0, inverte, ...rest }) => {
  const q = naGaleria(gal, ramo, s, g);
  const yaw = q.yaw + (inverte ? Math.PI : 0);
  return <Cupim t={t} position={q.p} rotation={[0, yaw, 0]} piso={pisoGaleria(q.w, q.r)} andar={vel > 0 ? 1 : 0} dist={vel > 0 ? s / MM : 0} {...rest} />;
};
// população padrão da peça aberta/raio-x (ramo, s inicial, velocidade cm/s, sentido, casta)
const POP: { r: number; s: number; v: number; inv?: boolean; c?: Casta; m?: number }[] = [
  { r: 0, s: 2.0, v: 0.25 },
  { r: 0, s: 6.5, v: 0, m: 1 },
  { r: 1, s: 1.5, v: 0.22, inv: true },
  { r: 1, s: 5.5, v: 0, c: "soldado" },
  { r: 2, s: 1.0, v: 0.2 },
  { r: 3, s: 0.8, v: 0, m: 1 },
  { r: 4, s: 1.5, v: 0.18 },
  { r: 5, s: 1.2, v: 0, m: 0.6 },
  { r: 0, s: 0.4, v: 0, c: "rainha" },
];
const Populacao: React.FC<{ gal: Galerias; t: number; g?: number; sombra?: boolean }> = ({ gal, t, g = 1, sombra = true }) => (
  <>
    {POP.map((p, i) => {
      if (p.r >= gal.ramos.length) return null;
      const R = gal.ramos[p.r];
      const frente = Math.min(R.len, (g - R.g0) * R.vel) - 0.4;
      if (frente < 0.3) return null;
      // anda e volta dentro do trecho já escavado (sem atravessar a ponta)
      const L = Math.max(0.01, frente - 0.3);
      const per = (2 * L) / Math.max(1e-3, p.v);
      const ph = p.v > 0 ? ((t + i * 1.7) % per) / per : 0;
      const ida = ph < 0.5;
      const s0 = Math.min(p.s, frente);
      const s = p.v > 0 ? 0.3 + (ida ? ph * 2 : 2 - ph * 2) * L : s0;
      const inv = p.v > 0 ? (ida ? p.inv : !p.inv) : p.inv;
      return <CupimGal key={i} gal={gal} ramo={p.r} s={s} g={g} t={t + i} vel={p.v} inverte={inv} casta={p.c} mastigar={p.m} sombra={sombra} />;
    })}
  </>
);

// ---------- helpers ----------
const W = (p: V3, d: V3): V3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const BAT = (x: number, y: number, z: number) => batParaMundo([x, y, z]);
// formiga subindo a face do batente (normal +x), cabeça para cima
const noPlanoX = noPlano([1, 0, 0], [0, 1, 0]);
const FURO = FURO_MUNDO();
const MONTE = MONTE_MUNDO();
// furo da peça (bancada) e um ponto do ramo para câmeras
const gp = (gal: Galerias, ramo: number, s: number, g = 1) => naGaleria(gal, ramo, s, g).p;

// cupim isolado num "palco" de madeira crua (placa) para close de anatomia
const PlacaCrua: React.FC<{ y?: number }> = () => <ChaoCru tam={14} />;

const LAB: S[] = [
  // 0 · sala geral: canto com o vão da porta, batente, soleira, mesa com a peça
  {
    nome: "sala-geral",
    cam: [{ t: 0, pos: [215, 150, 390], look: [15, 85, -5], fov: 44 }],
    near: 1,
    luz: { foco: [0, 80, 0], raio: 200 },
    el: (t) => (
      <>
        <Casa t={t} montinho={1} />
        <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} />
        <HumanoTranslucido t={t} position={[-15, 0, 95]} rotation={[0, 0.7, 0]} scale={HUMANO} />
      </>
    ),
  },
  // 1 · batente: o furinho de expulsão (1 mm) em close
  {
    nome: "batente-furo",
    cam: [{ t: 0, pos: W(FURO, [4.2, 1.0, 3.8]), look: W(FURO, [0, -0.4, 0]), fov: 30 }],
    near: 0.05,
    luz: { foco: FURO, raio: 12 },
    el: (t) => <Casa t={t} montinho={1} />,
  },
  // 1b · batente com o montinho embaixo (causa e sinal no mesmo quadro)
  {
    nome: "batente-montinho",
    cam: [{ t: 0, pos: W(MONTE, [17, 12, 19]), look: W(MONTE, [-1.5, 6, -2]), fov: 36 },],
    near: 0.1,
    luz: { foco: W(MONTE, [0, 6, 0]), raio: 25 },
    el: (t) => <Casa t={t} montinho={1} />,
  },
  // 2 · batente com faixa de raio-x revelando galerias e cupins
  {
    nome: "batente-raiox",
    cam: [{ t: 0, pos: W(BAT(44, 0, 0), [40, 4, 16]), look: BAT(44, 0, 0), fov: 36 }],
    near: 0.2,
    luz: { foco: BAT(44, 0, 0), raio: 40 },
    el: (t) => (
      <Casa t={t} montinho={1} batente={{ raioX: { a: 33, b: 55, borda: 0.4 }, children: <Populacao gal={GAL_BAT} t={t} sombra={false} /> }} />
    ),
  },
  // 3 · varredura do raio-x (abre, fecha, reabre no mesmo lugar)
  {
    nome: "raiox-varredura",
    dur: 3,
    cam: [{ t: 0, pos: W(BAT(44, 0, 0), [40, 4, 16]), look: BAT(44, 0, 0), fov: 36 }],
    near: 0.2,
    luz: { foco: BAT(44, 0, 0), raio: 40 },
    el: (t, tl) => {
      const k = seg01(tl, 0.1, 0.9) * (1 - seg01(tl, 1.3, 1.6)) + seg01(tl, 1.9, 2.4);
      return <Casa t={t} montinho={1} batente={{ raioX: k > 0.002 ? { a: 33, b: 33 + 22 * k, borda: 0.4 } : undefined, children: <Populacao gal={GAL_BAT} t={t} sombra={false} /> }} />;
    },
  },
  // 4 · peça curta na bancada (fechada, diagonal) — quadro 0
  {
    nome: "peca-bancada",
    cam: [{ t: 0, ...camPeca(1), fov: 40 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 0), raio: 30 },
    el: (t) => (
      <>
        <Casa t={t} montinho={1} />
        <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} />
      </>
    ),
  },
  // 5 · peça com faixa de raio-x
  {
    nome: "peca-raiox",
    cam: [{ t: 0, ...camPeca(1), fov: 40 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 0), raio: 30 },
    el: (t) => (
      <>
        <Casa t={t} />
        <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} raioX={{ a: 6, b: 22, borda: 0.35 }}>
          <Populacao gal={GAL_PECA} t={t} sombra={false} />
        </PecaMadeira>
      </>
    ),
  },
  // 6 · corte longitudinal abrindo (livro)
  {
    nome: "peca-abrindo",
    dur: 2,
    cam: [{ t: 0, ...camPeca(1.05, 4.5), fov: 42 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 5), raio: 30 },
    el: (t, tl) => (
      <>
        <Casa t={t} />
        <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} abrir={sm(tl / 1.8)}>
          {tl > 0.01 ? <Populacao gal={GAL_PECA} t={t} /> : null}
        </PecaMadeira>
      </>
    ),
  },
  // 7 · peça aberta de cima: galerias e cupins
  {
    nome: "peca-aberta-cima",
    cam: [{ t: 0, ...camPeca(0.85, 4.5), fov: 42 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 5), raio: 30 },
    el: (t) => (
      <>
        <Casa t={t} />
        <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} abrir={1}>
          <Populacao gal={GAL_PECA} t={t} />
        </PecaMadeira>
      </>
    ),
  },
  // 8 · galerias crescendo (tempo acelerado) — peça aberta
  {
    nome: "galerias-crescendo",
    dur: 3,
    cam: [{ t: 0, ...camPeca(0.85, 4.5), fov: 42 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 5), raio: 30 },
    el: (t, tl) => {
      const g = 0.08 + 0.92 * seg01(tl, 0.1, 2.8);
      return (
        <>
          <Casa t={t} />
          <PecaMadeira {...PECA} gal={GAL_PECA} position={PECA_POS} rotation={PECA_ROT} abrir={1} g={g}>
            <Populacao gal={GAL_PECA} t={t} g={g} />
          </PecaMadeira>
        </>
      );
    },
  },
  // 9 · operário: macro 3/4
  ...(["operario", "soldado", "rainha", "alado"] as Casta[]).map<S>((c) => ({
    nome: "macro-" + c,
    cam: [{ t: 0, pos: [c === "rainha" || c === "alado" ? 1.5 : 0.95, c === "rainha" || c === "alado" ? 1.0 : 0.62, c === "rainha" || c === "alado" ? 1.45 : 0.95], look: [0, 0.04, c === "alado" ? -0.2 : c === "rainha" ? -0.15 : -0.03], fov: 32 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta={c} cabeca={[0.15, 0]} />
      </>
    ),
  })),
  // 13 · operário de perfil (comparar com foto)
  {
    nome: "operario-perfil",
    cam: [{ t: 0, pos: [1.55, 0.2, -0.1], look: [0, 0.06, -0.1], fov: 34 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="operario" />
      </>
    ),
  },
  // 14 · operário de cima
  {
    nome: "operario-cima",
    cam: [{ t: 0, pos: [0.0, 1.05, 0.02], look: [0, 0, -0.03], fov: 34 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="operario" />
      </>
    ),
  },
  // 15 · cabeça do soldado de frente (rolha)
  {
    nome: "soldado-cabeca-frente",
    cam: [{ t: 0, pos: [0.22, 0.14, 0.65], look: [0, 0.06, 0.16], fov: 30 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="soldado" />
      </>
    ),
  },
  // 16 · castas lado a lado (escala)
  {
    nome: "castas-lado-a-lado",
    cam: [{ t: 0, pos: [0.3, 4.6, 3.6], look: [0.15, 0, -0.05], fov: 40 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 4 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="operario" position={[0, 0, 1.75]} rotation={[0, Math.PI / 2, 0]} />
        <Cupim t={t} casta="soldado" position={[0, 0, 0.75]} rotation={[0, Math.PI / 2, 0]} />
        <Cupim t={t} casta="rainha" position={[0.2, 0, -0.45]} rotation={[0, Math.PI / 2, 0]} />
        <Cupim t={t} casta="alado" position={[0.3, 0, -1.8]} rotation={[0, Math.PI / 2, 0]} />
      </>
    ),
  },
  // 17 · alado voando (asas abertas)
  {
    nome: "alado-voo",
    dur: 1,
    cam: [{ t: 0, pos: [0.3, 1.6, 1.4], look: [0, 0.45, -0.2], fov: 36 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="alado" position={[0, 0.45, 0]} voar={1} bater={1} />
      </>
    ),
  },
  // 18 · andando na galeria (peça aberta, câmera baixa acompanhando)
  {
    nome: "andando-galeria",
    dur: 2,
    cam: [0, 2].map((k) => {
      const q = naGaleria(GAL_PECA, 0, 1.6 + k * 0.25);
      return { t: k, pos: W(PC(q.p[0], 0, q.p[2]), [-0.9, 1.0, 1.1]), look: PC(q.p[0], -0.1, q.p[2]), fov: 34, lin: true };
    }),
    near: 0.02,
    luz: { foco: PC(2, 0, 0), raio: 6 },
    el: (t, tl) => (
      <>
        <Casa t={t} />
        <PecaMadeira {...PECA} gal={GAL_PECA} position={PECA_POS} rotation={PECA_ROT} abrir={1}>
          <CupimGal gal={GAL_PECA} ramo={0} s={1.6 + tl * 0.25} t={t} vel={0.25} />
        </PecaMadeira>
      </>
    ),
  },
  // 19 · mastigando e arrancando fibra (frente de escavação)
  {
    nome: "mastigar-fibra",
    dur: 3,
    cam: (() => {
      const R = GAL_PECA.ramos[2];
      const sF = Math.min(R.len, (0.72 - R.g0) * R.vel);
      const q = naGaleria(GAL_PECA, 2, sF - 0.4, 0.72);
      const f = new THREE.Vector3(Math.sin(q.yaw), 0, Math.cos(q.yaw)), l = new THREE.Vector3(f.z, 0, -f.x);
      const alvo = new THREE.Vector3(q.p[0], q.p[1] + 0.08, q.p[2]).addScaledVector(f, 0.12);
      const cam = alvo.clone().addScaledVector(l, 1.05).addScaledVector(UP, 0.75).addScaledVector(f, 0.35);
      return [{ t: 0, pos: PC(cam.x, cam.y, cam.z), look: PC(alvo.x, alvo.y, alvo.z), fov: 30 }];
    })(),
    near: 0.01,
    luz: { foco: PC(5, 0, 0), raio: 5 },
    el: (t, tl) => {
      const gg = 0.72;
      const R = GAL_PECA.ramos[2];
      const sF = Math.min(R.len, (gg - R.g0) * R.vel); // frente do ramo
      const qF = naGaleria(GAL_PECA, 2, sF - 0.02, gg);
      const puxa = seg01(tl, 0.6, 1.6);
      const recua = 0.06 * puxa; // o bicho dá um passinho para trás puxando
      const sB = sF - 0.44 - recua;
      const qB = naGaleria(GAL_PECA, 2, sB, gg);
      const pm = pontaMandibulaPose("operario", [0, 0.15], 0.4);
      const rot = new THREE.Euler(0, qB.yaw, 0);
      const ponta = new THREE.Vector3(...pm).multiplyScalar(MM).applyEuler(rot).add(new THREE.Vector3(...qB.p));
      const dF = new THREE.Vector3(Math.sin(qB.yaw), 0, Math.cos(qB.yaw)); // frente do bicho
      const B: V3 = [qF.p[0] + dF.x * 0.12, qF.p[1] + 0.09, qF.p[2] + dF.z * 0.12];
      return (
        <>
          <Casa t={t} />
          <PecaMadeira {...PECA} gal={GAL_PECA} position={PECA_POS} rotation={PECA_ROT} abrir={1} g={gg}>
            <Cupim t={t} position={[qB.p[0], qB.p[1], qB.p[2]]} rotation={[0, qB.yaw, 0]} piso={pisoGaleria(qB.w, qB.r)} mastigar={tl < 0.6 ? 1 : tl > 1.9 ? 1 : 0} mandibula={tl >= 0.6 && tl <= 1.9 ? 0.1 : 0} empurrar={0.4} andar={1} dist={-recua / MM} cabeca={[0, 0.15]} />
            <FibraSoltando B={B} dir={[-dF.x, 0, -dF.z]} L={0.3} alvo={ponta.toArray() as V3} puxar={0.25 + puxa * 0.75} comer={seg01(tl, 1.9, 2.9)} frente={dF.toArray() as V3} />
            <FrenteMastigacao c={[qF.p[0] + dF.x * 0.06, qF.p[1] + 0.12, qF.p[2] + dF.z * 0.06]} n={[-dF.x, 0, -dF.z]} dir={[-dF.x, 0, -dF.z]} tam={[0.45, 0.25]} />
          </PecaMadeira>
        </>
      );
    },
  },
  // 20 · celulose: fibra ampliada (feixe abrindo em fios)
  {
    nome: "celulose-ampliada",
    dur: 2,
    cam: [{ t: 0, pos: [2.0, 1.5, 9.5], look: [1.6, 0.2, 0], fov: 40 }],
    near: 0.05,
    luz: { foco: [3, 0, 0], raio: 8 },
    el: (t, tl) => <FibraAmpliada L={6} R={0.55} abrir={seg01(tl, 0.2, 1.6)} destaque={seg01(tl, 0, 0.6)} rotation={[0.3, 0.5, 0.9]} position={[0.4, -2.2, 0]} />,
  },
  // 21 · empurrando grânulo até o furo (raio-x da peça, close)
  {
    nome: "empurrando-grao",
    dur: 2,
    cam: (() => {
      const f = GAL_PECA.furo;
      return [{ t: 0, pos: W(PC(f.x, 0, f.z), [-1.6, 2.2, 2.0]), look: PC(f.x, 0, f.z), fov: 32 }];
    })(),
    near: 0.02,
    luz: { foco: PC(GAL_PECA.furo.x, 0, GAL_PECA.furo.z), raio: 6 },
    el: (t, tl) => {
      const f = GAL_PECA.furo;
      const s = f.s - 0.9 + seg01(tl, 0, 1.6) * 0.62;
      const q = naGaleria(GAL_PECA, f.ramo, s);
      const pm = pontaMandibula("operario");
      const pp = new THREE.Vector3(...pm).multiplyScalar(MM).applyEuler(new THREE.Euler(0, q.yaw, 0)).add(new THREE.Vector3(...q.p));
      return (
        <>
          <Casa t={t} />
          <PecaMadeira {...PECA} gal={GAL_PECA} furo position={PECA_POS} rotation={PECA_ROT} raioX={{ a: f.x - 2.2, b: f.x + 2.2, borda: 0.12 }}>
            <Cupim t={t} position={q.p} rotation={[0, q.yaw, 0]} piso={pisoGaleria(q.w, q.r)} andar={1} dist={s / MM} empurrar={1} sombra={false} />
            <Grao position={[pp.x, q.p[1] + GRAO_L * 0.5 * MM * 0.5 + 0.02, pp.z]} rotation={[0, q.yaw + Math.PI / 2, 0]} sombra={false} />
          </PecaMadeira>
        </>
      );
    },
  },
  // 22 · grânulo saindo pelo furo do batente e caindo no montinho
  {
    nome: "grao-caindo",
    dur: 2,
    cam: Array.from({ length: 21 }, (_, i) => {
      const tl = i * 0.1;
      const q = quedaGrao(tl - 0.3, FURO, [1, 0, 0], CASA.soleira + 0.55, 4);
      // acompanha com atraso suave: olha um pouco abaixo do grão; termina enquadrando o montinho
      const k = sm(clamp01((tl - 0.3) / 1.2));
      const look: V3 = [q.p[0] * (1 - k * 0.5) + MONTE[0] * k * 0.5, q.p[1] - 0.6 - k * 0.4, q.p[2]];
      return { t: tl, pos: W(look, [3.6 + k * 1.2, 0.9 + k * 1.4, 3.2 + k * 1.2]), look, fov: 32, lin: true };
    }),
    near: 0.05,
    luz: { foco: W(FURO, [0, -12, 0]), raio: 25 },
    el: (t, tl) => {
      const q = quedaGrao(tl - 0.3, FURO, [1, 0, 0], CASA.soleira + 0.55, 4);
      return (
        <>
          <Casa t={t} montinho={1} />
          <Grao position={q.p} rotation={q.rot} escala={1.0} />
        </>
      );
    },
  },
  // 23 · montinho macro
  {
    nome: "montinho-macro",
    cam: [{ t: 0, pos: W(MONTE, [3.0, 2.2, 3.0]), look: W(MONTE, [0, 0.25, 0]), fov: 34 }],
    near: 0.02,
    luz: { foco: MONTE, raio: 6 },
    el: (t) => <Casa t={t} montinho={1} />,
  },
  // 24 · grânulo isolado (6 faces côncavas) + corte transversal dele
  {
    nome: "grao-heroi",
    dur: 2,
    cam: [{ t: 0, pos: [0.1, 0.2, 0.25], look: [0.008, 0.02, -0.005], fov: 30 }],
    near: 0.005,
    luz: { foco: [0, 0, 0], raio: 1 },
    el: (t, tl) => (
      <>
        <PlacaCrua />
        <Grao position={[-0.03, 0.026, 0]} rotation={[0.25, tl * 0.5 + 0.4, 0]} det={2} />
        <Grao position={[0.05, GRAO_L * MM * 0.5, -0.03]} rotation={[Math.PI / 2, 0, 0.2]} det={2} />
      </>
    ),
  },
  // 25 · seção original × infestada (menos material)
  {
    nome: "secao-comparacao",
    cam: [{ t: 0, pos: [0, 0, 30], look: [0, 0, 0], fov: 38 }],
    near: 0.1,
    luz: { foco: [0, 0, 0], raio: 15 },
    el: (t) => (
      <>
        <SecaoTransversal gal={GAL_BAT} W={15} D={3.5} xs={-1} g={0} position={[0, 3.2, 0]} />
        <SecaoTransversal gal={GAL_BAT} W={15} D={3.5} xs={-1} g={1} position={[0, -3.2, 0]} destaque={1} />
      </>
    ),
  },
  // 25b · corte aberto com a madeira que falta pintada (MENOS MATERIAL)
  {
    nome: "corte-menos-material",
    cam: [{ t: 0, ...camPeca(0.85, 4.5), fov: 42 }],
    near: 0.2,
    luz: { foco: PC(15, 0, 5), raio: 30 },
    el: (t) => (
      <>
        <Casa t={t} />
        <PecaMadeira {...PECA} gal={GAL_PECA} position={PECA_POS} rotation={PECA_ROT} abrir={1} destaque={1} />
      </>
    ),
  },
  // 26 · humano azul ao lado do batente (escala)
  {
    nome: "humano-batente",
    cam: [{ t: 0, pos: [120, 125, 340], look: [10, 100, 0], fov: 42 }],
    near: 1,
    luz: { foco: [20, 90, 0], raio: 160 },
    el: (t) => (
      <>
        <Casa t={t} montinho={1} />
        <HumanoTranslucido t={t} position={[-32, 0, 28]} rotation={[0, 0.5, 0]} scale={HUMANO} />
      </>
    ),
  },
  // 27 · humano do tamanho de um cupim (5 mm) na soleira, ao lado do montinho
  {
    nome: "humano-tamanho-cupim",
    cam: [{ t: 0, pos: W(MONTE, [3.4, 0.75, 3.2]), look: W(MONTE, [1.4, 0.28, 1.2]), fov: 32 }],
    near: 0.02,
    luz: { foco: MONTE, raio: 6 },
    el: (t) => (
      <>
        <Casa t={t} montinho={1} />
        <HumanoTranslucido t={t} position={W(MONTE, [1.3, 0, 1.5])} rotation={[0, 0.8, 0]} scale={HUMANO * (0.55 / 175)} />
        <Cupim t={t} position={W(MONTE, [1.75, 0, 1.0])} rotation={[0, -2.4, 0]} cabeca={[0.3, 0]} />
      </>
    ),
  },

  // ======================= QUARTO (roteiro v4) =======================
  // 30 · quarto geral: porta, batente, guarda-roupa, viga, lâmpada, fila de formigas
  {
    nome: "quarto-geral",
    cam: [{ t: 0, pos: [175, 135, 430], look: [-25, 120, 0], fov: 50 }],
    near: 1,
    luz: { foco: [-20, 100, 30], raio: 220 },
    el: (t) => <Quarto t={t} montinho={1} montinhoGR={1} formigas />,
  },
  // 31 · porta em raio-x: 20 colônias + família azul (1 FAMÍLIA)
  {
    nome: "porta-20-colonias",
    cam: [{ t: 0, pos: [70, 112, 300], look: [70, 100, 0], fov: 50 }],
    near: 1,
    luz: { foco: [20, 100, 20], raio: 160 },
    el: (t) => (
      <>
        <Quarto t={t} porta={{ raioX: { a: -1, b: 300, borda: 0.01 } }} familia={false} />
        <FamiliaAzul t={t} position={[125, 0, 45]} rotation={[0, -0.35, 0]} />
        {CENTROS_PORTA.map((c, i) => (
          <mesh key={i} position={[c[0], c[1] + 10, c[2] + 0.3]}>
            <ringGeometry args={[7.5, 8.3, 40]} />
            <meshBasicMaterial color="#FFD23F" />
          </mesh>
        ))}
      </>
    ),
  },
  // 32 · formigas subindo o batente até o furinho do porteiro
  {
    nome: "formigas-batente",
    cam: [{ t: 0, pos: W(FURO, [7, -3, 6]), look: W(FURO, [0, -2.5, 0.4]), fov: 34 }],
    near: 0.1,
    luz: { foco: FURO, raio: 15 },
    el: (t) => <Quarto t={t} formigas={[0, 400]} />,
  },
  // 33 · porteiro: raio-x no furo; o soldado sobe e tapa o túnel com a cabeça; a formiga chega e não entra
  {
    nome: "porteiro-tapando",
    dur: 3,
    cam: [{ t: 0, pos: W(FURO, [2.6, 0.4, 1.0]), look: W(FURO, [0, -0.45, 0]), fov: 32 }],
    near: 0.02,
    luz: { foco: FURO, raio: 4 },
    el: (t, tl) => {
      const k = seg01(tl, 0.3, 1.4);
      const f = GAL_BAT.furo;
      // formiga chega pela face do batente (de baixo) até a borda do furo
      const sF = TRILHA_FORMIGAS;
      const qa = naTrilha(sF, 0);
      void qa;
      const antY = -1.2 + seg01(tl, 0.8, 2.2) * 0.95;
      return (
        <>
          <Quarto t={t} batente={{ raioX: { a: f.x - 1.1, b: f.x - 0.1, borda: 0.05 }, furoTampado: k > 0.98, children: <Cupim t={t} casta="soldado" position={[f.x, CASA.bat.D / 2 - 0.228 - (1 - k) * 0.6, f.z]} rotation={[-Math.PI / 2, 0, 0]} andar={1} dist={k * 6} sombra={false} /> }} />
          <Formiga t={t} position={[FURO[0] + 0.04, FURO[1] + antY, FURO[2] + 0.05]} rotation={noPlanoX} dist={antY / MM} cabeca={tl > 2.2 ? 0.4 * Math.sin((tl - 2.2) * 2.5) : 0} />
        </>
      );
    },
  },
  // 34 · revoada de aleluias na lâmpada acesa
  {
    nome: "revoada-lampada",
    dur: 1,
    cam: [{ t: 0, pos: W(LAMPADA, [30, -38, 62]), look: W(LAMPADA, [0, -4, 0]), fov: 40 }],
    near: 0.5,
    luz: { foco: LAMPADA, raio: 60 },
    el: (t) => <Quarto t={t} lampada={1} revoada />,
  },
  // 35 · casal pousa no batente e solta as asas (2 s), ao lado do furo de prego
  {
    nome: "casal-solta-asas",
    dur: 2,
    cam: [{ t: 0, pos: BAT(100, 7.5, 2), look: BAT(100, 1.75, 0.5), fov: 34 }],
    near: 0.05,
    luz: { foco: BAT(100, 0, 0), raio: 8 },
    el: (t, tl) => {
      const pousa = seg01(tl, 0, 0.6), sol = seg01(tl, 0.8, 1.7);
      const casal = [0, 1].map((i) => (
        <Cupim key={i} t={t + i} casta="alado" voar={1 - pousa} bater={1 - pousa} soltarAsas={sol} position={[99 + i * 1.1, CASA.bat.D / 2 + (1 - pousa) * 2.5, 1.2 - i * 0.6]} rotation={[0, 3.6 + i * 0.4, 0]} escala={1} />
      ));
      return <Quarto t={t} batente={{ children: <>{casal}<FuroPrego position={[97.6, CASA.bat.D / 2, 0.3]} rotation={[0, 0, 0]} /></> }} />;
    },
  },
  // 36 · casal (sem asas) entra no furo de prego, em tandem, e o furo é tapado por dentro (3 s)
  {
    nome: "casal-entra-tapa",
    dur: 3,
    cam: [{ t: 0, pos: BAT(97.6, 6, 2.2), look: BAT(97.6, 1.75, 0.3), fov: 30 }],
    near: 0.05,
    luz: { foco: BAT(97.6, 0, 0), raio: 6 },
    el: (t, tl) => {
      // caminho: na face (y = D/2) até o furo, depois para dentro (−y)
      const pos = (s: number): { p: V3; r: V3 } => {
        const xF = 97.6, zF = 0.3, yF = CASA.bat.D / 2;
        if (s < 0) return { p: [xF - s * 0.9, yF, zF + s * 0.2], r: [0, -Math.PI / 2 - 0.2, 0] };
        return { p: [xF, yF - s, zF], r: [Math.PI / 2 * Math.min(1, s / 0.15), -Math.PI / 2, 0] };
      };
      const s1 = -0.9 + tl * 0.7, s2 = s1 - 0.62;
      const tamp = seg01(tl, 2.2, 2.9);
      const um = (s: number, i: number) => {
        if (s > 0.9) return null;
        const q = pos(s);
        return <Cupim key={i} t={t + i} casta="alado" semAsas position={q.p} rotation={q.r} andar={1} dist={s / MM} />;
      };
      return (
        <Quarto
          t={t}
          batente={{
            children: (
              <>
                {um(s1, 0)}
                {um(s2, 1)}
                <Cupim t={t} casta="alado" soAsas soltarAsas={1} position={[99, CASA.bat.D / 2, 1.2]} rotation={[0, 3.6, 0]} />
                <FuroPrego position={[97.6, CASA.bat.D / 2, 0.3]} rotation={[0, 0, 0]} tampar={tamp} />
              </>
            ),
          }}
        />
      );
    },
  },
  // 37 · barriga translúcida com micróbios (operário)
  {
    nome: "barriga-microbios",
    cam: [{ t: 0, pos: [1.1, 0.7, -0.35], look: [0, 0.05, -0.12], fov: 32 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t) => (
      <>
        <PlacaCrua />
        <Cupim t={t} casta="operario" barriga={1} />
      </>
    ),
  },
  // 38 · filhote ganha micróbios: golinho no bumbum do pai (gota com micróbios indo da ponta do abdômen à boca)
  {
    nome: "filhote-golinho",
    dur: 2,
    cam: [{ t: 0, pos: [1.5, 0.95, -0.25], look: [0, 0.05, -0.42], fov: 32 }],
    near: 0.01,
    luz: { foco: [0, 0, 0], raio: 3 },
    el: (t, tl) => {
      const tip = new THREE.Vector3(0, 0.06, -0.33);
      const boca = new THREE.Vector3(0, 0.045, -0.47);
      const k = seg01(tl, 0.3, 1.6);
      const gp = tip.clone().lerp(boca, k);
      return (
        <>
          <PlacaCrua />
          <Cupim t={t} casta="alado" semAsas barriga={0.8} />
          <Cupim t={t} casta="operario" escala={0.55} position={[0, 0, -0.62]} rotation={[0, 0, 0]} mastigar={k > 0.9 ? 1 : 0} />
          <mesh position={gp.toArray()} scale={0.022 * (1 - 0.6 * seg01(tl, 1.5, 1.9))}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshPhysicalMaterial color="#E8C890" transparent opacity={0.75} roughness={0.1} depthWrite={false} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={gp.clone().add(new THREE.Vector3(Math.cos(i * 2.1 + t) * 0.008, 0.004 * i - 0.004, Math.sin(i * 2.1 + t) * 0.008)).toArray()} scale={[0.004, 0.004, 0.01]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={["#3FD6C6", "#7FE36B", "#B98BFF"][i]} emissive={["#3FD6C6", "#7FE36B", "#B98BFF"][i]} emissiveIntensity={0.5} />
            </mesh>
          ))}
        </>
      );
    },
  },
  // 39 · guarda-roupa: furinho com grãos caindo e montinho no chão
  {
    nome: "guarda-roupa-saleiro",
    dur: 2,
    cam: [{ t: 0, pos: W(MONTE_GR(), [16, 9, 16]), look: W(MONTE_GR(), [-1.5, 5, -1]), fov: 36 }],
    near: 0.1,
    luz: { foco: MONTE_GR(), raio: 30 },
    el: (t, tl) => {
      const graos = [0, 0.45, 0.9, 1.35].map((d, i) => {
        const q = quedaGrao((tl + d) % 1.8 - 0.25, FURO_GR(), [1, 0, 0], 0.62, 3, i);
        return <Grao key={i} position={q.p} rotation={q.rot} />;
      });
      return (
        <>
          <Quarto t={t} montinhoGR={1} />
          {graos}
        </>
      );
    },
  },
  // 40 · aleluias saindo de um furo do guarda-roupa (2 s)
  {
    nome: "aleluias-saindo-gr",
    dur: 2,
    cam: [{ t: 0, pos: W(FURO_GR(), [10, 3, 8]), look: W(FURO_GR(), [1.5, 1.5, 0]), fov: 34 }],
    near: 0.1,
    luz: { foco: FURO_GR(), raio: 15 },
    el: (t, tl) => {
      const F = FURO_GR();
      const sai = [0, 0.6, 1.2].map((d, i) => {
        const u = tl - d;
        if (u < 0) return null;
        const out = Math.min(u * 1.2, 0.7); // sai do furo (para +x)
        const voo = Math.max(0, u - 0.6);
        const p: V3 = [F[0] + out + voo * 6, F[1] + voo * voo * 8 + i * 0.3, F[2] + voo * 3 * (i - 1)];
        return <Cupim key={i} t={t + i} casta="alado" voar={seg01(u, 0.5, 0.8)} bater={seg01(u, 0.5, 0.8)} position={p} rotation={[0, Math.PI / 2, 0]} escala={1} sombra={false} />;
      });
      return (
        <>
          <Quarto t={t} montinhoGR={1} />
          {sai}
        </>
      );
    },
  },
  // 41 · viga do forro em raio-x (galerias tomando a viga) + lambri
  {
    nome: "viga-raiox",
    cam: [{ t: 0, pos: [20, 205, 235], look: [8, 254, 150], fov: 44 }],
    near: 0.5,
    luz: { foco: [8, 250, 150], raio: 60 },
    el: (t) => <Quarto t={t} viga={{ raioX: { a: 110, b: 185, borda: 0.4 } }} />,
  },
  // 42 · polegar afundando o batente: a casca cede e aparecem galerias e cupins (2 s)
  {
    nome: "dedo-afunda",
    dur: 2,
    cam: (() => {
      const q = naGaleria(GAL_BAT, 0, 4.5);
      const C = BAT(q.p[0], CASA.bat.D / 2, q.p[2]);
      return [{ t: 0, pos: W(C, [16, 6, 14]), look: W(C, [2, 0, 0]), fov: 34 }];
    })(),
    near: 0.1,
    luz: { foco: BAT(44, 0, 0), raio: 25 },
    el: (t, tl) => {
      const q = naGaleria(GAL_BAT, 0, 4.5);
      const k = seg01(tl, 0.4, 1.1);
      const sai = seg01(tl, 1.3, 1.9);
      const C = BAT(q.p[0], CASA.bat.D / 2, q.p[2]);
      // a ponta do polegar encosta em C e afunda 0,35 cm (normal da face = +x)
      const ponta: V3 = [C[0] - 0.35 * k + sai * 5 + (1 - seg01(tl, 0, 0.4)) * 6, C[1], C[2]];
      const rot: V3 = [0, -Math.PI / 2, 0.3];
      const pp = new THREE.Vector3(...PONTA_POLEGAR).applyEuler(new THREE.Euler(...rot));
      return (
        <>
          <Quarto t={t} batente={{ amassado: { x: q.p[0], z: q.p[2], r: 0.9, k }, children: <Populacao gal={GAL_BAT} t={t} sombra={false} /> }} />
          <MaoAzul fechar={1} polegar={1} position={[ponta[0] - pp.x, ponta[1] - pp.y, ponta[2] - pp.z]} rotation={rot} />
        </>
      );
    },
  },
  // 43 · mão batendo no batente (punho), 2 batidas lentas
  {
    nome: "mao-bate",
    dur: 2,
    cam: [{ t: 0, pos: W(BAT(125, 0, 0), [42, 8, 48]), look: W(BAT(125, 0, 0), [8, 0, 0]), fov: 38 }],
    near: 0.5,
    luz: { foco: BAT(110, 0, 0), raio: 40 },
    el: (t, tl) => {
      const bat = Math.max(0, Math.sin(tl * Math.PI * 2 * 1.0)); // 1 batida/s
      const C = BAT(125, CASA.bat.D / 2, 5.5);
      const rot: V3 = [0, -Math.PI / 2, Math.PI / 2];
      const nd = new THREE.Vector3(...NOS_DEDOS).applyEuler(new THREE.Euler(...rot));
      const x = C[0] + 0.1 + bat * 9;
      return (
        <>
          <Quarto t={t} />
          <MaoAzul fechar={1} polegar={0} position={[x - nd.x, C[1] - nd.y, C[2] - nd.z]} rotation={rot} />
        </>
      );
    },
  },
  // 44 · móvel usado entrando pela porta (porta abre, cômoda desliza para dentro empurrada pelo humano azul)
  {
    nome: "movel-usado-entra",
    dur: 3,
    cam: [{ t: 0, pos: [140, 150, 300], look: [40, 70, -20], fov: 46 }],
    near: 1,
    luz: { foco: [40, 60, 0], raio: 200 },
    el: (t, tl) => {
      const abre = seg01(tl, 0, 0.8);
      const z = -120 + seg01(tl, 0.6, 2.9) * 170;
      return (
        <>
          <Quarto t={t} porta={{ abre }} />
          <Comoda position={[41, 0, z]} />
          <HumanoTranslucido t={t} position={[41, 0, z - 45]} scale={HUMANO} />
        </>
      );
    },
  },

  // 45 · poses da mão azul (teste): polegar esticado e punho; esferas amarelas = PONTA_POLEGAR / NOS_DEDOS
  {
    nome: "mao-poses",
    cam: [{ t: 0, pos: [0, 30, 55], look: [0, 0, 6], fov: 40 }],
    near: 0.5,
    luz: { foco: [0, 0, 0], raio: 40 },
    el: () => (
      <>
        <ChaoCru tam={80} position={[0, -6, 0]} />
        <MaoAzul fechar={1} polegar={1} position={[-12, 0, 0]} />
        <mesh position={[PONTA_POLEGAR[0] - 12, PONTA_POLEGAR[1], PONTA_POLEGAR[2]]}><sphereGeometry args={[0.5, 12, 8]} /><meshBasicMaterial color="#FFD23F" /></mesh>
        <MaoAzul fechar={1} polegar={0} position={[12, 0, 0]} />
        <mesh position={[NOS_DEDOS[0] + 12, NOS_DEDOS[1], NOS_DEDOS[2]]}><sphereGeometry args={[0.5, 12, 8]} /><meshBasicMaterial color="#FFD23F" /></mesh>
      </>
    ),
  },
];
void BAT_L; void BAT_POS; void GAL_GR; void grParaMundo; void GR; void MONTE_GR; void PORTA; void vigaParaMundo; void GAL_VIGA; void Formiga; void BAT_ROT; void clamp01; void gp; void MontinhoGraos;

export const SETUPS = LAB;
export const LAB_INI = LAB.reduce<number[]>((a, s) => (a.push(a[a.length - 1] + (s.dur ?? 1)), a), [0]);
export const LAB_DUR = LAB_INI[LAB_INI.length - 1];

export const CupimLab: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {LAB.map((s, i) => (
        <Sequence key={i} from={Math.round(LAB_INI[i] * fps)} durationInFrames={Math.round((s.dur ?? 1) * fps)} layout="none">
          <Setup s={s} t0={LAB_INI[i]} i={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
const Setup: React.FC<{ s: S; t0: number; i: number }> = ({ s, t0, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = f / fps;
  const t = t0 + tl;
  const keys = s.cam.map((k) => ({ ...k, t: k.t + t0 }));
  return (
    <AbsoluteFill>
      <PalcoCasa>
        <CupimCam t={t} keys={keys} near={s.near ?? 0.05} />
        <LuzCasa foco={s.luz?.foco} raio={s.luz?.raio} />
        {s.el(t, tl)}
      </PalcoCasa>
      {s.overlay ? s.overlay(tl) : null}
      <div style={{ position: "absolute", left: 30, top: 30, color: "#fff", font: "bold 40px sans-serif", textShadow: "0 0 6px #000" }}>
        {i} · {s.nome} · t={t0.toFixed(0)}s
      </div>
    </AbsoluteFill>
  );
};
