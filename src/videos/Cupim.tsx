import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import timelineJson from "../../public/cupim/timeline.json";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import { ApelidoAmarelo, AMARELO, FONT_KIT, Legenda1Palavra, NumeroTopo as NumeroTopoKit, TINTA, useKitFont } from "../three/animais/ui";
import { Etiqueta, Xis } from "../three/animais/LagartixaTela";
import { HumanoTranslucido } from "../three/animais/HumanoTranslucido";
import { HumanoAzul } from "../three/animais/LagartixaHumano";
import { batParaMundo, CASA, GAL_BAT } from "../three/cupim/Casa";
import { Casta, Cupim as Bicho, CupimProps } from "../three/cupim/Cupim";
import { clamp01, CupimCam, HUMANO, LKey, LuzCasa, MM, mix, noPlano, PalcoCasa, rnd, sm, texCanvas, V3 } from "../three/cupim/CupimComum";
import { FibraSoltando, FrenteMastigacao } from "../three/cupim/Fibra";
import { Formiga } from "../three/cupim/Formiga";
import { Grao, GRAO_L, quedaGrao } from "../three/cupim/Graos";
import { Galerias, gerarGalerias, mesclarGalerias, naGaleria } from "../three/cupim/Madeira";
import { MaoAzul, NOS_DEDOS, PONTA_POLEGAR } from "../three/cupim/Mao";
import { CENTROS_PORTA, Comoda, FURO_GR, FuroPrego, GAL_GR, GAL_VIGA, grParaMundo, GR, LAMPADA, MONTE_GR, PORTA, Quarto, QuartoProps, vigaParaMundo, VIGA } from "../three/cupim/Quarto";

// =====================================================================
// "Seu pau tá cheio de bicho" — cupim-de-madeira-seca (Cryptotermes brevis). Kit: src/three/cupim/* (1 un = 1 cm).
// Cenário único (quarto de casa brasileira, de dia). Cada plano é cravado numa palavra da narração (wordAt + OFF).
// Último quadro = primeiro (o polegar afundando o batente).
// ESTADO GLOBAL (todas as cenas leem daqui):
//   dente(t)      — cratera do polegar no batente: o gancho é a "prévia" do instante "até afundar no dedo"; depois dele fica para sempre.
//   idadeMotel(t) — colônia nova do furo de prego (flashback do casal): câmara → galerias crescendo.
//   idadeGR(t)    — guarda-roupa: maduro (1), exceto no tempo acelerado dos 5 anos.
//   lampada(t)    — acesa nas revoadas.
// Regras: nada pisca; nada colado na lente; luz idêntica (LuzCasa) em todos os planos; humanos só azul translúcido.
// =====================================================================
const TL = timelineJson as Timeline;
const FPS = 30;
const OFF = 0.5;
export const cupimDuration = (fps: number) => Math.ceil((TL.duration + OFF + 0.5) * fps);
const FIM = (cupimDuration(FPS) - 1) / FPS;
const w = (c: string, word: string, n = 0) => wordAt(TL, c, word, n) + OFF;
const S = (c: string) => cena(TL, c).start + OFF;
const PI = Math.PI;
const add = (p: V3, d: V3): V3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const DB = CASA.bat.D / 2; // face do batente (local y)
const BAT = (x: number, y: number, z: number) => batParaMundo([x, y, z]);

type Plan = { from: number; to: number; keys: LKey[]; near?: number; luz?: { foco: V3; raio: number }; scene: (t: number) => React.ReactNode; over?: (t: number) => React.ReactNode };
const P = (from: number, to: number, p: Omit<Plan, "from" | "to">): Plan => ({ from, to, ...p });
const fixa = (pos: V3, look: V3, fov: number): LKey[] => [{ t: 0, pos, look, fov }];
const mov = (a: number, b: number, p0: V3, l0: V3, p1: V3, l1: V3, f0: number, f1 = f0): LKey[] => [
  { t: a, pos: p0, look: l0, fov: f0 },
  { t: b, pos: p1, look: l1, fov: f1 },
];

// ---------- galerias extras ----------
// colônia nova do casal (furo de prego no batente, ~1 m do chão): ninho em x ≈ 97 (local do batente)
export const GAL_MOTEL: Galerias = gerarGalerias(41, 118, 132, CASA.bat.W / 2, { ramos: 14 }); // acima da maçaneta (y ≈ 98)
const NINHO_M = GAL_MOTEL.ramos[0].pts[0];
const PREGO = { x: NINHO_M.x, z: NINHO_M.z }; // furo de prego (local do batente), logo acima/ao lado da câmara
const GAL_BAT_MOTEL = mesclarGalerias([GAL_BAT, GAL_MOTEL]);

// ---------- ESTADO GLOBAL ----------
const DENTE = { x: 46.4, z: -0.5, r: 0.95 }; // local do batente (galerias de 8 ramos passam por aqui)
const T_AFUNDA = () => w("tambor", "afundar"); // o dedo afunda "de verdade"
const kGancho = (u: number) => 0.1 + 0.9 * sm(clamp01((u + 1.5) / 2.7)); // contínuo em u = 0 (loop)
const dente = (t: number, u?: number) => {
  if (u !== undefined) return { ...DENTE, k: kGancho(u) };
  if (t < T_AFUNDA()) return undefined;
  return { ...DENTE, k: kGancho(t - T_AFUNDA() - 0.3) };
};
// câmara do casal (0,06) → o filhote chega por uma galeria curta (0,17) → no tempo acelerado do marmitex vira colônia (0,65)
const idadeMotel = (t: number) => {
  if (t < w("marmitex", "o", 1) - 0.6) return 0.1; // câmara do tamanho do casal (o abdômen não sai dela)
  if (t < w("marmitex", "esse")) return mix(0.1, 0.26, prog(t, w("marmitex", "o", 1) - 0.6, w("marmitex", "o", 1) - 0.1));
  return mix(0.26, 0.65, prog(t, w("marmitex", "esse"), S("saleiro") - 0.1, (x) => x));
};
const T_5A0 = () => w("inquilino", "a") - 0.1;
const T_5A1 = () => w("inquilino", "tem") - 0.3;
const idadeGR = (t: number) => (t >= T_5A0() && t < S("tambor") - 0.01 && t < T_5A1() + 0.5 ? mix(0.12, 1, prog(t, T_5A0() + 0.2, T_5A1(), (x) => x)) : 1);
const lampadaEm = (t: number) => {
  const a = prog(t, w("motel", "como") + 0.2, w("motel", "como") + 0.35, (x) => x) * (1 - prog(t, S("marmitex"), S("marmitex") + 0.01, (x) => x));
  const b = prog(t, w("virada", "chama") - 0.1, w("virada", "chama") + 0.05, (x) => x) * (1 - prog(t, w("virada", "ou"), w("virada", "ou") + 0.01, (x) => x));
  return Math.max(a, b);
};

// ---------- cenário ----------
const quarto = (t: number, extra: Partial<QuartoProps> = {}) => <Quarto t={t} montinho={1} montinhoGR={1} lampada={lampadaEm(t)} formigas {...extra} batente={{ amassado: dente(t), ...extra.batente }} />;

// cupim andando num ramo (vai e volta só dentro de um trecho [s0,s1]) — referencial da peça
const pisoGaleria = (wd: number, r: number) => (latMM: number) => {
  const l = (latMM * MM) / Math.max(1e-3, wd);
  return (r - r * Math.sqrt(Math.max(0, 1 - Math.min(1, l * l)))) / MM;
};
const CupimRamo: React.FC<{ gal: Galerias; ramo: number; s0: number; s1: number; t: number; v?: number; fase?: number; g?: number } & Partial<CupimProps>> = ({ gal, ramo, s0, s1, t, v = 0.18, fase = 0, g = 1, ...rest }) => {
  const L = Math.max(0.01, s1 - s0);
  const per = (2 * L) / Math.max(1e-3, v);
  const ph = v > 0 ? (((t + fase) % per) + per) % per / per : 0;
  const ida = ph < 0.5;
  const s = v > 0 ? s0 + (ida ? ph * 2 : 2 - ph * 2) * L : s0;
  const q = naGaleria(gal, ramo, s, g);
  // vira devagar nas pontas (meia-volta em ~0,4 s, sem estalo)
  const borda = Math.min(ph, Math.abs(ph - 0.5), 1 - ph) * per;
  const vira = v > 0 ? sm(clamp01(1 - borda / 0.2)) : 0;
  const yaw = q.yaw + (ida ? 0 : PI) + (v > 0 ? (ida ? 1 : -1) * 0 : 0);
  void vira;
  return <Bicho t={t} position={q.p} rotation={[0, yaw, 0]} piso={pisoGaleria(q.w, q.r)} andar={v > 0 ? 1 : 0} dist={v > 0 ? (s - s0) / MM : 0} sombra={false} {...rest} />;
};
// trecho de cada ramo que cai dentro de um círculo (cratera / lupa)
const trechosNoCirculo = (gal: Galerias, cx: number, cz: number, r: number) => {
  const out: { ramo: number; s0: number; s1: number }[] = [];
  gal.ramos.forEach((R, i) => {
    let a = -1, b = -1;
    for (let s = 0; s < R.len; s += 0.05) {
      const q = naGaleria(gal, i, s);
      if (Math.hypot(q.p[0] - cx, q.p[2] - cz) < r) {
        if (a < 0) a = s;
        b = s;
      }
    }
    if (a >= 0 && b - a > 0.35) out.push({ ramo: i, s0: a, s1: b });
  });
  return out;
};
// cratera do polegar: em vez de olhar o "vazio" do raio-x, o fundo da cratera é a madeira crua logo abaixo da casca,
// com as galerias como canais escavados (mesmo traçado de GAL_BAT) e os cupins andando dentro deles
const TR_DENTE = trechosNoCirculo(GAL_BAT, DENTE.x, DENTE.z, DENTE.r * 0.92);
const texCratera = () =>
  texCanvas("cupVidCratera", 640, 640, (g, W, H) => {
    const r = DENTE.r * 1.55;
    const px = (x: number, z: number): [number, number] => [((x - DENTE.x) / r + 1) * 0.5 * W, ((z - DENTE.z) / r + 1) * 0.5 * H];
    // madeira crua (fibras ao longo de x)
    g.fillStyle = "#D4A273";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const y = rnd(i, 1) * H, a = 0.05 + rnd(i, 2) * 0.12;
      g.fillStyle = `rgba(${rnd(i, 3) < 0.5 ? "120,70,35" : "245,210,165"},${a})`;
      g.fillRect(0, y, W, 1 + rnd(i, 4) * 2.5);
    }
    // canais: borda escura, fundo marrom (sombreado), linha clara no fundo
    const passe = (cor: string, mul: number) => {
      g.strokeStyle = cor;
      g.lineCap = "round";
      g.lineJoin = "round";
      GAL_BAT.ramos.forEach((R, i) => {
        for (let s = 0; s < R.len - 0.04; s += 0.04) {
          const a = naGaleria(GAL_BAT, i, s), b = naGaleria(GAL_BAT, i, s + 0.04);
          if (Math.hypot(a.p[0] - DENTE.x, a.p[2] - DENTE.z) > r * 1.6) continue;
          const [x0, y0] = px(a.p[0], a.p[2]), [x1, y1] = px(b.p[0], b.p[2]);
          g.lineWidth = ((2 * a.w * mul) / (2 * r)) * W;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
        }
      });
    };
    passe("#4A2711", 0.78);
    passe("#6B3D1D", 0.62);
    passe("#8A5630", 0.32);
    // escurece a borda (profundidade da cratera)
    const gr = g.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.36);
    gr.addColorStop(0, "rgba(40,20,8,0)");
    gr.addColorStop(1, "rgba(40,20,8,0.55)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }, true, false);
const yFundo = (k: number) => DB - 0.35 * k - 0.03;
const FundoCratera: React.FC<{ k: number }> = ({ k }) => (
  <mesh position={[DENTE.x, yFundo(k), DENTE.z]} rotation={[-PI / 2, 0, 0]} renderOrder={2}>
    <circleGeometry args={[DENTE.r * 1.55, 64]} />
    <meshStandardMaterial map={texCratera()} roughness={0.85} />
  </mesh>
);
const CupinsDente: React.FC<{ t: number; k: number }> = ({ t, k }) => (
  <>
    <FundoCratera k={k} />
    {TR_DENTE.slice(0, 7).map((r, i) => {
      const L = r.s1 - r.s0 + 0.5;
      const v = 0.14 + 0.03 * (i % 3);
      const per = (2 * L) / v;
      const ph = ((t + i * 1.9) % per) / per;
      const ida = ph < 0.5;
      const s = r.s0 - 0.25 + (ida ? ph * 2 : 2 - ph * 2) * L;
      const q = naGaleria(GAL_BAT, r.ramo, s);
      return <Bicho key={i} t={t + i} casta={i === 2 ? "soldado" : "operario"} position={[q.p[0], yFundo(k) + 0.004, q.p[2]]} rotation={[0, q.yaw + (ida ? 0 : PI), 0]} andar={1} dist={(s - r.s0) / MM} mastigar={i % 2 ? 0.6 : 0} sombra={false} />;
    })}
  </>
);

// ---------- GANCHO: polegar azul afundando o batente (u = tempo local; u = 0 é o 1º quadro) ----------
const C_DENTE = BAT(DENTE.x, DB, DENTE.z);
const ROT_POLEGAR: V3 = [0, -PI / 2, 0.3];
const Polegar: React.FC<{ k: number; afasta?: number }> = ({ k, afasta = 0 }) => {
  // a ponta do polegar encosta na borda de cima da cratera e afunda junto com ela (normal da face = +x)
  const ponta: V3 = [C_DENTE[0] - 0.3 * k + 0.25 + afasta, C_DENTE[1] + DENTE.r * 1.15, C_DENTE[2] + 0.2];
  const pp = new THREE.Vector3(...PONTA_POLEGAR).applyEuler(new THREE.Euler(...ROT_POLEGAR));
  return <MaoAzul fechar={1} polegar={1} position={[ponta[0] - pp.x, ponta[1] - pp.y, ponta[2] - pp.z]} rotation={ROT_POLEGAR} />;
};
function gancho(t: number, u: number) {
  const k = kGancho(u);
  return (
    <>
      {quarto(t, { batente: { amassado: { ...DENTE, k }, children: <CupinsDente t={t} k={k} /> } })}
      <Polegar k={k} afasta={(1 - k) * 3.2} />
    </>
  );
}
const C_G = { pos: add(C_DENTE, [5.6, -1.5, 0.9]), look: add(C_DENTE, [0, 0.55, 0]), fov: 36 };

// ---------- PORTA com 20 colônias ----------
const PORTA_L = PORTA.y1 - PORTA.y0;
const ordemCol = CENTROS_PORTA.map((c, i) => ({ c, i })).sort((a, b) => b.c[1] - a.c[1]); // de cima para baixo (a varredura desce)
const T_VARRE0 = () => w("porta", "so");
const T_VARRE1 = () => w("porta", "familias") + 0.5;
const varrePorta = (t: number) => prog(t, T_VARRE0(), T_VARRE1(), (x) => x);
const portaRaioX = (t: number, aberta = 1) => {
  const k = Math.min(varrePorta(t), aberta);
  return k > 0.002 ? { raioX: { a: PORTA_L * (1 - k) - 0.5, b: PORTA_L + 1, borda: 1.2 } } : {};
};
const Aneis: React.FC<{ t: number; vis?: number }> = ({ t, vis = 1 }) => (
  <>
    {ordemCol.map(({ c }, j) => {
      const yLinha = PORTA.y0 + PORTA_L * (1 - varrePorta(t));
      const a = clamp01((yLinha - (c[1] + 10)) / -6 + 1) * vis; // acende quando a varredura passa pelo centro
      void j;
      if (a < 0.01) return null;
      return (
        <mesh key={j} position={[c[0], c[1] + 10, c[2] + 0.4]} scale={0.6 + 0.4 * sm(a)}>
          <ringGeometry args={[7.4, 8.4, 40]} />
          <meshBasicMaterial color="#FFD23F" transparent opacity={sm(a)} depthWrite={false} toneMapped={false} />
        </mesh>
      );
    })}
  </>
);
const C_PORTA = { pos: [41, 112, 262] as V3, look: [41, 128, -12] as V3, fov: 52 };
const C_FAM = { pos: [84, 120, 445] as V3, look: [84, 112, -12] as V3, fov: 56 };
const FAM_X = 148;
function porta(t: number, comFamilia = false, aneis = 1) {
  const chega = prog(t, w("porta", "na"), w("porta", "inteira") + 0.3, (x) => x);
  const fx = mix(FAM_X + 150, FAM_X, sm(chega));
  const anda = chega > 0 && chega < 1 ? 1 : 0;
  const vira = prog(t, w("porta", "inteira") + 0.2, w("porta", "inteira") + 0.7);
  return (
    <>
      {quarto(t, { porta: portaRaioX(t) })}
      <Aneis t={t} vis={aneis} />
      {comFamilia ? (
        <group position={[fx, 0, 55]} rotation={[0, mix(-PI / 2, -0.12, vira), 0]}>
          <HumanoTranslucido t={t} position={[-34, 0, 0]} scale={HUMANO} andar={anda} />
          <HumanoTranslucido t={t + 0.3} position={[0, 0, 6]} scale={HUMANO * 0.93} cor="#A9D9FF" andar={anda} />
          <HumanoTranslucido t={t + 0.6} position={[31, 0, 10]} scale={HUMANO * 0.62} andar={anda} />
        </group>
      ) : null}
    </>
  );
}

// ---------- CONDOMÍNIO: ninho (rei, rainha, porteiro) e o porteiro tapando o túnel ----------
const NINHO = GAL_BAT.ramos[0].pts[0]; // ninho da colônia do batente (local)
const C_NINHO = BAT(NINHO.x + 0.3, 0, NINHO.z);
const RX_NINHO = { a: NINHO.x - 2.6, b: NINHO.x + 3.0, borda: 0.12 };
const Familia: React.FC<{ t: number; gal: Galerias; g?: number; mastigar?: number; barrigaRei?: number }> = ({ t, gal, g = 1, mastigar = 0, barrigaRei = 0 }) => {
  const q = (r: number, s: number) => naGaleria(gal, r, s, g);
  const qa = q(0, 0.75), qr = q(0, 1.75), qs = q(0, 2.8);
  return (
    <>
      <Bicho t={t} casta="rainha" position={qa.p} rotation={[0, qa.yaw, 0]} piso={pisoGaleria(qa.w, qa.r)} sombra={false} mastigar={mastigar} />
      <Bicho t={t + 1} casta="alado" semAsas position={qr.p} rotation={[0, qr.yaw + PI, 0]} cabeca={[0.2, 0]} piso={pisoGaleria(qr.w, qr.r)} sombra={false} barriga={barrigaRei} mastigar={mastigar} />
      <Bicho t={t + 2} casta="soldado" position={qs.p} rotation={[0, qs.yaw, 0]} piso={pisoGaleria(qs.w, qs.r)} sombra={false} />
      <CupimRamo gal={gal} ramo={1} s0={0.9} s1={2.6} t={t} v={0.18} fase={0.7} g={g} />
      <CupimRamo gal={gal} ramo={2} s0={0.3} s1={2.0} t={t} v={0.16} fase={2.1} g={g} />
      <CupimRamo gal={gal} ramo={0} s0={3.6} s1={5.2} t={t} v={0.16} fase={1.3} g={g} mastigar={0.5} />
    </>
  );
};
const ninhoMundo = (r: number, s: number) => {
  const q = naGaleria(GAL_BAT, r, s);
  return BAT(q.p[0], q.p[1], q.p[2]);
};
function ninho(t: number, abre = 1) {
  const rx = abre > 0.002 ? { a: NINHO.x + 0.3 - (NINHO.x + 0.3 - RX_NINHO.a) * abre, b: NINHO.x + 0.3 + (RX_NINHO.b - NINHO.x - 0.3) * abre, borda: 0.12 } : undefined;
  return quarto(t, { formigas: false, batente: { raioX: rx, children: <Familia t={t} gal={GAL_BAT} /> } });
}
const C_NIN_C = (() => { const q = naGaleria(GAL_BAT, 0, 1.75); return BAT(q.p[0], 0, q.p[2]); })();
const C_NIN_C2 = (() => { const q = naGaleria(GAL_BAT, 0, 1.25); return BAT(q.p[0], 0, q.p[2]); })();
const C_NIN = { pos: add(C_NIN_C2, [6.2, -0.3, 0.7]), look: add(C_NIN_C2, [0, 0.05, 0]), fov: 36 };

// porteiro: o túnel de saída (furinho de expulsão) em raio-x; o soldado sobe e tapa com a cabeça; a formiga chega e desiste
const FUR = GAL_BAT.furo;
const FURO_W = BAT(FUR.x, DB, FUR.z);
const T_TAPA = () => w("condominio", "tapa") - 0.35;
function porteiro(t: number) {
  const k = sm(prog(t, T_TAPA(), T_TAPA() + 0.7, (x) => x));
  // formiga: sobe pela face (cabeça para cima) até 0,25 cm do furo, cutuca a cabeça do soldado e volta para baixo
  const tChega = w("condominio", "cabeca") - 0.2;
  const sobe = prog(t, w("condominio", "formiga") - 0.3, tChega, (x) => x);
  const tVolta = w("condominio", "cabeca") + 0.35;
  const volta = prog(t, tVolta, tVolta + 0.6);
  const desce = Math.max(0, t - (tVolta + 0.5)) * 0.32;
  const yA = mix(-1.25, -0.28, sobe) - desce;
  const ang = PI * sm(volta);
  const rotA = noPlano([1, 0, 0], [0, Math.cos(ang), Math.sin(ang) * 0.0001 - Math.sin(ang) * 0]);
  const dirY = Math.cos(ang);
  const formiga = (
    <Formiga
      t={t}
      position={[FURO_W[0] + 0.03, FURO_W[1] + yA, FURO_W[2] + 0.06 + 0.12 * Math.sin(ang)]}
      rotation={noPlano([1, 0, 0], [0, dirY, Math.sin(ang)])}
      dist={(sobe * 0.97 + desce) / MM}
      cabeca={t > tChega && t < tVolta ? 0.35 * Math.sin((t - tChega) * 5) : 0}
      sombra={false}
    />
  );
  void rotA;
  return (
    <>
      {quarto(t, {
        formigas: false,
        batente: {
          raioX: { a: FUR.x - 0.55, b: FUR.x + 0.55, borda: 0.04 },
          furoTampado: k > 0.97,
          children: <Bicho t={t} casta="soldado" position={[FUR.x, DB - 0.24 - (1 - k) * 0.55, FUR.z]} rotation={[-PI / 2, 0, 0]} andar={k > 0.02 && k < 0.98 ? 1 : 0} dist={k * 5.5} sombra={false} antenas={0.4} />,
        },
      })}
      {formiga}
    </>
  );
}
const C_PORT = { pos: add(FURO_W, [1.35, -0.5, 2.75]), look: add(FURO_W, [-0.22, -0.15, 0]), fov: 32 };

// ======================= MOTEL =======================
// aleluias: entram voando de fora do quadro e passam a orbitar a lâmpada (≤ 0,4 volta/s, 9–21 cm do bulbo)
const N_AL = 16;
const alOrb = (t: number, i: number): V3 => {
  const r = 9 + rnd(i, 71) * 12, wv = (0.2 + rnd(i, 72) * 0.18) * 2 * PI * (i % 2 ? 1 : -1);
  const a = rnd(i, 73) * 6.28 + t * wv;
  const yy = (rnd(i, 74) - 0.5) * 14 + Math.sin(t * 0.7 + i) * 3;
  return [LAMPADA[0] + Math.cos(a) * r, LAMPADA[1] + yy, LAMPADA[2] + Math.sin(a) * r];
};
const alIni = (i: number): V3 => {
  const a = rnd(i, 75) * 6.28, e = (rnd(i, 76) - 0.6) * 0.9;
  return [LAMPADA[0] + Math.cos(a) * 110, LAMPADA[1] + Math.sin(e) * 70 - 10, LAMPADA[2] + Math.sin(a) * 110];
};
const alPos = (t: number, i: number, t0: number): V3 | null => {
  const ti = t0 + i * 0.1;
  if (t < ti) return null;
  const k = prog(t, ti, ti + 1.25, (x) => x);
  const o = alOrb(t, i);
  if (k >= 1) return o;
  const A = alIni(i), u = sm(k);
  const c: V3 = [(A[0] + o[0]) / 2, Math.max(A[1], o[1]) + 15, (A[2] + o[2]) / 2];
  const q = (x: number, y: number, z: number) => (1 - u) * (1 - u) * x + 2 * (1 - u) * u * y + u * u * z;
  return [q(A[0], c[0], o[0]), q(A[1], c[1], o[1]), q(A[2], c[2], o[2])];
};
const Aleluias: React.FC<{ t: number; t0: number; sem?: number[] }> = ({ t, t0, sem = [] }) => (
  <>
    {Array.from({ length: N_AL }, (_, i) => {
      if (sem.includes(i)) return null;
      const p = alPos(t, i, t0), p2 = alPos(t + 0.04, i, t0);
      if (!p || !p2) return null;
      return <Bicho key={i} t={t + i * 0.37} casta="alado" voar={1} bater={0.9} position={p} rotation={[0.2, Math.atan2(p2[0] - p[0], p2[2] - p[2]), 0]} escala={2.0} sombra={false} />;
    })}
  </>
);
const T_AL1 = () => w("motel", "como") + 0.35;
const T_AL2 = () => w("virada", "chama") + 0.05;
const C_LAMP = { pos: add(LAMPADA, [20, -24, 30]), look: add(LAMPADA, [0, 7, 0]), fov: 42 };
function lampada(t: number, t0: number) {
  return (
    <>
      {quarto(t)}
      <Aleluias t={t} t0={t0} />
    </>
  );
}
// close de uma aleluia pairando perto da câmera (lâmpada atrás); em "procurando casa" ela desce e sai do quadro
const C_AL = { pos: add(LAMPADA, [30, -22, 34]), look: add(LAMPADA, [0, -6, 0]), fov: 34 };
function aleluiaClose(t: number) {
  const d = new THREE.Vector3(...C_AL.look).sub(new THREE.Vector3(...C_AL.pos)).normalize();
  const base = new THREE.Vector3(...C_AL.pos).addScaledVector(d, 7.5).add(new THREE.Vector3(0, -1.0, 0));
  const sai = prog(t, w("motel", "procurando"), w("motel", "pousam") + 0.2, (x) => x * x);
  const p: V3 = [base.x + Math.sin(t * 1.1) * 0.6 + sai * 9, base.y + Math.sin(t * 1.7) * 0.4 - sai * 16, base.z + Math.cos(t * 0.9) * 0.4];
  return (
    <>
      {quarto(t)}
      <Aleluias t={t} t0={T_AL1()} />
      <Bicho t={t} casta="alado" voar={1} position={p} rotation={[0.35 + sai * 0.5, 0.9, 0.15]} bater={0.55} escala={1.5} sombra={false} />
    </>
  );
}
// casal: pousa ao lado do furo de prego, solta as asas, entra (em fila) e tapa o furo por dentro
const quatYX = (pitch: number, yaw: number): V3 => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  return new THREE.Euler().setFromQuaternion(q, "XYZ").toArray().slice(0, 3) as V3;
};
const POUSO = [{ x: PREGO.x + 1.05, z: PREGO.z + 0.3 }, { x: PREGO.x + 1.75, z: PREGO.z - 0.25 }];
const T_POUSA = () => w("motel", "pousam") - 0.15;
const T_SOLTA0 = () => w("motel", "largam");
const T_ENTRA = () => w("motel", "entram") - 0.1;
const V_CASAL = 0.42; // cm/s (≈ 1 passada de 2 mm a cada 0,5 s… passada ≤ 2 Hz)
// posição de um bicho do casal no caminho: face → furo → poço → câmara; s = cm andados desde T_ENTRA
const POCO = DB; // profundidade do poço do furo de prego até a câmara (meio da peça)
const casalPose = (i: number, s: number, g: number): { p: V3; r: V3 } => {
  const P0 = POUSO[i];
  const dx = PREGO.x - P0.x, dz = PREGO.z - P0.z;
  const La = Math.hypot(dx, dz);
  const yaw0 = Math.atan2(dx, dz);
  if (s < La) return { p: [P0.x + (dx * s) / La, DB, P0.z + (dz * s) / La], r: [0, yaw0, 0] };
  const sb = s - La;
  if (sb < POCO) {
    const pitch = (PI / 2) * sm(clamp01(sb / 0.18));
    return { p: [PREGO.x, DB - sb, PREGO.z], r: quatYX(pitch, yaw0) };
  }
  const q = naGaleria(GAL_MOTEL, i, Math.min(0.3 + (sb - POCO), i === 0 ? 0.55 : 0.4), g);
  const k = sm(clamp01((sb - POCO) / 0.25));
  return { p: mixV([PREGO.x, 0, PREGO.z], q.p, k), r: quatYX((PI / 2) * (1 - k), yaw0 + (q.yaw - yaw0) * k) };
};
// o 2º (o que fica em cima) para com a ponta do abdômen no furo e tapa por dentro; depois desce para a câmara
const S_PARA = () => Math.hypot(PREGO.x - POUSO[1].x, PREGO.z - POUSO[1].z) + 0.36;
const T_DESCE = () => w("motel", "esse") + 0.2;
const sCasal = (t: number, i: number) => {
  const s = Math.max(0, t - T_ENTRA() - i * 0.7) * V_CASAL;
  if (i === 0) return s;
  return Math.min(s, S_PARA()) + Math.max(0, t - T_DESCE()) * V_CASAL;
};
const tampaPrego = (t: number) => prog(t, w("motel", "tapam"), w("motel", "intestino") + 0.4);
const matPoco = new THREE.MeshStandardMaterial({ color: "#7A4E2E", roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color("#3A2010"), emissiveIntensity: 0.35 });
const matCola = new THREE.MeshStandardMaterial({ color: "#5E3A1E", roughness: 0.6 });
const Casal: React.FC<{ t: number; g: number; barriga?: number; mastigar?: number }> = ({ t, g, barriga = 0, mastigar = 0 }) => {
  const pousa = (i: number) => prog(t, T_POUSA() + i * 0.25, T_POUSA() + 0.75 + i * 0.25);
  const solta = (i: number) => prog(t, T_SOLTA0() + i * 0.2, T_SOLTA0() + 0.9 + i * 0.2);
  const tp = tampaPrego(t);
  return (
    <>
      {[0, 1].map((i) => {
        const pz = pousa(i);
        if (t < T_ENTRA()) {
          const P0 = POUSO[i];
          const yaw0 = Math.atan2(PREGO.x - P0.x, PREGO.z - P0.z);
          const voo = 1 - sm(pz);
          return <Bicho key={i} t={t + i} casta="alado" voar={voo} bater={voo} soltarAsas={solta(i)} position={[P0.x + voo * 3.4, DB + voo * 1.2, P0.z + voo * (i ? -1 : 1) * 0.9]} rotation={[0, yaw0, 0]} sombra={false} />;
        }
        const s = sCasal(t, i);
        const q = casalPose(i, s, g);
        const anda = i === 1 && t < T_DESCE() && s >= S_PARA() - 1e-3 ? 0 : 1;
        return <Bicho key={i} t={t + i} casta="alado" semAsas position={q.p} rotation={q.r} andar={anda} dist={s / MM} sombra={false} barriga={barriga} mastigar={mastigar} />;
      })}
      {/* asas largadas ficam no lugar do pouso */}
      {t >= T_ENTRA() ? POUSO.map((P0, i) => <Bicho key={"as" + i} t={t} casta="alado" soAsas soltarAsas={1} position={[P0.x, DB, P0.z]} rotation={[0, Math.atan2(PREGO.x - P0.x, PREGO.z - P0.z), 0]} sombra={false} />) : null}
      <FuroPrego position={[PREGO.x, DB, PREGO.z]} rotation={[0, 0, 0]} tampar={tp} />
      {tp > 0.001 ? (
        <mesh position={[PREGO.x, DB - 0.06, PREGO.z]} material={matCola} scale={[1, 0.6 * tp + 0.01, 1]}>
          <cylinderGeometry args={[0.105, 0.105, 0.1, 18]} />
        </mesh>
      ) : null}
    </>
  );
};
const RX_PREGO = (k = 1) => (k > 0.002 ? { raioX: { a: PREGO.x - 1.2 * k, b: PREGO.x + 1.2 * k, borda: 0.06 } } : {});
function motel(t: number, rx = 0, gFix?: number) {
  const g = gFix ?? idadeMotel(t);
  return quarto(t, {
    batente: {
      gal: GAL_BAT_MOTEL,
      g,
      ...RX_PREGO(rx),
      children: (
        <>
          <Casal t={t} g={g} />
          {rx > 0.002 ? (
            <mesh position={[PREGO.x, POCO / 2, PREGO.z]} material={matPoco}>
              <cylinderGeometry args={[0.11, 0.11, POCO, 18, 1, true]} />
            </mesh>
          ) : null}
        </>
      ),
    },
  });
}
const C_PRG = BAT(PREGO.x, DB, PREGO.z);
const C_POUSO = { pos: add(C_PRG, [5.4, 0.5, 0.9]), look: add(C_PRG, [0, 0.95, 0]), fov: 36 };
const C_TAPA = { pos: add(C_PRG, [2.3, 2.1, 0.9]), look: add(C_PRG, [-0.85, 0.05, 0]), fov: 36 };
// ======================= MARMITEX =======================
// câmara (local da peça) e bichos na câmara
const S_PAI_G = 1.5;
const camaraM = (i: number, g: number) => naGaleria(GAL_MOTEL, i, i === 0 ? 0.55 : 0.4, g);
function camara(t: number, opts: { barriga?: number; filhote?: boolean } = {}) {
  const g = idadeMotel(t);
  const pai = naGaleria(GAL_MOTEL, 0, 0.75, g);
  const mae = naGaleria(GAL_MOTEL, 1, 0.45, g);
  const yawP = pai.yaw + PI; // o pai olha para o ninho; a ponta do abdômen fica para +s (o filhote chega por ali)
  const kG = prog(t, w("marmitex", "golinho") - 0.2, w("marmitex", "bumbum") + 0.3);
  // golinho: pai mais adiante no ramo 0 (trecho reto), olhando para o ninho; o filhote chega pela galeria e encosta a boca na ponta do abdômen
  const paiG = opts.filhote ? naGaleria(GAL_MOTEL, 0, S_PAI_G, g) : pai;
  const Ry = new THREE.Euler(0, opts.filhote ? paiG.yaw + PI : yawP, 0);
  const PP = new THREE.Vector3(...paiG.p);
  const chega = prog(t, w("marmitex", "o", 1) - 0.1, w("marmitex", "golinho") - 0.25, (x) => x);
  const sF = S_PAI_G + 0.62 + 1.0 * (1 - chega);
  const fq = naGaleria(GAL_MOTEL, 0, sF, g);
  const fil = { p: fq.p, yaw: fq.yaw + PI };
  const ponta = new THREE.Vector3(0, 0.06, -0.33).applyEuler(Ry).add(PP);
  const boca = new THREE.Vector3(0, 0.045, 0.14).applyEuler(new THREE.Euler(0, fil.yaw, 0)).add(new THREE.Vector3(...fil.p));
  const gp = ponta.clone().lerp(boca, kG);
  const gota = opts.filhote && kG > 0.001 && kG < 0.999;
  return quarto(t, {
    batente: {
      gal: GAL_BAT_MOTEL,
      g,
      raioX: { a: PREGO.x - 1.2, b: PREGO.x + 3.4, borda: 0.06 },
      furo: true,
      children: (
        <>
          <FuroPrego position={[PREGO.x, DB, PREGO.z]} rotation={[0, 0, 0]} tampar={1} />
          <mesh position={[PREGO.x, POCO / 2, PREGO.z]} material={matPoco}>
            <cylinderGeometry args={[0.11, 0.11, POCO, 18, 1, true]} />
          </mesh>
          <mesh position={[PREGO.x, DB - 0.06, PREGO.z]} material={matCola} scale={[1, 0.61, 1]}>
            <cylinderGeometry args={[0.105, 0.105, 0.1, 18]} />
          </mesh>
          <Bicho t={t} casta="alado" semAsas position={paiG.p} rotation={[0, opts.filhote ? paiG.yaw + PI : yawP, 0]} piso={pisoGaleria(paiG.w, paiG.r)} sombra={false} barriga={opts.barriga ?? 0} mastigar={opts.filhote ? 0 : 0.5} />
          {opts.filhote ? null : <Bicho t={t + 1} casta="alado" semAsas position={mae.p} rotation={[0, mae.yaw, 0]} piso={pisoGaleria(mae.w, mae.r)} sombra={false} mastigar={0.6} />}
          {opts.filhote ? (
            <>
              <Bicho t={t} casta="operario" escala={0.55} position={fil.p} rotation={[0, fil.yaw, 0]} andar={chega < 1 ? 1 : 0} dist={(S_PAI_G + 1.62 - sF) / MM / 0.55} barriga={prog(t, w("marmitex", "bumbum") + 0.1, w("marmitex", "pais") + 0.2)} sombra={false} />
              {gota ? (
                <>
                  <mesh position={gp.toArray()} scale={0.022 * (1 - 0.5 * kG)}>
                    <sphereGeometry args={[1, 20, 14]} />
                    <meshStandardMaterial color="#E8C890" transparent opacity={0.8} roughness={0.15} depthWrite={false} />
                  </mesh>
                  {[0, 1, 2].map((i) => (
                    <mesh key={i} position={gp.clone().add(new THREE.Vector3(Math.cos(i * 2.1 + t) * 0.008, 0.004 * i - 0.004, Math.sin(i * 2.1 + t) * 0.008)).toArray()} scale={[0.004, 0.004, 0.01]}>
                      <sphereGeometry args={[1, 10, 8]} />
                      <meshStandardMaterial color={["#3FD6C6", "#7FE36B", "#B98BFF"][i]} emissive={["#3FD6C6", "#7FE36B", "#B98BFF"][i]} emissiveIntensity={0.5} />
                    </mesh>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ),
    },
  });
}
const camaraMundo = (i: number, s: number, g = 0.16) => {
  const q = naGaleria(GAL_MOTEL, i, s, g);
  return BAT(q.p[0], q.p[1], q.p[2]);
};
const C_CAM_C = camaraMundo(0, 0.9);
const C_CAMARA = { pos: add(C_CAM_C, [3.4, -0.5, 1.2]), look: add(C_CAM_C, [0, 0, 0.1]), fov: 36 };
const C_BARRIGA = (() => {
  const c = camaraMundo(0, 1.05);
  return { pos: add(c, [2.7, -0.5, 0.9]), look: add(c, [0, 0.02, 0]), fov: 30 };
})();
const C_GOLE = (() => {
  const q = naGaleria(GAL_MOTEL, 0, 1.5 + 0.25, 0.26);
  const c = BAT(q.p[0], q.p[1], q.p[2]);
  return { pos: add(c, [3.0, -0.55, 1.0]), look: add(c, [0, 0.02, 0]), fov: 30 };
})();
// a madeira vira comida: operário arranca uma fibra da frente da galeria (g fixo no plano)
const G_COMIDA = 0.3;
const RAMO_C = 0;
const frenteC = (() => {
  const R = GAL_MOTEL.ramos[RAMO_C];
  const sF = Math.min(R.len, (G_COMIDA - R.g0) * R.vel);
  return { sF, qF: naGaleria(GAL_MOTEL, RAMO_C, sF - 0.02, G_COMIDA) };
})();
function comida(t: number, t0: number) {
  const tl = t - t0;
  const { sF, qF } = frenteC;
  const puxa = prog(tl, 0.3, 1.2, (x) => x);
  const recua = 0.06 * puxa;
  const sB = sF - 0.44 - recua;
  const qB = naGaleria(GAL_MOTEL, RAMO_C, sB, G_COMIDA);
  const rot = new THREE.Euler(0, qB.yaw, 0);
  const ponta = new THREE.Vector3(0, 0.09, 0.2).applyEuler(rot).add(new THREE.Vector3(...qB.p));
  const dF = new THREE.Vector3(Math.sin(qB.yaw), 0, Math.cos(qB.yaw));
  const B: V3 = [qF.p[0] + dF.x * 0.12, qF.p[1] + 0.09, qF.p[2] + dF.z * 0.12];
  return quarto(t, {
    batente: {
      gal: GAL_BAT_MOTEL,
      g: G_COMIDA,
      raioX: { a: qF.p[0] - 1.4, b: qF.p[0] + 1.4, borda: 0.06 },
      children: (
        <>
          <Bicho t={t} position={qB.p} rotation={[0, qB.yaw, 0]} piso={pisoGaleria(qB.w, qB.r)} mastigar={tl < 0.3 || tl > 1.4 ? 1 : 0} mandibula={tl >= 0.3 && tl <= 1.4 ? 0.1 : 0} empurrar={0.4} andar={1} dist={-recua / MM} cabeca={[0, 0.15]} sombra={false} />
          <FibraSoltando B={B} dir={[-dF.x, 0, -dF.z]} L={0.3} alvo={ponta.toArray() as V3} puxar={0.25 + puxa * 0.75} comer={prog(tl, 1.4, 2.0, (x) => x)} frente={dF.toArray() as V3} />
          <FrenteMastigacao c={[qF.p[0] + dF.x * 0.06, qF.p[1] + 0.12, qF.p[2] + dF.z * 0.06]} n={[-dF.x, 0, -dF.z]} dir={[-dF.x, 0, -dF.z]} tam={[0.45, 0.25]} />
        </>
      ),
    },
  });
}
const C_COMIDA = (() => {
  const { qF } = frenteC;
  const qB = naGaleria(GAL_MOTEL, RAMO_C, frenteC.sF - 0.4, G_COMIDA);
  const c = BAT((qF.p[0] + qB.p[0]) / 2, 0, (qF.p[2] + qB.p[2]) / 2);
  return { pos: add(c, [1.6, -0.35, 0.6]), look: add(c, [0, 0.02, 0]), fov: 36 };
})();
// colônia crescendo (tempo acelerado): vários operários comendo nas pontas das galerias
const Colonia: React.FC<{ t: number; g: number; gal: Galerias; n?: number }> = ({ t, g, gal, n = 9 }) => (
  <>
    {gal.ramos.slice(0, n).map((R, i) => {
      const fr = Math.min(R.len, (g - R.g0) * R.vel);
      if (fr < 0.8) return null;
      return <CupimRamo key={i} gal={gal} ramo={i} s0={0.25} s1={fr - 0.35} t={t} v={0.16 + 0.02 * (i % 3)} fase={i * 1.3} g={g} mastigar={i % 2 ? 0.7 : 0} />;
    })}
  </>
);
function marmitex(t: number, gFix?: number) {
  const g = gFix ?? idadeMotel(t);
  return quarto(t, {
    batente: {
      gal: GAL_BAT_MOTEL,
      g,
      raioX: { a: GAL_MOTEL.x0 - 0.5, b: GAL_MOTEL.x1 + 0.5, borda: 0.12 },
      children: (
        <>
          <FuroPrego position={[PREGO.x, DB, PREGO.z]} rotation={[0, 0, 0]} tampar={1} />
          <Colonia t={t} g={g} gal={GAL_MOTEL} n={14} />
          <Bicho t={t} casta="alado" semAsas position={naGaleria(GAL_MOTEL, 0, 0.75, g).p} rotation={[0, naGaleria(GAL_MOTEL, 0, 0.75, g).yaw + PI, 0]} sombra={false} />
          <Bicho t={t + 1} casta="alado" semAsas position={naGaleria(GAL_MOTEL, 1, 0.45, g).p} rotation={[0, naGaleria(GAL_MOTEL, 1, 0.45, g).yaw, 0]} sombra={false} />
        </>
      ),
    },
  });
}
const C_MARMI = (() => {
  const c = BAT((GAL_MOTEL.x0 + GAL_MOTEL.x1) / 2 + 0.5, 0, 0);
  return { pos: add(c, [17, -1, 3]), look: add(c, [0, 0, -0.6]), fov: 44 };
})();

// ======================= SALEIRO =======================
const FGR = FURO_GR();
const MGR = MONTE_GR();
// grãos caindo do furinho do guarda-roupa (fluxo contínuo; cada grão sai, cai e some dentro do montinho)
const GraosCaindo: React.FC<{ t: number; t0: number; per?: number; n?: number }> = ({ t, t0, per = 0.45, n = 6 }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const u = t - t0 - i * per;
      if (u < 0) return null;
      const ciclo = per * n;
      const uu = u % ciclo;
      const q = quedaGrao(uu - 0.05, FGR, [1, 0, 0], 0.62, 3, i);
      if (q.parado && uu > 2.2) return null;
      return <Grao key={i} position={q.p} rotation={q.rot} />;
    })}
  </>
);
const C_PO = { pos: add(MGR, [11, 6.5, 17]), look: add(MGR, [-2.5, 3.5, -1]), fov: 40 };
const C_MONTE = { pos: add(MGR, [4.2, 2.6, 4.4]), look: add(MGR, [0, 0.35, 0]), fov: 36 };
// grão herói deitado no piso ao lado do montinho; a câmera gira devagar até ver a ponta (6 faces)
const GRAO_H: V3 = add(MGR, [1.9, 0.0, 1.6]);
const camGrao = (t: number) => {
  const a = mix(0.25, 1.45, sm(prog(t, w("saleiro", "cada"), w("saleiro", "lados") + 0.4)));
  const R = 0.42;
  return { pos: [GRAO_H[0] + Math.sin(a) * R, GRAO_H[1] + 0.16, GRAO_H[2] + Math.cos(a) * R] as V3, look: [GRAO_H[0], GRAO_H[1] + 0.025, GRAO_H[2]] as V3 };
};
function graoHeroi(t: number) {
  return (
    <>
      {quarto(t, { formigas: false })}
      <Grao position={[GRAO_H[0], GRAO_H[1] + GRAO_R_Y, GRAO_H[2]]} rotation={[0, PI / 2, PI / 2]} det={2} />
    </>
  );
}
const GRAO_R_Y = 0.026;
// o operário empurra o grão até o furinho (raio-x no guarda-roupa) e o grão sai
const FGRL = GAL_GR.furo;
const T_EMPURRA = () => w("saleiro", "e", 3) - 0.2;
function empurra(t: number) {
  const tl = t - T_EMPURRA();
  const s = FGRL.s - 0.9 + prog(tl, 0, 0.9, (x) => x) * 0.62;
  const q = naGaleria(GAL_GR, FGRL.ramo, s);
  const pp = new THREE.Vector3(0, 0, 0.2).applyEuler(new THREE.Euler(0, q.yaw, 0)).add(new THREE.Vector3(...q.p));
  const sobe = prog(tl, 0.9, 1.25, (x) => x); // o grão sobe pelo poço do furo
  const fora = tl > 1.25;
  const gp: V3 = [mix(pp.x, FGRL.x, sobe), mix(q.p[1] + 0.03, 0.9, sobe), mix(pp.z, FGRL.z, sobe)];
  const qd = quedaGrao(tl - 1.25, FGR, [1, 0, 0], 0.62, 3, 1);
  return (
    <>
      {quarto(t, {
        guardaRoupa: {
          raioX: { a: FGRL.x - 1.1, b: FGRL.x + 1.1, borda: 0.05 },
          children: (
            <>
              <Bicho t={t} position={q.p} rotation={[0, q.yaw, 0]} piso={pisoGaleria(q.w, q.r)} andar={tl < 0.9 ? 1 : 0} dist={s / MM} empurrar={1} sombra={false} />
              {!fora ? <Grao position={gp} rotation={[0, q.yaw + PI / 2, sobe * PI / 2]} sombra={false} /> : null}
            </>
          ),
        },
      })}
      {fora ? <Grao position={qd.p} rotation={qd.rot} /> : null}
    </>
  );
}
const C_EMP = { pos: add(FGR, [1.9, -0.75, 1.5]), look: add(FGR, [-0.45, -0.25, 0]), fov: 34 };
const C_SAL = { pos: add(FGR, [3.2, -0.6, 2.3]), look: add(FGR, [0.3, -0.55, 0]), fov: 36 };
function saleiro(t: number, t0: number) {
  return (
    <>
      {quarto(t)}
      <GraosCaindo t={t} t0={t0} per={0.09} n={24} />
    </>
  );
}

// ======================= INQUILINO =======================
// aleluias saindo do furinho do guarda-roupa: a cabeça aparece, o corpo sai, abre as asas e voa para a lâmpada
const SaidaAleluias: React.FC<{ t: number; t0: number; n?: number; dt?: number; ateLampada?: boolean; escala?: number }> = ({ t, t0, n = 4, dt = 0.75, ateLampada = false, escala = 1.8 }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const u = t - t0 - i * dt;
      if (u < 0) return null;
      const out = Math.min(u * 0.9 * escala, 0.75 * escala);
      const voo = Math.max(0, u - 0.8);
      let p: V3 = [FGR[0] + out + voo * 9, FGR[1] + voo * voo * 9 + i * 0.25, FGR[2] + voo * 5 * (i - 1.5)];
      if (ateLampada) {
        const k = prog(u, 1.0, 3.2, (x) => x);
        const o = alOrb(t, i + 3);
        p = mixV(p, o, sm(k));
      }
      const p2: V3 = [p[0] + 0.01, p[1], p[2]];
      void p2;
      const bt = prog(u, 0.6, 0.9);
      return <Bicho key={i} t={t + i * 0.4} casta="alado" voar={bt} bater={bt * 0.7} position={p} rotation={[voo > 0 ? 0.25 : 0, PI / 2, 0]} escala={escala} sombra={false} />;
    })}
  </>
);
const T_SAI = () => S("inquilino") + 0.15;
const C_SAI = { pos: add(FGR, [5.2, 1.4, 4.2]), look: add(FGR, [1.4, 1.0, 0]), fov: 34 };
// tempo acelerado: as galerias tomam a lateral do guarda-roupa (raio-x) em 5 "anos"
const GR_C = grParaMundo([49, 0, 0]);
const C_5A = { pos: add(GR_C, [44, -2, 10]), look: add(GR_C, [0, 0, 0]), fov: 50 };
function cincoAnos(t: number) {
  const g = idadeGR(t);
  return quarto(t, { guardaRoupa: { g, raioX: { a: 14, b: 84, borda: 0.4 }, children: <Colonia t={t} g={g} gal={GAL_GR} n={16} /> } });
}
const C_INQ = { pos: [16, 72, 78] as V3, look: [-22, 60, 30] as V3, fov: 46 };
function inquilino(t: number) {
  return (
    <>
      {quarto(t)}
      <SaidaAleluias t={t} t0={w("inquilino", "tem") - 0.4} n={6} dt={0.5} />
    </>
  );
}

// ======================= TAMBOR =======================
const RX_BAT = { a: 34, b: 58, borda: 0.25 };
const PopBat: React.FC<{ t: number }> = ({ t }) => (
  <>
    {[0, 2, 3, 5, 7, 16, 18, 23].map((r, i) => {
      const R = GAL_BAT.ramos[r];
      return <CupimRamo key={i} gal={GAL_BAT} ramo={r} s0={0.3} s1={R.len - 0.3} t={t} v={0.18} fase={i * 1.7} mastigar={i % 2 ? 0.6 : 0} />;
    })}
  </>
);
const C_BATX = { pos: add(BAT(46, DB, -0.5), [15, -1, 5]), look: BAT(46, 0, -0.5), fov: 40 };
const C_GRX = { pos: add(grParaMundo([44, 0.9, 0]), [15, -1, 6]), look: grParaMundo([44, 0, 0]), fov: 40 };
const VG_C = vigaParaMundo([150, 0, 0]);
const C_VIGA = { pos: add(VG_C, [6, -26, 22]), look: add(VG_C, [0, 0, 0]), fov: 42 };
// "come batente, guarda-roupa, forro e viga": quarto inteiro, o raio-x acende em cada peça na hora da palavra
const C_COME = { pos: [270, 125, 290] as V3, look: [-20, 150, 60] as V3, fov: 58 };
const acende = (t: number, palavra: string) => prog(t, w("tambor", palavra) - 0.1, w("tambor", palavra) + 0.35);
function comeTudo(t: number) {
  const kb = acende(t, "batente"), kg = acende(t, "guarda-roupa"), kv = acende(t, "forro");
  const faixa = (a: number, b: number, k: number) => (k > 0.002 ? { raioX: { a: mix((a + b) / 2, a, k), b: mix((a + b) / 2, b, k), borda: 1.2 } } : {});
  return quarto(t, {
    batente: { ...faixa(26, 64, kb) },
    guardaRoupa: { ...faixa(12, 86, kg) },
    viga: { ...faixa(105, 190, kv) },
  });
}
// batida: punho azul (nós dos dedos) na face do batente; 2 batidas (nas palavras "Bate" e "oco")
const BATIDA = { x: 52.5, z: -1.6 };
const C_BATIDA = BAT(BATIDA.x, DB, BATIDA.z);
const T_BATIDAS = () => [w("tambor", "bate"), w("tambor", "oco")];
const afastaPunho = (t: number) => {
  let d = 1;
  for (const tk of T_BATIDAS()) {
    const ida = prog(t, tk - 0.22, tk, (x) => x * x);
    const volta = prog(t, tk + 0.02, tk + 0.4);
    d = Math.min(d, t < tk ? 1 - ida : volta);
  }
  return d;
};
function batida(t: number, rx = 0) {
  const ROT: V3 = [0, -PI / 2, PI / 2];
  const nd = new THREE.Vector3(...NOS_DEDOS).applyEuler(new THREE.Euler(...ROT));
  const x = C_BATIDA[0] + 0.12 + afastaPunho(t) * 8;
  return (
    <>
      {quarto(t, { batente: rx > 0.002 ? { raioX: { a: BATIDA.x - 9 * rx, b: BATIDA.x + 6 * rx, borda: 0.3 }, children: <PopBat t={t} /> } : {} })}
      <MaoAzul fechar={1} polegar={0} position={[x - nd.x, C_BATIDA[1] - nd.y, C_BATIDA[2] - nd.z]} rotation={ROT} />
    </>
  );
}
const C_BAT = { pos: add(C_BATIDA, [44, 2, 36]), look: add(C_BATIDA, [4, -2, 0]), fov: 40 };
const C_BAT2 = { pos: add(C_BATIDA, [20, -3, 12]), look: add(C_BATIDA, [0, -4, 0]), fov: 40 };

// ======================= VIRADA =======================
const PAI: V3 = [92, 0, 95];
function umidade(t: number) {
  const aponta = prog(t, w("virada", "culpa") - 0.2, w("virada", "culpa") + 0.3);
  return (
    <>
      {quarto(t)}
      <HumanoAzul t={t} position={PAI} rotation={[0, -PI / 2 - 0.35, 0]} escala={HUMANO} bracoD={{ ombro: [mix(0.1, PI / 2 - 0.15, aponta), 0, 0.1], cotovelo: 0.05 }} cabeca={[0, 0]} />
    </>
  );
}
const C_UMI = { pos: [150, 130, 330] as V3, look: [45, 110, 20] as V3, fov: 48 };
// água da própria madeira: operário mastigando na ponta de uma galeria do batente, uma gotinha brota da fibra
const RAMO_A = 3;
const aguaF = (() => {
  const R = GAL_BAT.ramos[RAMO_A];
  const sF = R.len;
  return { sF, qF: naGaleria(GAL_BAT, RAMO_A, sF - 0.02) };
})();
function agua(t: number) {
  const { sF, qF } = aguaF;
  const qB = naGaleria(GAL_BAT, RAMO_A, sF - 0.44);
  const dF = new THREE.Vector3(Math.sin(qB.yaw), 0, Math.cos(qB.yaw));
  const ponta = new THREE.Vector3(0, 0.09, 0.2).applyEuler(new THREE.Euler(0, qB.yaw, 0)).add(new THREE.Vector3(...qB.p));
  const B: V3 = [qF.p[0] + dF.x * 0.12, qF.p[1] + 0.09, qF.p[2] + dF.z * 0.12];
  // gotinhas: brotam na lasca mastigada (B) e escorrem até a boca, uma a cada 0,8 s
  const gotas = [0, 1, 2].map((i) => {
    const u = t - (w("virada", "tira") - 0.2) - i * 0.9;
    if (u < 0 || u > 1.0) return null;
    const cresce = sm(clamp01(u / 0.35)), vai = sm(clamp01((u - 0.35) / 0.5)), some = clamp01((u - 0.85) / 0.15);
    const pB = new THREE.Vector3(...B).add(new THREE.Vector3(0, 0.03, 0));
    const pos = pB.clone().lerp(ponta.clone().add(new THREE.Vector3(0, 0.02, 0)), vai);
    return { pos, r: 0.045 * cresce * (1 - some) };
  });
  return quarto(t, {
    batente: {
      raioX: { a: qF.p[0] - 1.3, b: qF.p[0] + 1.3, borda: 0.06 },
      children: (
        <>
          <Bicho t={t} position={qB.p} rotation={[0, qB.yaw, 0]} piso={pisoGaleria(qB.w, qB.r)} mastigar={1} cabeca={[0, 0.15]} sombra={false} />
          <FibraSoltando B={B} dir={[-dF.x, 0, -dF.z]} L={0.3} alvo={ponta.toArray() as V3} puxar={0.3} frente={dF.toArray() as V3} />
          <FrenteMastigacao c={[qF.p[0] + dF.x * 0.06, qF.p[1] + 0.12, qF.p[2] + dF.z * 0.06]} n={[-dF.x, 0, -dF.z]} dir={[-dF.x, 0, -dF.z]} tam={[0.45, 0.25]} />
          {gotas.map((g, i) =>
            g && g.r > 0.001 ? (
              <mesh key={i} position={g.pos.toArray()} scale={g.r}>
                <sphereGeometry args={[1, 24, 16]} />
                <meshStandardMaterial color="#7FD0FF" roughness={0.05} metalness={0.1} emissive="#2E9BF0" emissiveIntensity={0.9} />
              </mesh>
            ) : null,
          )}
        </>
      ),
    },
  });
}
const C_AGUA = (() => {
  const { qF } = aguaF;
  const qB = naGaleria(GAL_BAT, RAMO_A, aguaF.sF - 0.4);
  const c = BAT((qF.p[0] + qB.p[0]) / 2, 0, (qF.p[2] + qB.p[2]) / 2);
  return { pos: add(c, [1.6, -0.35, 0.6]), look: add(c, [0, 0.02, 0]), fov: 36 };
})();
// nem encosta na terra: a câmera desce pelo batente em raio-x até o piso (as galerias acabam dentro da madeira)
function semTerra(t: number) {
  return quarto(t, { batente: { raioX: { a: -1, b: 62, borda: 0.4 }, children: <PopBat t={t} /> } });
}
// móvel usado entrando pela porta
function movel(t: number) {
  const t0 = w("virada", "ou") - 0.2;
  const abre = prog(t, t0, t0 + 0.7);
  const z = -130 + prog(t, t0 + 0.4, S("final") + 0.2, (x) => x) * 175;
  return (
    <>
      {quarto(t, { porta: { abre } })}
      <Comoda position={[41, 0, z]} />
      <HumanoTranslucido t={t} position={[41, 0, z - 44]} scale={HUMANO} andar={1} />
    </>
  );
}
const C_MOVEL = { pos: [150, 155, 290] as V3, look: [40, 70, -20] as V3, fov: 48 };
const C_GERAL = { pos: [175, 140, 440] as V3, look: [-25, 125, 0] as V3, fov: 52 };

// ---------- planos ----------
export const PLANS: Plan[] = [
  // gancho
  P(0, w("porta", "numa"), { keys: fixa(C_G.pos, C_G.look, C_G.fov), near: 0.2, luz: { foco: C_DENTE, raio: 14 }, scene: (t) => gancho(t, t) }),
  // porta: 20 famílias (raio-x desce pela folha, anéis acendem)
  P(w("porta", "numa"), w("porta", "na"), { keys: mov(w("porta", "numa"), w("porta", "na"), add(C_PORTA.pos, [0, 0, 25]), C_PORTA.look, C_PORTA.pos, C_PORTA.look, C_PORTA.fov), near: 2, luz: { foco: [40, 100, 0], raio: 160 }, scene: (t) => porta(t) }),
  // 1 família: a sua
  P(w("porta", "na"), S("condominio"), { keys: fixa(C_FAM.pos, C_FAM.look, C_FAM.fov), near: 2, luz: { foco: [100, 100, 20], raio: 200 }, scene: (t) => porta(t, true) }),
  // por fora parece nova → por dentro (raio-x abre no ninho)
  // por fora, parece nova: a porta inteira (sem raio-x), aproximação lenta até o batente; corte direto para o raio-x
  P(S("condominio"), w("condominio", "dentro") - 0.35, { keys: mov(S("condominio"), w("condominio", "dentro") - 0.35, C_PORTA.pos, C_PORTA.look, [30, 92, 175], [22, 92, -10], C_PORTA.fov, 50), near: 1, luz: { foco: [40, 100, 0], raio: 160 }, scene: (t) => quarto(t, { formigas: false }) }),
  P(w("condominio", "dentro") - 0.35, w("condominio", "dentro"), { keys: fixa(add(C_NINHO, [16, -1, 4]), add(C_NINHO, [0, 0.2, 0]), 38), near: 0.5, luz: { foco: C_NINHO, raio: 40 }, scene: (t) => ninho(t, prog(t, w("condominio", "dentro") - 0.35, w("condominio", "dentro"))) }),
  P(w("condominio", "dentro"), w("condominio", "formiga") - 0.3, { keys: mov(w("condominio", "dentro"), w("condominio", "rei"), add(C_NINHO, [16, -1, 4]), add(C_NINHO, [0, 0.2, 0]), C_NIN.pos, C_NIN.look, 38, C_NIN.fov), near: 0.1, luz: { foco: C_NINHO, raio: 8 }, scene: (t) => ninho(t) }),
  // porteiro
  P(w("condominio", "formiga") - 0.3, w("condominio", "esse"), { keys: fixa(C_PORT.pos, C_PORT.look, C_PORT.fov), near: 0.05, luz: { foco: FURO_W, raio: 4 }, scene: (t) => porteiro(t) }),
  // esse é seu condomínio: a porta com as 20 colônias
  P(w("condominio", "esse"), S("motel"), { keys: mov(w("condominio", "esse"), S("motel"), C_PORTA.pos, C_PORTA.look, add(C_PORTA.pos, [0, 0, -20]), C_PORTA.look, C_PORTA.fov), near: 2, luz: { foco: [40, 100, 0], raio: 160 }, scene: (t) => porta(t) }),
  // ---------- MOTEL ----------
  P(S("motel"), w("motel", "sabe"), { keys: mov(S("motel"), w("motel", "sabe"), [70, 150, 300], [30, 160, 0], add(C_LAMP.pos, [20, -10, 40]), C_LAMP.look, 50, 44), near: 1, luz: { foco: [0, 150, 60], raio: 200 }, scene: (t) => lampada(t, T_AL1()) }),
  P(w("motel", "sabe"), w("motel", "algumas"), { keys: mov(w("motel", "sabe"), w("motel", "algumas"), add(C_LAMP.pos, [20, -10, 40]), C_LAMP.look, C_LAMP.pos, C_LAMP.look, 44, C_LAMP.fov), near: 1, luz: { foco: LAMPADA, raio: 80 }, scene: (t) => lampada(t, T_AL1()) }),
  P(w("motel", "algumas"), w("motel", "pousam") - 0.2, { keys: fixa(C_AL.pos, C_AL.look, C_AL.fov), near: 0.5, luz: { foco: LAMPADA, raio: 60 }, scene: (t) => aleluiaClose(t) }),
  P(w("motel", "pousam") - 0.2, w("motel", "e", 1), { keys: mov(w("motel", "pousam") - 0.2, w("motel", "e", 1), C_POUSO.pos, C_POUSO.look, add(C_POUSO.pos, [-0.8, -0.3, -0.3]), C_POUSO.look, C_POUSO.fov), near: 0.05, luz: { foco: C_PRG, raio: 8 }, scene: (t) => motel(t) }),
  P(w("motel", "e", 1), S("marmitex"), { keys: mov(w("motel", "e", 1), S("marmitex"), C_TAPA.pos, C_TAPA.look, add(C_TAPA.pos, [0.6, 0, 0.6]), C_TAPA.look, C_TAPA.fov), near: 0.05, luz: { foco: C_PRG, raio: 6 }, scene: (t) => motel(t, prog(t, w("motel", "e", 1), w("motel", "tapam") + 0.3)) }),
  // ---------- MARMITEX ----------
  P(S("marmitex"), w("marmitex", "madeira"), { keys: mov(S("marmitex"), w("marmitex", "madeira"), add(C_CAMARA.pos, [0.6, 0, 0.6]), C_CAMARA.look, C_CAMARA.pos, C_CAMARA.look, C_CAMARA.fov), near: 0.05, luz: { foco: C_CAM_C, raio: 6 }, scene: (t) => camara(t) }),
  P(w("marmitex", "madeira"), w("marmitex", "o", 1), { keys: fixa(C_BARRIGA.pos, C_BARRIGA.look, C_BARRIGA.fov), near: 0.02, luz: { foco: C_CAM_C, raio: 3 }, scene: (t) => camara(t, { barriga: prog(t, w("marmitex", "madeira") + 0.2, w("marmitex", "microbio") + 0.2) }) }),
  P(w("marmitex", "o", 1), w("marmitex", "ai"), { keys: fixa(C_GOLE.pos, C_GOLE.look, C_GOLE.fov), near: 0.02, luz: { foco: C_CAM_C, raio: 3 }, scene: (t) => camara(t, { filhote: true }) }),
  P(w("marmitex", "ai"), w("marmitex", "esse"), { keys: fixa(C_COMIDA.pos, C_COMIDA.look, C_COMIDA.fov), near: 0.02, luz: { foco: C_COMIDA.look, raio: 3 }, scene: (t) => comida(t, w("marmitex", "ai")) }),
  P(w("marmitex", "esse"), S("saleiro"), { keys: mov(w("marmitex", "esse"), S("saleiro"), add(C_MARMI.pos, [-5, 0, -1]), C_MARMI.look, C_MARMI.pos, C_MARMI.look, C_MARMI.fov), near: 0.3, luz: { foco: C_MARMI.look, raio: 15 }, scene: (t) => marmitex(t) }),
  // ---------- SALEIRO ----------
  P(S("saleiro"), w("saleiro", "nao"), { keys: mov(S("saleiro"), w("saleiro", "nao"), add(C_PO.pos, [10, 6, 14]), C_PO.look, C_PO.pos, C_PO.look, C_PO.fov), near: 0.5, luz: { foco: add(MGR, [0, 10, 0]), raio: 40 }, scene: (t) => saleiro(t, S("saleiro") + 0.4) }),
  P(w("saleiro", "nao"), w("saleiro", "cada"), { keys: mov(w("saleiro", "nao"), w("saleiro", "cada"), add(C_MONTE.pos, [1, 0.6, 1]), C_MONTE.look, C_MONTE.pos, C_MONTE.look, C_MONTE.fov), near: 0.05, luz: { foco: MGR, raio: 8 }, scene: (t) => saleiro(t, S("saleiro") + 0.4) }),
  P(w("saleiro", "cada"), w("saleiro", "e", 3) - 0.2, { keys: [w("saleiro", "cada"), w("saleiro", "lados") + 0.4, w("saleiro", "e", 3)].map((tt) => ({ t: tt, ...camGrao(tt), fov: 30 })), near: 0.01, luz: { foco: GRAO_H, raio: 2 }, scene: (t) => graoHeroi(t) }),
  P(w("saleiro", "e", 3) - 0.2, w("saleiro", "esse"), { keys: fixa(C_EMP.pos, C_EMP.look, C_EMP.fov), near: 0.03, luz: { foco: FGR, raio: 4 }, scene: (t) => empurra(t) }),
  P(w("saleiro", "esse"), S("inquilino"), { keys: mov(w("saleiro", "esse"), S("inquilino"), add(C_SAL.pos, [-3, 2, -4]), C_SAL.look, C_SAL.pos, C_SAL.look, C_SAL.fov), near: 0.5, luz: { foco: add(FGR, [0, -20, 0]), raio: 40 }, scene: (t) => saleiro(t, S("saleiro") + 0.4) }),
  // ---------- INQUILINO ----------
  P(S("inquilino"), w("inquilino", "a"), { keys: [
    { t: S("inquilino"), pos: [95, 118, 205], look: [-40, 100, 28], fov: 50 },
    { t: w("inquilino", "a"), pos: add(C_SAI.pos, [15, 5, 15]), look: add(C_SAI.look, [3, 2, 0]), fov: 40 },
  ], near: 0.2, luz: { foco: FGR, raio: 15 }, scene: (t) => (<>{quarto(t)}<SaidaAleluias t={t} t0={T_SAI()} n={5} dt={0.4} escala={2.4} /></>) }),
  P(w("inquilino", "a"), w("inquilino", "tem"), { keys: fixa(C_5A.pos, C_5A.look, C_5A.fov), near: 0.5, luz: { foco: GR_C, raio: 50 }, scene: (t) => cincoAnos(t) }),
  P(w("inquilino", "tem"), S("tambor"), { keys: mov(w("inquilino", "tem"), S("tambor"), add(C_SAI.pos, [2, 0, 2]), C_SAI.look, add(C_SAI.pos, [7, 2, 7]), add(C_SAI.look, [2, 1.5, 0]), C_SAI.fov), near: 0.1, luz: { foco: [-30, 100, 40], raio: 160 }, scene: (t) => inquilino(t) }),
  // ---------- TAMBOR ----------
  P(S("tambor"), w("tambor", "ate"), { keys: mov(S("tambor"), w("tambor", "ate"), C_COME.pos, C_COME.look, add(C_COME.pos, [-12, 4, -14]), C_COME.look, C_COME.fov), near: 1, luz: { foco: [-30, 120, 40], raio: 220 }, scene: (t) => comeTudo(t) }),
  P(w("tambor", "ate"), w("tambor", "bate"), { keys: fixa(C_G.pos, C_G.look, C_G.fov), near: 0.2, luz: { foco: C_DENTE, raio: 14 }, scene: (t) => { const u = t - T_AFUNDA() - 0.3; return gancho(t, u); } }),
  P(w("tambor", "bate"), w("tambor", "esse"), { keys: mov(w("tambor", "bate"), w("tambor", "esse"), C_BAT.pos, C_BAT.look, add(C_BAT.pos, [-6, 0, -5]), C_BAT.look, C_BAT.fov), near: 0.5, luz: { foco: C_BATIDA, raio: 40 }, scene: (t) => batida(t, prog(t, w("tambor", "oco") + 0.05, w("tambor", "oco") + 0.5)) }),
  P(w("tambor", "esse"), S("virada"), { keys: mov(w("tambor", "esse"), S("virada"), add(C_BAT2.pos, [6, 0, 4]), C_BAT2.look, C_BAT2.pos, C_BAT2.look, C_BAT2.fov), near: 0.3, luz: { foco: C_BATIDA, raio: 25 }, scene: (t) => batida(t, 1) }),
  // ---------- VIRADA ----------
  P(S("virada"), w("virada", "esse") + 0.3, { keys: fixa(C_UMI.pos, C_UMI.look, C_UMI.fov), near: 1, luz: { foco: [50, 100, 40], raio: 160 }, scene: (t) => umidade(t) }),
  P(w("virada", "esse") + 0.3, w("virada", "e"), { keys: fixa(C_AGUA.pos, C_AGUA.look, C_AGUA.fov), near: 0.02, luz: { foco: C_AGUA.look, raio: 3 }, scene: (t) => agua(t) }),
  P(w("virada", "e"), S("virada") + (w("virada", "quem") - S("virada")), { keys: mov(w("virada", "e"), w("virada", "terra") + 0.3, add(BAT(46, DB, -2), [32, 4, 18]), BAT(46, 0, -2), add(BAT(8, DB, -2), [34, 6, 22]), BAT(10, 0, -2), 44), near: 0.5, luz: { foco: BAT(30, 0, 0), raio: 45 }, scene: (t) => semTerra(t) }),
  P(w("virada", "quem"), w("virada", "ou"), { keys: mov(w("virada", "quem"), w("virada", "ou"), add(C_LAMP.pos, [20, -10, 40]), C_LAMP.look, C_LAMP.pos, C_LAMP.look, 44, C_LAMP.fov), near: 1, luz: { foco: LAMPADA, raio: 80 }, scene: (t) => lampada(t, T_AL2()) }),
  P(w("virada", "ou"), S("final"), { keys: fixa(C_MOVEL.pos, C_MOVEL.look, C_MOVEL.fov), near: 1, luz: { foco: [40, 60, 0], raio: 200 }, scene: (t) => movel(t) }),
  // ---------- FINAL (recap: cada flash roda uma cena já vista com o relógio dela) ----------
  P(S("final"), w("final", "condominio"), { keys: mov(S("final"), w("final", "condominio"), C_GERAL.pos, C_GERAL.look, add(C_GERAL.pos, [-10, 0, -30]), C_GERAL.look, C_GERAL.fov), near: 1, luz: { foco: [-20, 100, 30], raio: 220 }, scene: (t) => quarto(t) }),
  P(w("final", "condominio"), w("final", "motel"), { keys: fixa(C_PORTA.pos, C_PORTA.look, C_PORTA.fov), near: 2, luz: { foco: [40, 100, 0], raio: 160 }, scene: (t) => porta(t) }),
  P(w("final", "motel"), w("final", "marmitex"), { keys: fixa(C_TAPA.pos, C_TAPA.look, C_TAPA.fov), near: 0.05, luz: { foco: C_PRG, raio: 6 }, scene: (t) => motel(t - w("final", "motel") + w("motel", "intestino"), 1) }),
  P(w("final", "marmitex"), w("final", "saleiro"), { keys: fixa(C_MARMI.pos, C_MARMI.look, C_MARMI.fov), near: 0.3, luz: { foco: C_MARMI.look, raio: 15 }, scene: (t) => marmitex(t - w("final", "marmitex") + w("marmitex", "marmitex")) }),
  P(w("final", "saleiro"), w("final", "tambor"), { keys: fixa(C_SAL.pos, C_SAL.look, C_SAL.fov), near: 0.5, luz: { foco: add(FGR, [0, -20, 0]), raio: 40 }, scene: (t) => saleiro(t, S("saleiro") + 0.4) }),
  P(w("final", "tambor"), w("final", "seu", 1), { keys: fixa(C_BAT.pos, C_BAT.look, C_BAT.fov), near: 0.5, luz: { foco: C_BATIDA, raio: 40 }, scene: (t) => batida(t - w("final", "tambor") + w("tambor", "bate") - 0.25) }),
  // último quadro = primeiro: o gancho roda com u = t − FIM (em FIM, u = 0)
  P(w("final", "seu", 1), FIM + 1 / FPS, { keys: fixa(C_G.pos, C_G.look, C_G.fov), near: 0.2, luz: { foco: C_DENTE, raio: 14 }, scene: (t) => gancho(t - FIM, t - FIM) }),
];

// ---------- tela ----------
const WORDS: Word[] = TL.cenas.flatMap((c) => c.words.map((x) => ({ ...x, s: x.s + OFF, e: x.e + OFF })));
const Plano: React.FC<{ p: Plan }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = p.from + f / fps;
  return (
    <AbsoluteFill>
      <PalcoCasa>
        <CupimCam t={t} keys={p.keys} near={p.near ?? 0.05} />
        <LuzCasa foco={p.luz?.foco} raio={p.luz?.raio} />
        {p.scene(t)}
      </PalcoCasa>
      {p.over ? p.over(t) : null}
    </AbsoluteFill>
  );
};
// projeção de um ponto do mundo na tela (px de 1080 × 1920)
const telaDe = (pt: V3, k: { pos: V3; look: V3; fov: number }): [number, number] => {
  const cam = new THREE.PerspectiveCamera(k.fov, 1080 / 1920, 0.01, 6000);
  cam.position.set(...k.pos);
  cam.lookAt(new THREE.Vector3(...k.look));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const v = new THREE.Vector3(...pt).project(cam);
  return [(v.x + 1) * 540, (1 - v.y) * 960];
};
// rótulo grande preso a um ponto da cena (número ou nome), com fio até o ponto
const Rotulo: React.FC<{ de: number; ate: number; texto: string; sub?: string; x: number; y: number; alvo?: [number, number]; cor?: string; tamanho?: number; largura?: number }> = ({ de, ate, texto, sub, x, y, alvo, cor = "#FFFFFF", tamanho = 120, largura = 800 }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const a = sm(clamp01((t - de) / 0.25)) * (1 - sm(clamp01((t - (ate - 0.2)) / 0.2)));
  const sc = 0.6 + 0.4 * sm(clamp01((t - de) / 0.25));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {alvo ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: a }}>
          <line x1={x} y1={y + tamanho * 0.55} x2={alvo[0]} y2={alvo[1]} stroke={TINTA} strokeWidth={14} strokeLinecap="round" />
          <line x1={x} y1={y + tamanho * 0.55} x2={alvo[0]} y2={alvo[1]} stroke={cor} strokeWidth={7} strokeLinecap="round" />
          <circle cx={alvo[0]} cy={alvo[1]} r={13} fill={cor} stroke={TINTA} strokeWidth={5} />
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: x - largura / 2, width: largura, top: y - tamanho * 0.55, textAlign: "center", opacity: a, transform: `scale(${sc})`, fontFamily: FONT_KIT }}>
        <div style={{ fontWeight: 900, fontSize: tamanho, lineHeight: 1, color: cor, WebkitTextStroke: `${Math.round(tamanho / 9)}px ${TINTA}`, paintOrder: "stroke fill", textShadow: "0 6px 14px rgba(0,0,0,0.35)" }}>{texto}</div>
        {sub ? <div style={{ fontWeight: 900, fontSize: tamanho * 0.36, lineHeight: 1.05, color: AMARELO, WebkitTextStroke: `7px ${TINTA}`, paintOrder: "stroke fill", marginTop: 4 }}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
// lápis entrando pela borda direita (a ponta sextavada ao lado do grão) — "igual lápis"
const Lapis: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const k = sm(clamp01((t - de) / 0.45));
  const a = 1 - sm(clamp01((t - (ate - 0.2)) / 0.2));
  const hx = (cx: number, cy: number, r: number) => Array.from({ length: 6 }, (_, i) => `${cx + r * Math.cos((i * PI) / 3)},${cy + r * Math.sin((i * PI) / 3)}`).join(" ");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: a }}>
        <g transform={`translate(${mix(1400, 850, k)} 1000) scale(0.8)`}>
          {/* corpo amarelo do lápis, visto de frente (seção de 6 lados) */}
          <polygon points={hx(0, 0, 150)} fill="#F2C230" stroke={TINTA} strokeWidth={10} />
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={0} y1={0} x2={150 * Math.cos((i * PI) / 3)} y2={150 * Math.sin((i * PI) / 3)} stroke="#C79A1A" strokeWidth={5} />)}
          <polygon points={hx(0, 0, 70)} fill="#E9C9A0" stroke={TINTA} strokeWidth={6} />
          <circle cx={0} cy={0} r={24} fill="#2B2B2B" />
          <text x={0} y={230} textAnchor="middle" fontFamily={FONT_KIT} fontWeight={900} fontSize={56} fill="#FFFFFF" stroke={TINTA} strokeWidth={10} paintOrder="stroke">LÁPIS</text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
// contador de anos (tempo acelerado da colônia do guarda-roupa)
const ContaAnos: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const n = Math.max(1, Math.min(5, 1 + Math.floor(prog(t, T_5A0() + 0.2, T_5A1(), (x) => x) * 4.999)));
  const a = sm(clamp01((t - de) / 0.3)) * (1 - sm(clamp01((t - (ate - 0.25)) / 0.25)));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 200, width: "100%", textAlign: "center", opacity: a, fontFamily: FONT_KIT, fontWeight: 900, fontSize: 150, color: n >= 5 ? AMARELO : "#FFFFFF", WebkitTextStroke: `14px ${TINTA}`, paintOrder: "stroke fill", fontVariantNumeric: "tabular-nums" }}>
        {n} {n === 1 ? "ANO" : "ANOS"}
      </div>
    </AbsoluteFill>
  );
};
// ondas do som oco saindo do ponto da batida
const Ondas: React.FC<{ tk: number[]; x: number; y: number; ate: number }> = ({ tk, x, y, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t >= ate) return null;
  const arcos: React.ReactNode[] = [];
  tk.forEach((t0, j) => {
    for (let i = 0; i < 3; i++) {
      const u = t - t0 - i * 0.12;
      if (u < 0 || u > 0.7) continue;
      const r = 60 + u * 520;
      arcos.push(<circle key={j * 10 + i} cx={x} cy={y} r={r} fill="none" stroke={AMARELO} strokeWidth={14 * (1 - u / 0.7)} opacity={1 - u / 0.7} />);
    }
  });
  if (!arcos.length) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>{arcos}</svg>
    </AbsoluteFill>
  );
};
// título que sempre cabe em ~88 % da largura (fonte 900 com contorno: ~0,72 × tamanho por letra)
const NumeroTopo: React.FC<React.ComponentProps<typeof NumeroTopoKit>> = (p) => {
  const txt = String(p.numero);
  const cabe = Math.floor(930 / (txt.length * 0.72));
  return <NumeroTopoKit {...p} tamanho={Math.min(p.tamanho ?? 150, cabe)} />;
};

// posições de tela (calculadas uma vez)
const PX_PORTA = telaDe([41, 214, -11], C_FAM);
const PX_FAM = telaDe([FAM_X, 205, 55], C_FAM);
const PX_REI = telaDe(ninhoMundo(0, 1.75), C_NIN);
const PX_RAINHA = telaDe(ninhoMundo(0, 0.75), C_NIN);
const PX_PORTEIRO = telaDe(ninhoMundo(0, 2.8), C_NIN);
const PX_SOLD = telaDe(FURO_W, C_PORT);
const PX_PREGO = telaDe(C_PRG, C_POUSO);
const PX_INQ = telaDe(FGR, C_INQ);
const PX_INQ2 = telaDe(FGR, { pos: add(C_SAI.pos, [2, 0, 2]), look: C_SAI.look, fov: C_SAI.fov });
const PX_BATIDA = telaDe(C_BATIDA, C_BAT);
const PX_C_BAT = telaDe(BAT(46, DB, -1), C_COME);
const PX_C_GR = telaDe(grParaMundo([49, 0.9, 0]), C_COME);
const PX_C_VG = telaDe(vigaParaMundo([150, 0, 0]), C_COME);
const PX_PAI = telaDe(add(PAI, [0, 185, 0]), C_UMI);

export const Cupim: React.FC = () => {
  useKitFont();
  const fps = FPS;
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#E9E2D3" }}>
        {PLANS.map((p, i) => (
          <Sequence key={i} from={Math.round(p.from * fps)} durationInFrames={Math.max(1, Math.round(p.to * fps) - Math.round(p.from * fps))} layout="none">
            <Plano p={p} />
          </Sequence>
        ))}
        {/* porta */}
        <NumeroTopo de={w("porta", "vinte")} ate={w("porta", "na")} numero={20} contar sub="famílias de cupim" tamanho={190} />
        <Rotulo de={w("porta", "na") + 0.1} ate={S("condominio")} texto="20" sub="FAMÍLIAS DE CUPIM" x={Math.max(250, PX_PORTA[0])} y={Math.max(330, PX_PORTA[1] - 90)} cor={AMARELO} tamanho={140} largura={420} />
        <Rotulo de={w("porta", "uma")} ate={S("condominio")} texto="1" sub="FAMÍLIA: A SUA" x={Math.min(830, Math.max(PX_FAM[0], 760))} y={Math.max(330, PX_FAM[1] - 90)} tamanho={140} largura={400} />
        {/* condomínio */}
        <Etiqueta de={w("condominio", "dentro") - 0.2} ate={w("condominio", "formiga") - 0.3} texto="RAIO-X" y={1700} cor="#9FE3FF" />
        <Rotulo de={w("condominio", "rei")} ate={w("condominio", "formiga") - 0.3} texto="REI" x={Math.min(880, PX_REI[0] + 330)} y={PX_REI[1] - 60} alvo={PX_REI} tamanho={84} />
        <Rotulo de={w("condominio", "rainha")} ate={w("condominio", "formiga") - 0.3} texto="RAINHA" x={Math.min(820, PX_RAINHA[0] + 330)} y={PX_RAINHA[1] + 60} alvo={PX_RAINHA} tamanho={84} />
        <Rotulo de={w("condominio", "porteiro")} ate={w("condominio", "formiga") - 0.3} texto="PORTEIRO" x={540} y={Math.max(380, PX_PORTEIRO[1] - 300)} alvo={PX_PORTEIRO} tamanho={84} cor={AMARELO} />
        <Rotulo de={w("condominio", "tapa")} ate={w("condominio", "esse")} texto="PORTEIRO" x={540} y={420} alvo={PX_SOLD} tamanho={96} cor={AMARELO} />
        <ApelidoAmarelo de={w("condominio", "condominio")} ate={S("motel")} texto="Condomínio" />
        {/* motel */}
        <NumeroTopo de={w("motel", "algumas")} ate={w("motel", "pousam") - 0.2} numero="ALELUIA" sub="= cupim com asas" tamanho={130} />
        <Etiqueta de={w("motel", "pousam") - 0.2} ate={w("motel", "entram")} texto="FURO DE PREGO" x={PX_PREGO[0]} y={Math.min(1560, PX_PREGO[1] + 170)} />
        <Etiqueta de={w("motel", "tapam") + 0.3} ate={w("motel", "esse")} texto="COLA DO INTESTINO" y={1560} cor={AMARELO} />
        <ApelidoAmarelo de={w("motel", "motel")} ate={S("marmitex")} texto="Motel" />
        {/* marmitex */}
        <Etiqueta de={w("marmitex", "microbio")} ate={w("marmitex", "o", 1)} texto="MICRÓBIOS NA BARRIGA" y={1560} cor="#9FE3FF" />
        <Etiqueta de={w("marmitex", "esse") + 0.1} ate={S("saleiro")} texto="TEMPO ACELERADO" y={1560} />
        <ApelidoAmarelo de={w("marmitex", "marmitex")} ate={S("saleiro")} texto="Marmitex" />
        {/* saleiro */}
        <NumeroTopo de={w("saleiro", "nao")} ate={w("saleiro", "e", 2)} numero="SERRAGEM?" tamanho={130} />
        <Xis de={w("saleiro", "serragem") + 0.15} ate={w("saleiro", "e", 2)} x={540} y={290} />
        <NumeroTopo de={w("saleiro", "e", 2)} ate={w("saleiro", "cada")} numero="É COCÔ" tamanho={150} corNumero={AMARELO} />
        <NumeroTopo de={w("saleiro", "seis")} ate={w("saleiro", "e", 3) - 0.2} numero="6 LADOS" tamanho={140} />
        <Lapis de={w("saleiro", "lapis") - 0.1} ate={w("saleiro", "e", 3) - 0.2} />
        <ApelidoAmarelo de={w("saleiro", "saleiro")} ate={S("inquilino")} texto="Saleiro" />
        {/* inquilino */}
        <Etiqueta de={w("inquilino", "a") + 0.1} ate={w("inquilino", "tem")} texto="TEMPO ACELERADO" y={1560} />
        <ContaAnos de={w("inquilino", "a") + 0.1} ate={w("inquilino", "tem")} />
        <NumeroTopo de={w("inquilino", "tem")} ate={S("tambor")} numero="5+ ANOS" sub="de graça" tamanho={150} />
        <Etiqueta de={w("inquilino", "inquilino")} ate={S("tambor")} texto="INQUILINO" x={PX_INQ2[0]} y={Math.min(1560, PX_INQ2[1] + 140)} cor={AMARELO} tamanho={52} />
        {/* tambor */}
        <Rotulo de={w("tambor", "batente")} ate={w("tambor", "ate")} texto="BATENTE" x={Math.min(860, PX_C_BAT[0] + 60)} y={PX_C_BAT[1] - 220} alvo={PX_C_BAT} tamanho={60} cor={AMARELO} largura={420} />
        <Rotulo de={w("tambor", "guarda-roupa")} ate={w("tambor", "ate")} texto="GUARDA-ROUPA" x={Math.max(250, PX_C_GR[0])} y={PX_C_GR[1] + 260} alvo={PX_C_GR} tamanho={60} cor={AMARELO} largura={500} />
        <Rotulo de={w("tambor", "forro")} ate={w("tambor", "ate")} texto="FORRO E VIGA" x={540} y={Math.max(380, PX_C_VG[1] + 200)} alvo={PX_C_VG} tamanho={60} cor={AMARELO} largura={560} />
        <NumeroTopo de={w("tambor", "ate")} ate={w("tambor", "bate")} numero="AFUNDA NO DEDO" tamanho={110} />
        <Ondas tk={T_BATIDAS()} x={PX_BATIDA[0]} y={PX_BATIDA[1]} ate={w("tambor", "esse")} />
        <NumeroTopo de={w("tambor", "oco") - 0.1} ate={w("tambor", "esse")} numero="OCO?" tamanho={150} />
        <ApelidoAmarelo de={w("tambor", "tambor")} ate={S("virada")} texto="Tambor" y={430} />
        {/* virada */}
        <Rotulo de={w("virada", "culpa")} ate={w("virada", "esse") + 0.3} texto="UMIDADE?" x={PX_PAI[0]} y={Math.max(380, PX_PAI[1] - 120)} tamanho={96} />
        <Xis de={w("virada", "mas")} ate={w("virada", "esse") + 0.3} x={PX_PAI[0]} y={Math.max(380, PX_PAI[1] - 120) - 20} />
        <NumeroTopo de={w("virada", "agua")} ate={w("virada", "e")} numero="ÁGUA DA MADEIRA" tamanho={110} />
        <NumeroTopo de={w("virada", "nem")} ate={w("virada", "quem")} numero="NEM ENCOSTA" sub="na terra" tamanho={130} />
        <NumeroTopo de={w("virada", "lampada")} ate={w("virada", "ou")} numero="LUZ ACESA" tamanho={140} corNumero={AMARELO} />
        <NumeroTopo de={w("virada", "movel")} ate={S("final")} numero="MÓVEL USADO" tamanho={130} />
        {/* recap */}
        <Etiqueta de={w("final", "condominio")} ate={w("final", "seu", 1)} texto="REPLAY" y={1560} cor={AMARELO} />
        <ApelidoAmarelo de={w("final", "condominio")} ate={w("final", "motel")} texto="Condomínio" />
        <ApelidoAmarelo de={w("final", "motel")} ate={w("final", "marmitex")} texto="Motel" />
        <ApelidoAmarelo de={w("final", "marmitex")} ate={w("final", "saleiro")} texto="Marmitex" />
        <ApelidoAmarelo de={w("final", "saleiro")} ate={w("final", "tambor")} texto="Saleiro" />
        <ApelidoAmarelo de={w("final", "tambor")} ate={w("final", "seu", 1)} texto="Tambor" y={430} />
        <Legenda1Palavra palavras={WORDS} />
        <Sequence from={Math.round(OFF * FPS)} layout="none">
          <Audio src={staticFile("cupim/narracao.wav")} />
        </Sequence>
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
void GRAO_L; void GAL_VIGA; void GR; void VIGA; void (null as unknown as Casta);
