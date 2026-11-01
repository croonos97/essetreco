import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import timelineJson from "../../public/lagartixa/timeline.json";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import { ApelidoAmarelo, Legenda1Palavra, NumeroTopo as NumeroTopoKit, useKitFont } from "../three/animais/ui";
import { Relogio } from "../three/animais/uiMacaco";
import { Lagartixa as Lag, LagartixaProps, pontoColuna, RaboSolto, raboSoltoSalto, S_FIM, sAnel, TRONCO } from "../three/animais/Lagartixa";
import { Gato, GATO_BOCA, GatoProps } from "../three/animais/LagartixaGato";
import { AntebracoSolto, HumanoAzul, UPPER } from "../three/animais/LagartixaHumano";
import { amostraCam, clamp01, CM, LagCam, LKey, localParaMundo, mix, mundoParaLocal, noPlano, PalcoNoite, sm, texCanvas, V3 } from "../three/animais/LagartixaComum";
import { LupaDedo } from "../three/animais/LagartixaLupa";
import { Etiqueta, Reguas, RotaAfrica, Seta, Xis } from "../three/animais/LagartixaTela";
import { Mariposa, orbitaInseto, VAR, Varanda, Vassoura } from "../three/animais/LagartixaVaranda";

// =====================================================================
// "Você dá o rabo para sobreviver" — lagartixa-de-parede (Hemidactylus mabouia). Kit: src/three/animais/Lagartixa*.
// Cenário único (varanda à noite). Cada plano é cravado numa palavra da narração (wordAt + OFF). Último quadro = primeiro.
// Regras: nada de sangue; nada pisca; câmera longe da nuvem de insetos; movimentos rápidos com câmera acompanhando.
// =====================================================================
const TL = timelineJson as Timeline;
const FPS = 30;
const OFF = 0.5;
export const lagartixaDuration = (fps: number) => Math.ceil((TL.duration + OFF + 0.4) * fps);
const FIM = (lagartixaDuration(FPS) - 1) / FPS;
const w = (c: string, word: string, n = 0) => wordAt(TL, c, word, n) + OFF;
const S = (c: string) => cena(TL, c).start + OFF;
const PI = Math.PI;
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const cm = (p: V3, x: number, y: number, z: number): V3 => [p[0] + x * CM, p[1] + y * CM, p[2] + z * CM];

type Plan = { from: number; to: number; keys: LKey[]; scene: (t: number) => React.ReactNode; exp?: number; over?: (t: number) => React.ReactNode };
const P = (from: number, to: number, p: Omit<Plan, "from" | "to">): Plan => ({ from, to, ...p });
const fixa = (a: number, b: number, pos: V3, look: V3, fov: number): LKey[] => [
  { t: a, pos, look, fov },
  { t: b, pos, look, fov },
];
const mov = (a: number, b: number, p0: V3, l0: V3, p1: V3, l1: V3, f0: number, f1 = f0): LKey[] => [
  { t: a, pos: p0, look: l0, fov: f0 },
  { t: b, pos: p1, look: l1, fov: f1 },
];

// ---------- lugares ----------
const PAREDE = noPlano([0, 0, 1], [0, 1, 0]);
const rotP = (ang: number) => noPlano([0, 0, 1], [Math.sin(ang), Math.cos(ang), 0]); // ang 0 = cabeça para cima, + = para a direita (+x)
const ANEL = 4; // anel de soltura do quadro 0: toco curto e bem visível (sobra o plano de quebra 3 → "da próxima vez, mais perto do corpo")
const LZ0: V3 = [0.3, 1.74, 0];
const ROT0 = rotP(0.46);
const GATO0 = { position: [-0.1, VAR.banco.y, 0.2] as V3, rotation: [0, PI / 2, 0] as V3 };
const L0 = (t: number, extra: Partial<LagartixaProps> = {}): LagartixaProps => ({ t, position: LZ0, rotation: ROT0, curva: 0.3, raboCurva: -0.7, cabeca: [-0.25, 0.1], rabo: 0.1, ...extra });
const pontaMundo = (LP: LagartixaProps, s: number) => localParaMundo(pontoColuna(LP, s), LP.position, LP.rotation);
const pataNaPonta = (LP: LagartixaProps, lift = 0, s = 10.1) => {
  const p = pontaMundo(LP, s);
  return mundoParaLocal([p[0], p[1] + lift * 0.05, 0.004 + lift * 0.12], GATO0.position, GATO0.rotation);
};
const LAMP_L: V3 = [0.42, 3.86, 0]; // lagartixa parada ao lado da lâmpada (cloaca)

// trajeto na parede (pontos x,y) com velocidade constante; devolve posição, ângulo e cm andados
// dist devolvida com a passada limitada a ~3 passos/s (patas rápidas demais viram estrobo/piscada a 30 fps)
const trajeto = (pts: [number, number][], t: number, t0: number, t1: number, passo = 4.5) => {
  const curva = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
  const L = curva.getLength();
  const k = prog(t, t0, t1, (x) => x);
  const p = curva.getPointAt(Math.min(0.9999, k));
  const d = curva.getTangentAt(Math.min(0.9999, Math.max(0.0001, k)));
  const vel = L / CM / Math.max(0.05, t1 - t0); // cm/s
  const f = Math.min(1, (3.0 * passo) / vel);
  return { pos: [p.x, p.y, 0] as V3, ang: Math.atan2(d.x, d.y), dist: (k * L * f) / CM, andando: k > 0 && k < 1 ? 1 : 0 };
};
// subida até o teto pela quina (raio 3 cm) e depois pelo forro (para +z)
const QX = -0.15;
const quina = (t: number, t0: number, t1: number) => {
  const R = 0.06, yC = VAR.teto - R, zC = R;
  const L1 = yC - 4.75, L2 = (PI / 2) * R, L3 = 0.5;
  const L = L1 + L2 + L3;
  const s = prog(t, t0, t1, (x) => x) * L;
  let pos: V3, n: V3, f: V3;
  if (s < L1) {
    pos = [QX, 4.75 + s, 0];
    n = [0, 0, 1];
    f = [0, 1, 0];
  } else if (s < L1 + L2) {
    const a = (s - L1) / R;
    pos = [QX, yC + Math.sin(a) * R, zC - Math.cos(a) * R];
    n = [0, -Math.sin(a), Math.cos(a)];
    f = [0, Math.cos(a), Math.sin(a)];
  } else {
    pos = [QX, VAR.teto, zC + (s - L1 - L2)];
    n = [0, -1, 0];
    f = [0, 0, 1];
  }
  const f2 = Math.min(1, (3.0 * 3.5) / (L / CM / Math.max(0.05, t1 - t0)));
  return { pos, rot: noPlano(n, f), dist: (s / CM) * f2, k: s / L };
};

// ---------- ESTADO GLOBAL DO RABO (todas as cenas do presente leem daqui) ----------
// inteiro → (solta no gancho) toco → (o rabo volta) crescendo → regenerado (+ fita da gambiarra)
const T_SOLTA = () => w("gancho", "para") + 0.1;
const T_REG0 = () => S("gambiarra");
const T_REG1 = () => w("gambiarra", "gente");
const caudaEm = (t: number): Partial<LagartixaProps> => {
  if (t < T_SOLTA()) return {};
  if (t < T_REG0()) return { soltar: { anel: ANEL, pedaco: false } };
  const k = prog(t, T_REG0(), T_REG1(), (x) => 1 - Math.pow(1 - x, 1.6));
  return { regen: { anel: ANEL, comp: mix(0.12, S_FIM - sAnel(ANEL), k), fita: prog(t, w("gambiarra", "esse"), w("gambiarra", "gambiarra") + 0.2) } };
};
// ---------- cenas ----------
const varanda = (t: number, extra: Partial<React.ComponentProps<typeof Varanda>> = {}) => (
  <>
    <Varanda t={t} {...extra} />
    <Atraidas t={t} />
  </>
);

// quadro 0: lagartixa grande na parede, pata do gato prendendo a PONTA do rabo; `u` = tempo local (0 = 1º quadro)
const GATO_CAB0: [number, number, number] = [-0.55, -0.45, -0.1]; // cara de 3/4 para a câmera, olhando para cima (a lagartixa)
function abertura(t: number, u: number) {
  const tensao = 0.5 + 0.5 * Math.sin(u * 2.2);
  const LP = L0(t, { curva: 0.3 + 0.08 * tensao, cabeca: [-0.25 - 0.1 * tensao, 0.1] });
  return (
    <>
      {varanda(t)}
      <Lag {...LP} sombra={false} /> {/* sem sombra no quadro 0/loop: nenhuma sombrinha solta ao lado dela */}
      <Gato t={t} {...GATO0} cabeca={GATO_CAB0} orelhas={1} pupila={0.85} pataE={{ alvo: pataNaPonta(LP), normal: [1, 0, 0], apertar: 0.5 + 0.2 * tensao, unhas: 0.6 }} rabo={0.5} />
    </>
  );
}
// soltura (close): o anel amarelo acende, o rabo parte ali, o corpo dá um tranco para a frente com o toco
// e o pedaço fica parado sob a pata, se debatendo. `tS` = instante da soltura (no relógio da cena)
const GAP = 1.1; // cm de fresta entre toco e pedaço logo após soltar
const dirRaboMundo = (LP: LagartixaProps): V3 => {
  const a = pontaMundo(LP, sAnel(ANEL)), b = pontaMundo(LP, sAnel(ANEL) + 0.3);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  return [d.x, d.y, d.z];
};
function soltura(t: number, tS: number) {
  const LP0 = L0(t);
  const marca = prog(t, tS - 0.45, tS - 0.25) * (1 - prog(t, tS - 0.05, tS + 0.25));
  const sep = prog(t, tS, tS + 0.3);
  const d = dirRaboMundo(LP0);
  const g = GAP * sep;
  const pos: V3 = [LP0.position![0] - d[0] * g * CM, LP0.position![1] - d[1] * g * CM, LP0.position![2]];
  const LP: LagartixaProps = { ...LP0, position: pos, marca: { anel: ANEL, op: marca }, cabeca: [-0.25 + 0.3 * sep, 0.1 + 0.15 * sep] };
  return (
    <>
      {varanda(t)}
      <Lag {...LP} soltar={t >= tS ? { anel: ANEL, afastar: g, tSolta: tS, amp: 1.0 } : undefined} />
      <Gato t={t} {...GATO0} cabeca={GATO_CAB0} orelhas={1} pupila={0.85} pataE={{ alvo: pataNaPonta(LP0), normal: [1, 0, 0], apertar: 0.7, unhas: 0.6 }} />
    </>
  );
}
// fuga parede acima até a lâmpada (de toco); o pedaço fica sob a pata, se debatendo
const pedacoMundo = () => {
  const LP = L0(0);
  const a = pontaMundo(LP, sAnel(ANEL));
  const d = dirRaboMundo(LP);
  return { pos: a, rot: rotP(Math.atan2(d[0], d[1]) + PI) };
};
function fuga(t: number, t0: number, t1: number) {
  const pd = pedacoMundo();
  const tr = trajeto(FUGA_PTS, t, t0, t1);
  const ang0 = 0.46;
  const k = prog(t, t0, t0 + 0.4);
  return (
    <>
      {varanda(t)}
      <Lag t={t} position={tr.pos} rotation={rotP(mix(ang0, tr.ang, k))} andar={tr.andando} correr={1} dist={tr.dist} {...caudaEm(t)} cabeca={[0, 0.05]} />
      <RaboSolto t={t} anel={ANEL} tSolta={T_SOLTA()} position={pd.pos} rotation={pd.rot} amp={1} />
      <Gato t={t} {...GATO0} cabeca={[GATO_CAB0[0] - 0.3 * prog(t, t0, t0 + 1), GATO_CAB0[1] + 0.2 * prog(t, t0, t0 + 1), 0.1]} orelhas={1} pupila={1} pataE={{ alvo: pataNaPonta(L0(t)), normal: [1, 0, 0], apertar: 0.8, unhas: 0.7 }} rabo={0.8} />
    </>
  );
}
// parada do lado da lâmpada, de toco, virando a cabeça (nome) — a varanda aparece: lâmpada, forro, insetos
function nome(t: number) {
  const vira = prog(t, w("nome", "completo"), w("nome", "completo") + 0.5);
  const lambe = prog(t, w("nome", "hemidactylus") + 0.2, w("nome", "hemidactylus") + 0.4) * (1 - prog(t, w("nome", "hemidactylus") + 0.6, w("nome", "hemidactylus") + 0.8));
  const segue = prog(t, w("nome", "mabouia"), w("nome", "mabouia") + 0.6);
  return (
    <>
      {varanda(t)}
      <Lag t={t} position={LAMP_L} rotation={rotP(0.1)} {...caudaEm(t)} cabeca={[mix(0, 0.55, vira) - 0.3 * segue, 0.15 * vira]} lingua={lambe} rabo={0} />
    </>
  );
}
// replay em câmera lenta: a pata desce e prende; ela não puxa (mesmo gato, com luz de preenchimento na cara)
function replay(t: number, t0: number) {
  const LP = L0(t, { cabeca: [-0.15, 0.05] });
  const desce = prog(t, t0 + 0.2, t0 + 1.2);
  return (
    <>
      {varanda(t)}
      <pointLight position={[0.9, 1.6, 0.9]} intensity={0.9} distance={0} decay={1} color="#FFE6C8" />
      <Lag {...LP} />
      <Gato t={t} {...GATO0} cabeca={GATO_CAB0} orelhas={1} pupila={0.9} pataE={{ alvo: pataNaPonta(LP, 1 - desce), normal: [1, 0, 0], apertar: 0.6 * desce, unhas: 0.6 * desce }} />
    </>
  );
}
// "se fosse você": a vítima (azul claro) estende o braço; o ladrão (azul mais escuro, de boné) segura o antebraço;
// tracejado amarelo no cotovelo; o antebraço desencaixa como de manequim e fica na mão do ladrão; a vítima corre
const VIT: V3 = [-1.0, 0, 0.8];
const LAD: V3 = [VIT[0] + 1.6, 0, VIT[2] + 0.42];
const COTOVELO: V3 = [VIT[0] + UPPER, 2.85, VIT[2] + 0.42];
function ladrao(t: number) {
  const estende = prog(t, w("solta", "e") - 0.25, w("solta", "largar") - 0.1);
  const agarra = prog(t, w("solta", "largar") - 0.2, w("solta", "largar") + 0.25);
  const tSai = w("solta", "braco") + 0.45;
  const sai = t >= tSai;
  const anel = prog(t, w("solta", "braco") - 0.15, w("solta", "braco") + 0.1) * (1 - prog(t, tSai, tSai + 0.25));
  const recua = prog(t, tSai, tSai + 0.6); // ladrão dá um passo para trás e ergue o antebraço roubado na frente do rosto
  const dx = 0.3 * recua;
  const ergue = 0.75 * sm(prog(t, tSai + 0.05, tSai + 0.6));
  const vira = prog(t, tSai + 0.05, tSai + 0.45);
  const corre = Math.max(0, t - (tSai + 0.3));
  const dCorre = corre * 0.75 + 0.2 * corre * corre;
  const vpos: V3 = [VIT[0] - dCorre, 0, VIT[2] + 0.3 * dCorre]; // foge para a esquerda, devagar o bastante para continuar no quadro
  const bracoV = { ombro: [mix(0.15, PI / 2, estende), 0, 0.05] as [number, number, number], cotovelo: 0 };
  const bL = (lado: number) => ({ ombro: [mix(0.15, PI / 2 - 0.35, agarra) + ergue, lado * 0.25 * agarra, 0.04] as [number, number, number], cotovelo: mix(0.15, 0.75, agarra) });
  // o antebraço roubado gira junto com os braços do ladrão (mesmo eixo do ombro): fica sempre nas mãos dele
  const S: V3 = [LAD[0] + dx, 2.85, LAD[2]];
  const rel = [COTOVELO[0] - LAD[0], COTOVELO[1] - 2.85];
  const ca = Math.cos(-ergue), sa = Math.sin(-ergue);
  const antePos: V3 = [S[0] + rel[0] * ca - rel[1] * sa, S[1] + rel[0] * sa + rel[1] * ca, COTOVELO[2]];
  return (
    <>
      {varanda(t, { porta: 0.7 })}
      <HumanoAzul t={t} position={vpos} rotation={[0, mix(PI / 2, -PI / 2 + 0.3, vira), 0]} bracoD={sai ? { ombro: [mix(PI / 2, 0.3, vira), 0, 0.1], cotovelo: 0 } : bracoV} semAnteD={sai} andar={corre > 0 ? 1 : 0} correr={corre > 0 ? 1 : 0} fase={dCorre / 1.6} cabeca={[0, 0.05]} />
      {sai ? <AntebracoSolto position={antePos} rotation={[0, 0, PI / 2 - ergue]} /> : null}
      {anel > 0.001 ? (
        <mesh position={COTOVELO} rotation={[0, PI / 2, 0]} scale={0.15}>
          <torusGeometry args={[1, 0.1, 6, 40]} />
          <meshBasicMaterial color="#FFD23F" toneMapped={false} transparent opacity={anel} depthWrite={false} />
        </mesh>
      ) : null}
      <HumanoAzul t={t} position={[LAD[0] + dx, 0, LAD[2]]} rotation={[0, -PI / 2, 0]} cor="#4F7FE0" bone bracoE={bL(1)} bracoD={bL(-1)} cabeca={[0, sai ? -0.25 * recua : 0.05]} />
    </>
  );
}
// o rabo solto cai da parede no banco quando a pata sobe (sombra de contato), o gato olha
const RB: V3 = [0.5, VAR.banco.y, 0.16]; // onde o pedaço cai no banco (ao pé da parede)
const ROT_RB: V3 = [0, 2.6, 0];
const T_QUEDA = () => S("duble") + 0.25;
const quedaY = (t: number) => {
  const pd = pedacoMundo();
  const c = Math.max(0, t - T_QUEDA());
  const y0 = pd.pos[1] - VAR.banco.y;
  const tc = Math.sqrt((2 * y0) / 19.6);
  if (c < tc) return { y: y0 - 0.5 * 19.6 * c * c, caiu: 0, gira: c / tc };
  const q = c - tc; // quiquinho amortecido
  return { y: Math.max(0, 0.06 * Math.exp(-q * 6) * Math.abs(Math.sin(q * 9))), caiu: 1, gira: 1 };
};
function queda(t: number) {
  const pd = pedacoMundo();
  const sobe = prog(t, T_QUEDA() - 0.3, T_QUEDA() + 0.05);
  const q = quedaY(t);
  // no ar: vertical como estava na parede, vai deitando enquanto cai
  const no = q.gira;
  const pos: V3 = [mix(pd.pos[0], RB[0], no), VAR.banco.y + q.y, mix(pd.pos[2] + 0.02, RB[2], no)];
  return (
    <>
      {varanda(t)}
      <group position={pos}>
        <group rotation={[mix(PI / 2, 0, sm(no)), mix(0, ROT_RB[1], sm(no)), 0]}>
          <RaboSolto t={t} anel={ANEL} tSolta={T_SOLTA()} amp={1.3} apoiado={q.caiu > 0} />
        </group>
      </group>
      <pointLight position={[0.8, 1.4, 0.8]} intensity={0.6} distance={0} decay={1} color="#FFE6C8" />
      {q.caiu > 0 ? <SombraContato pos={[RB[0], VAR.banco.y + 0.003, RB[2]]} r={0.07} op={0.55} /> : null}
      {gatoQueda(t)}
    </>
  );
}
// o gato depois de soltar o pedaço: pata no ar, olhando o rabo no banco (fica em cena e faz sombra nos planos do banco)
const gatoQueda = (t: number) => {
  const sobe = prog(t, T_QUEDA() - 0.3, T_QUEDA() + 0.05);
  const desce = prog(t, T_QUEDA() + 1.2, T_QUEDA() + 1.9);
  const a = pataNaPonta(L0(0), sobe);
  const alvo: V3 = mixV(a, [3.6, 0, 14], desce);
  return <Gato t={t} {...GATO0} cabeca={[mix(GATO_CAB0[0], 0.2, sobe), mix(GATO_CAB0[1], 0.35, prog(t, T_QUEDA(), T_QUEDA() + 0.4)), 0]} orelhas={1} pupila={1} pataE={{ alvo, normal: [mix(mix(1, 0, sobe), 0, desce), mix(mix(0, -1, sobe), -1, desce), 0], apertar: 0.6 * (1 - sobe), unhas: 0.6 * (1 - sobe) }} />;
};
// sombra de contato (disco escuro suave) — fixa, não depende do shadow map
const SombraContato: React.FC<{ pos: V3; r: number; op: number; sx?: number }> = ({ pos, r, op, sx = 2.2 }) => (
  <mesh position={pos} rotation={[-PI / 2, 0, ROT_RB[1]]} scale={[r * sx, r, 1]} renderOrder={1}>
    <circleGeometry args={[1, 32]} />
    <meshBasicMaterial map={sombraTex()} transparent opacity={op} depthWrite={false} color="#000000" />
  </mesh>
);
const sombraTex = () =>
  texCanvas("lagSombraContato", 128, 128, (g, W, H) => {
    const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }, false, false);
// rabo solto no banco: pula, chicoteia, cambalhota — sempre se mexendo; pulos acumulam (sem teleporte)
function raboBanco(t: number, gatoBote = false) {
  const pula = { t0: w("duble", "pula") - 0.1, dur: 0.6, altura: 1.5, volta: 0 };
  const cambalhota = { t0: w("duble", "cambalhota") - 0.25, dur: 1.6, altura: 3, volta: 1 };
  const salto = t < cambalhota.t0 ? pula : cambalhota;
  const feito = t >= cambalhota.t0 ? 1.2 : 0;
  const amp = 1.5 + 0.6 * prog(t, w("duble", "chicoteia") - 0.2, w("duble", "chicoteia")) * (1 - prog(t, w("duble", "chicoteia") + 0.6, w("duble", "da"))) + 0.9 * prog(t, w("duble", "num"), w("duble", "mexeu")); // continua se debatendo forte durante "se mexeu"
  return (
    <group>
    <pointLight position={[RB[0] + 0.3, RB[1] + 0.35, RB[2] + 0.45]} intensity={0.35} distance={0} decay={2} color="#FFE6C8" />
    <group position={RB} rotation={ROT_RB}>
      <group position={[0, 0, -feito * CM]}>
        <RaboSolto t={t} anel={ANEL} tSolta={T_SOLTA()} salto={salto} amp={(gatoBote ? 1.1 : amp) * Math.exp((t - T_SOLTA()) / 12)} />
      </group>
      <mesh position={[0, 0.003, -(feito + 2.2) * CM]} rotation={[-PI / 2, 0, 0]} scale={[0.05, 0.11, 1]} renderOrder={1}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial map={sombraTex()} transparent opacity={0.5 * (1 - 0.6 * sm(raboSoltoSalto(t, salto).y / 3))} depthWrite={false} color="#000000" />
      </mesh>
    </group>
    </group>
  );
}
// bote do gato no rabo do banco (o MESMO gato: agacha onde está e salta ~16 cm, as patas da frente caem no rabo)
const BOTE_D = 14;
function bote(t: number, t0: number) {
  const b = prog(t, t0 + 0.25, t0 + 0.85);
  const ag = prog(t, t0 - 0.35, t0 + 0.15) * (1 - b);
  const pega = t >= t0 + 0.85;
  return (
    <>
      {varanda(t)}
      <pointLight position={[1.0, 1.6, 1.2]} intensity={0.8} distance={0} decay={1} color="#FFE2C0" />
      {!pega ? raboBanco(t, true) : null}
      <Gato t={t} {...GATO0} agachar={ag} rebolar={ag} bote={b} boteDist={BOTE_D} arco={2.5 * Math.sin(b * PI)} cabeca={[0, mix(0.35, 0.75, b), 0]} boca={0.6 * prog(t, t0 + 0.55, t0 + 0.8) * (pega ? 0.4 : 1)} mastigar={pega ? 1 : 0} pupila={1} orelhas={0.5} naBoca={pega ? raboNaBoca(t) : undefined} />
    </>
  );
}
// rabo atravessado na boca do gato (grande o bastante para ler, mexendo)
const raboNaBoca = (t: number) => (
  <group position={[1.6, -0.2, 0.4]} rotation={[0.25, PI / 2, 0]}>
    <group>
      <RaboSolto t={t} anel={ANEL} tSolta={T_SOLTA()} escala={90} apoiado={false} amp={ampRabo(t)} />
    </group>
  </group>
);
// gato depois do bote, mastigando o dublê
const CAB_MORDE: [number, number, number] = [0.0, 0.55, 0];
const BOTE_DUB = 10; // cm: o gato avança um pouco para alcançar o rabo com a pata
const gatoComRabo = (t: number) => <Gato t={t} {...GATO0} bote={1} boteDist={BOTE_DUB} cabeca={[mix(CAB_MORDE[0], -0.3, prog(t, w("duble", "esse"), w("duble", "esse") + 0.5)), mix(CAB_MORDE[1], 0.25, prog(t, w("duble", "esse"), w("duble", "esse") + 0.5)), 0.05]} mastigar={1} orelhas={0.4} pupila={0.6} naBoca={raboNaBoca(t)} />;
// ---------- o dublê num plano só: o gato olha, prende o rabo com a pata, leva até a boca e morde ----------
const ampRabo = (t: number) => 1.6 * Math.exp((t - T_SOLTA()) / 12);
// matriz de mundo do rabo quando está na boca do gato (mesma cadeia de grupos do Gato + raboNaBoca)
const matRaboBoca = (cab: [number, number, number]) => {
  const Mcat = new THREE.Matrix4().compose(new THREE.Vector3(...GATO0.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...GATO0.rotation)), new THREE.Vector3(CM, CM, CM));
  const Mcab = new THREE.Matrix4().compose(new THREE.Vector3(0, 30, 23.5 + BOTE_DUB), new THREE.Quaternion().setFromEuler(new THREE.Euler(cab[1], cab[0], cab[2], "YXZ")), new THREE.Vector3(1, 1, 1));
  const Mboca = new THREE.Matrix4().makeTranslation(GATO_BOCA[0], GATO_BOCA[1], GATO_BOCA[2]);
  const Mr = new THREE.Matrix4().compose(new THREE.Vector3(1.6, -0.2, 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, PI / 2, 0)), new THREE.Vector3(1.8, 1.8, 1.8));
  return Mcat.multiply(Mcab).multiply(Mboca).multiply(Mr);
};
const matRaboBanco = () => new THREE.Matrix4().compose(new THREE.Vector3(...RB), new THREE.Quaternion().setFromEuler(new THREE.Euler(...ROT_RB)), new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -1.2 * CM)).multiply(new THREE.Matrix4().makeScale(CM, CM, CM)); // mesmo lugar do rabo depois da cambalhota
function dubleMordida(t: number) {
  const t0 = w("duble", "por", 1);
  const tPrende = t0 + 0.55, tErgue = t0 + 0.9, tBoca = t0 + 1.45;
  const olha = sm(prog(t, t0 - 0.1, t0 + 0.35));
  const prende = sm(prog(t, t0 + 0.3, tPrende));
  const avanca = prog(t, t0 + 0.05, t0 + 0.45);
  const ergue = sm(prog(t, tErgue, tBoca));
  const naBoca = t >= tBoca;
  const volta = sm(prog(t, tBoca + 0.05, tBoca + 0.5));
  const cab: [number, number, number] = [mix(0.2, CAB_MORDE[0], olha), mix(0.35, CAB_MORDE[1], olha), 0];
  // rabo: no banco → preso na pata → subindo até a boca (interpola a matriz de mundo, sem pulo)
  const A = new THREE.Vector3(), Aq = new THREE.Quaternion(), As = new THREE.Vector3();
  const B = new THREE.Vector3(), Bq = new THREE.Quaternion(), Bs = new THREE.Vector3();
  matRaboBanco().decompose(A, Aq, As);
  matRaboBoca(CAB_MORDE).decompose(B, Bq, Bs);
  const P_ = A.clone().lerp(B, ergue), Q_ = Aq.clone().slerp(Bq, ergue), S_ = As.clone().lerp(Bs, ergue);
  // pata: repouso → em cima do rabo → sobe junto com ele → volta ao chão
  const meioRabo: V3 = [P_.x - 0.03, P_.y + 0.015, P_.z + 0.02];
  const pataLocal = mundoParaLocal(meioRabo, GATO0.position, GATO0.rotation);
  const repouso: V3 = [3.6, 0, 14 + BOTE_DUB * sm(avanca)];
  const alvo = naBoca ? mixV(pataLocal, repouso, volta) : mixV(repouso, pataLocal, prende);
  const pata = { alvo, normal: [0, -1, 0] as V3, apertar: 0.5 * prende * (1 - volta), unhas: 0.8 * prende * (1 - volta) };
  return (
    <>
      {varanda(t)}
      <pointLight position={[1.0, 1.6, 1.2]} intensity={0.8} distance={0} decay={1} color="#FFE2C0" />
      {!naBoca ? (
        <group position={[P_.x, P_.y, P_.z]} quaternion={Q_} scale={[S_.x, S_.y, S_.z]}>
          <RaboSolto t={t} anel={ANEL} tSolta={T_SOLTA()} escala={1 / CM} apoiado={ergue < 0.02} amp={ampRabo(t) * (1 - 0.5 * prende * (1 - ergue))} />
        </group>
      ) : null}
      <Gato t={t} {...GATO0} bote={avanca} boteDist={BOTE_DUB} agachar={0.6 * prog(t, t0 - 0.2, t0 + 0.05) * (1 - avanca)} cabeca={cab} orelhas={1} pupila={1} pataE={pata} boca={naBoca ? 0 : 0.7 * prog(t, tBoca - 0.4, tBoca - 0.1)} mastigar={naBoca ? 1 : 0} naBoca={naBoca ? raboNaBoca(t) : undefined} />
    </>
  );
}
// "e você some": ela sai da lâmpada e entra de cabeça na fresta perto do forro (o corpo some atrás da parede)
function some(t: number, t0: number, t1: number) {
  const F = VAR.fresta.c;
  const tr = trajeto([[-0.05, 4.55], [-0.22, 4.78], [F[0] + 0.02, F[1] - 0.1]], t, t0, t1);
  const entra = prog(t, t1, t1 + 0.35, (x) => x);
  const d: V3 = [Math.sin(tr.ang), Math.cos(tr.ang), 0];
  const a = 0.6 * sm(entra * 3);
  const f: V3 = [d[0] * Math.cos(a), d[1] * Math.cos(a), -Math.sin(a)];
  const n: V3 = [d[0] * Math.sin(a), d[1] * Math.sin(a), Math.cos(a)];
  const avanco = entra * 0.2;
  const pos: V3 = [tr.pos[0] + f[0] * avanco, tr.pos[1] + f[1] * avanco, f[2] * avanco];
  return (
    <>
      {varanda(t)}
      <pointLight position={[-0.15, 4.65, 0.75]} intensity={1.1} distance={0} decay={1} color="#FFE6C8" />
      {entra < 1 ? <Lag t={t} position={pos} rotation={noPlano(n, f)} andar={1} correr={1} dist={tr.dist + avanco / CM} {...caudaEm(t)} rabo={0} /> : null}
      {gatoComRabo(t)}
    </>
  );
}
// close do gato mastigando o rabo (gato inteiro de 3/4, o rabo atravessado na boca ainda mexendo)
function gatoMastiga(t: number) {
  return (
    <>
      {varanda(t)}
      <pointLight position={[0.9, 1.6, 1.0]} intensity={0.8} distance={0} decay={1} color="#FFE2C0" />
      {gatoComRabo(t)}
    </>
  );
}
// raio-x do rabo (replay na parede): barra varre, tracejados, músculo, osso parte, solta
function raioX(t: number) {
  const LP = L0(t, { rabo: 0, raboCurva: -0.35 });
  const tq = w("picote", "parte");
  return (
    <>
      {varanda(t)}
      <Lag
        {...LP}
        raioX={{
          ate: prog(t, w("picote", "os"), w("picote", "rabo") + 0.3), // não volta: o raio-x fica até o corte do plano
          tracejados: 9 * prog(t, w("picote", "linha") - 0.1, w("picote", "quebra") + 0.4),
          musculo: prog(t, w("picote", "musculo"), w("picote", "aperta") + 0.2),
          quebraAnel: ANEL,
          quebra: prog(t, w("picote", "osso"), tq + 0.1),
        }}
        soltar={t > tq + 0.15 ? { anel: ANEL, afastar: prog(t, tq + 0.15, tq + 0.5) * 0.8, tSolta: tq + 0.15, amp: 0.6 } : undefined}
      />
    </>
  );
}
// teto: sobe a quina e anda no forro
function teto(t: number, t0: number, t1: number) {
  const q = quina(t, t0, t1);
  return (
    <>
      {varanda(t)}
      <Lag t={t} position={q.pos} rotation={q.rot} andar={q.k > 0 && q.k < 1 ? 1 : 0} correr={0.6} dist={q.dist} {...caudaEm(t)} rabo={0} sombra={q.k < 0.55} />
    </>
  );
}
const TETO_POS: V3 = [QX, VAR.teto, 0.06 + 0.5];
const TETO_ROT = noPlano([0, -1, 0], [0, 0, 1]);
function noTeto(t: number, anda = 0) {
  return (
    <>
      {varanda(t)}
      <Lag t={t} position={[TETO_POS[0], TETO_POS[1], TETO_POS[2] + anda * 0.05]} rotation={TETO_ROT} andar={anda > 0 && anda < 1 ? 1 : 0} dist={anda * 2.5} {...caudaEm(t)} rabo={0} cabeca={[0.2, 0]} sombra={false} />
    </>
  );
}
// rabo voltando (tempo acelerado): parte do toco, régua milimetrada ao lado, contador de dias
const REG_POS: V3 = [0.5, 3.48, 0];
const REG_ROT = rotP(-0.25);
const LP_REG = (t: number, extra: Partial<LagartixaProps> = {}): LagartixaProps => ({ t, position: REG_POS, rotation: REG_ROT, rabo: 0.15, cabeca: [0.2, 0.05], ...caudaEm(t), ...extra });
const reguaTex = () =>
  texCanvas("lagReguaMM", 128, 1024, (g, W, H) => {
    g.fillStyle = "#F2E3A6";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#2A2A2A";
    for (let mm = 0; mm <= 60; mm++) {
      const y = H - 12 - (mm / 60) * (H - 24);
      const L = mm % 10 === 0 ? 70 : mm % 5 === 0 ? 48 : 30;
      g.fillRect(0, y - 2, L, 4);
      if (mm % 10 === 0) {
        g.font = "bold 40px Arial";
        g.fillText(String(mm / 10), 78, y + 14);
      }
    }
  }, true, false);
// régua de 6 cm deitada na parede ao lado do rabo, alinhada com ele (o zero no toco)
const ReguaMM: React.FC<{ LP: LagartixaProps; op: number }> = ({ LP, op }) => {
  const a = pontaMundo(LP, sAnel(ANEL));
  const d = dirRaboMundo({ ...LP, soltar: undefined, regen: undefined });
  const lado: V3 = [d[1], -d[0], 0];
  const L = 6 * CM, W = 0.75 * CM, off = 2.0 * CM;
  const c: V3 = [a[0] + d[0] * L * 0.5 + lado[0] * off, a[1] + d[1] * L * 0.5 + lado[1] * off, 0.004];
  const ang = Math.atan2(d[1], d[0]) - PI / 2;
  return (
    <mesh position={c} rotation={[0, 0, ang]}>
      <planeGeometry args={[W, L]} />
      <meshStandardMaterial map={reguaTex()} transparent opacity={op} roughness={0.6} />
    </mesh>
  );
};
function regen(t: number, humano = false) {
  const LP = LP_REG(t);
  return (
    <>
      {varanda(t)}
      <Lag {...LP} />
      {!humano ? <ReguaMM LP={LP} op={prog(t, S("gambiarra") + 0.1, S("gambiarra") + 0.5)} /> : null}
      {humano ? <HumanoAzul t={t} position={[-0.75, 0, 1.1]} rotation={[0, 0.35, 0]} cabelo={1 + 1.5 * prog(t, w("gambiarra", "tres") + 0.2, w("gambiarra", "mas") - 0.3)} cabeca={[0.3, -0.35]} bracoD={{ ombro: [0.3, 0, 0.1], cotovelo: 0.4 }} bracoE={{ ombro: [0.3, 0, 0.1], cotovelo: 0.4 }} /> : null}
    </>
  );
}
// cano de cartilagem: ANTES (rabo original, ossinhos + linhas de quebra) × AGORA (cano liso, sem ossinho)
const ANTES_POS: V3 = [REG_POS[0] - 0.24, REG_POS[1], 0];
function gambiarra(t: number, comparar: boolean) {
  const scan = prog(t, w("gambiarra", "mas") - 0.1, w("gambiarra", "diferente") + 0.4);
  const falha = prog(t, w("gambiarra", "proxima"), w("gambiarra", "vez")) * (1 - prog(t, w("gambiarra", "vez") + 0.4, w("gambiarra", "vai")));
  const LP = LP_REG(t, { cabeca: [0.25, 0.05], rabo: 0 });
  return (
    <>
      {varanda(t)}
      <Lag {...LP} raioX={{ ate: scan, tracejados: 1, falha, semMusculo: true }} />
      {comparar ? <Lag t={t} position={ANTES_POS} rotation={REG_ROT} rabo={0} cabeca={[0.25, 0.05]} raioX={{ ate: scan, tracejados: 11, semMusculo: true }} /> : null}
    </>
  );
}
// ---------- insetos ATRAÍDOS pela luz (a partir de "custa comida"): nascem fora do quadro e entram voando ----------
const T_ATRAI = () => w("rodizio", "rabo") + 0.1;
const N_ATR = 6;
const ATR_ORB = 0.22;
const atrSpawn = (i: number) => T_ATRAI() + i * 0.62;
const ATR_INI: V3[] = [[-1.1, 4.3, 0.26], [1.4, 4.6, 0.25], [-1.0, 3.6, 0.26], [1.3, 4.85, 0.26], [-1.2, 4.75, 0.24], [1.5, 4.4, 0.26]];
const atrPos = (t: number, i: number): V3 | null => {
  const t0 = atrSpawn(i);
  if (t < t0) return null;
  const k = prog(t, t0, t0 + 1.6, (x) => x);
  const orb = orbitaInseto(t, 40 + i, ATR_ORB);
  if (k >= 1) return orb;
  const a = ATR_INI[i];
  const c: V3 = [(a[0] + orb[0]) / 2, Math.max(a[1], orb[1]) + 0.25, 0.26];
  const u = sm(k);
  const q = (A: number, B: number, C: number) => (1 - u) * (1 - u) * A + 2 * (1 - u) * u * B + u * u * C;
  return [q(a[0], c[0], orb[0]), q(a[1], c[1], orb[1]), q(a[2], c[2], orb[2])];
};
// presas (índice → instante em que entra na boca); a caça desenha a presa na aproximação
const PRESAS = (): [number, number][] => [[0, w("rodizio", "vira") + 0.1], [1, w("vassoura", "janta") + 0.1], [2, w("final", "limpa") + 0.1]];
const Atraidas: React.FC<{ t: number }> = ({ t }) => {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < N_ATR; i++) {
    const pr = PRESAS().find(([j]) => j === i);
    if (pr && t >= pr[1] - 1.1) continue;
    const p = atrPos(t, i), p2 = atrPos(t + 0.05, i);
    if (!p || !p2) continue;
    els.push(<Mariposa key={i} t={t + i * 0.21} position={p} rotation={[0, Math.atan2(p2[0] - p[0], p2[2] - p[2]), 0]} escala={0.65 + 0.08 * (i % 3)} />);
  }
  return <>{els}</>;
};
// caça na lâmpada: uma mariposa atraída sai da órbita e vem de frente para a boca
const CACA_POS: V3 = [0.36, 3.72, 0];
const CACA_ROT = rotP(-0.35);
const CAB_CACA: V3 = (() => pontaMundo({ t: 0, position: CACA_POS, rotation: rotP(-0.35), cabeca: [-0.2, 0.12] }, -1.0))();
const cabecaMundo = (LP: LagartixaProps) => pontaMundo(LP, -1.3);
function caca(t: number, tPega: number, presa: number) {
  // a mariposa vem pousar a ~4 cm do focinho; ela vira a cabeça, abre a boca e dá o bote (avança 2,5 cm em 0,15 s)
  const lunge = prog(t, tPega - 0.15, tPega) * (1 - prog(t, tPega + 0.2, tPega + 0.7));
  const dir: V3 = [Math.sin(-0.35), Math.cos(-0.35), 0];
  const pos: V3 = [CACA_POS[0] + dir[0] * 0.05 * lunge, CACA_POS[1] + dir[1] * 0.05 * lunge, 0];
  const LP: LagartixaProps = { t, position: pos, rotation: CACA_ROT, rabo: 0.15, ...caudaEm(t) };
  const mira = prog(t, tPega - 1.2, tPega - 0.4);
  const abre = prog(t, tPega - 0.35, tPega - 0.1) * (1 - prog(t, tPega - 0.02, tPega + 0.06));
  const mastiga = t > tPega + 0.06 ? 0.22 * Math.max(0, Math.sin((t - tPega) * 2 * PI * 2.2)) * (1 - prog(t, tPega + 1.6, tPega + 2.0)) : 0;
  const LPb = { ...LP, cabeca: [mix(0.1, -0.2, mira), 0.12 * mira] as [number, number], curva: -0.2 * lunge, boca: Math.max(0.75 * abre, mastiga) };
  const pegou = t >= tPega;
  const LP0 = { ...LP, position: CACA_POS, cabeca: [-0.2, 0.12] as [number, number] };
  const boca0 = cabecaMundo(LP0);
  const voo = atrPos(t, presa) ?? orbitaInseto(t, 40 + presa, ATR_ORB);
  const k = prog(t, tPega - 1.1, tPega - 0.35);
  // chega e paira na frente do focinho (sem atravessar a cabeça)
  const frente: V3 = [boca0[0] + dir[0] * 0.08, boca0[1] + dir[1] * 0.08, 0.03];
  const bocaAgora = cabecaMundo(LPb);
  const pm = mixV(mixV(voo, frente, sm(k)), [bocaAgora[0] + dir[0] * 0.01, bocaAgora[1] + dir[1] * 0.01, 0.02], prog(t, tPega - 0.12, tPega)); // no bote a presa encontra a boca (sem pulo)
  // engole: a mariposa vai entrando na boca e diminuindo (sem sumir de uma vez)
  const engole = prog(t, tPega + 0.5, tPega + 1.6);
  return (
    <>
      {varanda(t)}
      <Lag {...LPb} naBoca={pegou && engole < 1 ? <group scale={1 / CM} position={[0, 0, -1.4 * engole]} rotation={[0.3, 0, 1.2]}><Mariposa t={t} bater={0.25 + 0.1 * Math.sin(t * 9)} escala={0.65 * (1 - 0.85 * engole)} /></group> : undefined} />
      {!pegou && t >= tPega - 1.1 ? <Mariposa t={t} position={pm} rotation={[0, 0.5, 0]} escala={0.65} /> : null}
    </>
  );
}
// rodízio: o filhote sobe; a adulta vira e avança; ele dá meia-volta, ela morde o rabo dele; o rabo solta e ele foge de toco;
// ela fica com o rabo mexendo na boca
const FIL_J: V3 = [0.6, 3.42, 0];
const ANG_FOGE = PI - 0.75; // para baixo-direita
const filhoteLP = (t: number): LagartixaProps => {
  const tVira = w("rodizio", "mas") - 0.05;
  const tSolta = w("rodizio", "rabo", 1) - 0.05;
  const sobe = trajeto([[FIL_J[0] + 0.12, FIL_J[1] - 0.35], [FIL_J[0] + 0.05, FIL_J[1] - 0.15], [FIL_J[0], FIL_J[1]]], t, w("rodizio", "e") - 0.4, w("rodizio", "filhote"), 2.2);
  const angSobe = sobe.ang;
  const vira = prog(t, tVira, tVira + 0.35);
  const foge = trajeto([[FIL_J[0], FIL_J[1]], [FIL_J[0] + Math.sin(ANG_FOGE) * 0.2, FIL_J[1] + Math.cos(ANG_FOGE) * 0.2], [FIL_J[0] + Math.sin(ANG_FOGE) * 0.42, FIL_J[1] + Math.cos(ANG_FOGE) * 0.42]], t, tSolta + 0.15, tSolta + 3.0, 2.2);
  const fugindo = t > tSolta + 0.15;
  const marca = prog(t, tSolta - 0.5, tSolta - 0.3) * (1 - prog(t, tSolta - 0.05, tSolta + 0.25));
  const pos = fugindo ? foge.pos : sobe.pos;
  const ang = fugindo ? ANG_FOGE : mix(angSobe, ANG_FOGE, sm(vira));
  return { t, filhote: true, position: pos, rotation: rotP(ang), andar: fugindo ? foge.andando : sobe.andando, correr: fugindo ? 1 : 0, dist: fugindo ? foge.dist : sobe.dist, soltar: t >= tSolta ? { anel: 4, pedaco: false } : undefined, cabeca: [0, 0], marca: { anel: 4, op: marca } };
};
// boca da adulta tem de chegar na ponta do rabo do filhote (já virado para fugir)
const ADULTA_BOTE = (() => {
  const tVira = w("rodizio", "mas") - 0.05;
  const J = filhoteLP(tVira + 0.4);
  const ponta = localParaMundo(pontoColuna(J, 8.8), J.position, J.rotation, 0.5);
  const A0: LagartixaProps = { t: 0, position: [0, 0, 0], rotation: rotP(ANG_FOGE) };
  const m = pontaMundo(A0, -1.3);
  return [ponta[0] - m[0], ponta[1] - m[1], 0] as V3;
})();
const ADULTA_MEIO: V3 = [0.42, 3.62, 0];
const CAB_RODIZIO = (() => { const A = adultaLP(w("rodizio", "esse") + 0.5); return pontaMundo(A, -1.0); })();
function adultaLP(t: number): LagartixaProps {
  const tCaca = w("rodizio", "caca") - 0.1;
  const tMorde = w("rodizio", "ja") - 0.15;
  const tSolta = w("rodizio", "rabo", 1) - 0.05;
  const vira = prog(t, w("rodizio", "filhote") - 0.3, w("rodizio", "filhote") + 0.4);
  const avanca = prog(t, tCaca, tCaca + 0.6);
  const lunge = prog(t, tMorde - 0.3, tMorde);
  const p1 = mixV(CACA_POS, ADULTA_MEIO, sm(avanca));
  const pos = mixV(p1, ADULTA_BOTE, sm(lunge));
  const ang = mix(-0.35, ANG_FOGE, sm(vira));
  const anda = (avanca > 0 && avanca < 1) || (lunge > 0 && lunge < 1) ? 1 : 0;
  return {
    t, position: pos, rotation: rotP(ang), rabo: 0.1, ...caudaEm(t), andar: anda, correr: lunge > 0 && lunge < 1 ? 1 : 0, dist: (avanca * 6 + lunge * 6) * 0.5,
    cabeca: [0, -0.1 * lunge], curva: 0.15 * Math.sin(vira * PI),
    boca: t < tMorde ? 0.55 * lunge : 0.12 + 0.18 * Math.max(0, Math.sin((t - tSolta) * 2 * PI * 2.0)),
  };
}
const raboFilhoteNaBoca = (t: number) => (
  <group rotation={[0, PI + 0.5, 0.2]}>
    <RaboSolto t={t} anel={4} tSolta={w("rodizio", "rabo", 1) - 0.05} escala={32} apoiado={false} filhote amp={1.4} />
  </group>
);
function canibal(t: number) {
  const tSolta = w("rodizio", "rabo", 1) - 0.05;
  const A = adultaLP(t);
  const J = filhoteLP(t);
  return (
    <>
      {varanda(t)}
      <Lag {...A} naBoca={t >= tSolta ? raboFilhoteNaBoca(t) : undefined} />
      {t < tSolta + 3.2 ? <Lag {...J} /> : null}
    </>
  );
}
// África: da posição do bote ela anda até o lado do quadro (curva suave, sem girar aos saltos)
const AFR_FIM: V3 = [VAR.quadro.c[0] - VAR.quadro.w / 2 - 0.2, VAR.quadro.c[1] + 0.12, 0];
const AFR_PTS = (): [number, number][] => [[ADULTA_BOTE[0], ADULTA_BOTE[1]], [ADULTA_BOTE[0] + 0.12, ADULTA_BOTE[1] - 0.18], [AFR_FIM[0] - 0.05, AFR_FIM[1] + 0.12], [AFR_FIM[0], AFR_FIM[1]]];
function africa(t: number) {
  const t0 = S("africa") - 0.1, t1 = w("africa", "africa") + 0.6;
  const tr = trajeto(AFR_PTS(), t, t0, t1, 1.9);
  const a = mix(ANG_FOGE, tr.ang, sm(prog(t, t0, t0 + 0.5)));
  const ang = mix(a, PI * 0.5, sm(prog(t, t1, t1 + 0.6)));
  return (
    <>
      {varanda(t)}
      <Lag t={t} position={tr.pos} rotation={rotP(ang)} andar={tr.andando} dist={tr.dist} {...caudaEm(t)} rabo={0.2} cabeca={[0.3 * prog(t, w("africa", "brasil"), w("africa", "brasil") + 0.5), 0]} />
    </>
  );
}
// vassoura de palha: amarração em y = 0, cabo para +y (comprimento `cabo`), cerdas em leque para −y
const VassouraPalha: React.FC<{ cabo: number }> = ({ cabo }) => {
  const palha = useMemoLocal(() => new THREE.MeshStandardMaterial({ color: "#D8B65E", roughness: 0.85, emissive: new THREE.Color("#5A4618"), emissiveIntensity: 0.25 }));
  const madeiraM = useMemoLocal(() => new THREE.MeshStandardMaterial({ color: "#B88A52", roughness: 0.6 }));
  const fio = useMemoLocal(() => new THREE.MeshStandardMaterial({ color: "#C8322A", roughness: 0.5 }));
  const fios: React.ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const u = (i / 45) * 2 - 1, v = ((i * 7919) % 11) / 10 - 0.5;
    const ang = u * 0.42, L = 0.5 + 0.04 * Math.sin(i * 1.7);
    fios.push(
      <mesh key={i} material={palha} position={[Math.sin(ang) * L * 0.5 + u * 0.03, -Math.cos(ang) * L * 0.5, v * 0.05]} rotation={[0, 0, ang]}>
        <cylinderGeometry args={[0.009, 0.006, L, 4]} />
      </mesh>,
    );
  }
  return (
    <group>
      {fios}
      <mesh material={palha} position={[0, -0.06, 0]} scale={[0.09, 0.12, 0.05]}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
      {[0.0, -0.07].map((y) => (
        <mesh key={y} material={fio} position={[0, y, 0]}>
          <torusGeometry args={[0.085, 0.012, 6, 16]} />
        </mesh>
      ))}
      <mesh material={madeiraM} position={[0, cabo / 2, 0]}>
        <cylinderGeometry args={[0.022, 0.022, cabo, 10]} />
      </mesh>
    </group>
  );
};
// memo simples por chamada (componentes pequenos dentro do vídeo)
const MEMO = new Map<string, THREE.Material>();
let memoN = 0;
const useMemoLocal = (f: () => THREE.Material) => {
  const k = `m${memoN++ % 3}`;
  if (!MEMO.has(k)) MEMO.set(k, f());
  return MEMO.get(k)!;
};
// ângulos de ombro (pitch, yaw) para o braço reto apontar na direção d (no espaço do humano); lado −1 = direito
const mirarBraco = (d: V3, lado: 1 | -1): [number, number, number] => {
  const n = Math.hypot(d[0], d[1], d[2]);
  const p = Math.acos(Math.max(-1, Math.min(1, -d[1] / n)));
  const phi = Math.atan2(d[0], d[2]);
  return [p, phi * lado, 0];
};
// vassoura: o humano azul entra pela porta, ergue a vassoura de palha com os dois braços e varre a parede perto dela;
// ela corre para a lâmpada (as cerdas vêm atrás, sem encostar)
const HUM_V: V3 = [-0.55, 0, 1.2]; // à esquerda dela: a vassoura vem pelo lado livre, longe do quadro
function vassoura(t: number) {
  const P0 = VAR.porta;
  const entra = prog(t, S("vassoura") - 0.1, w("vassoura", "nojo") + 0.1);
  const tFoge0 = w("vassoura", "expulsa"), tFoge1 = w("vassoura", "vassoura") + 0.5;
  const pos: V3 = mixV([-0.95, 0, 1.6], HUM_V, sm(entra)); // entra pela esquerda da varanda
  void P0;
  const FUGA_V: [number, number][] = [[AFR_FIM[0], AFR_FIM[1]], [AFR_FIM[0] - 0.1, AFR_FIM[1] + 0.25], [CACA_POS[0] + 0.1, CACA_POS[1] - 0.05], [CACA_POS[0], CACA_POS[1]]];
  const fogeT = trajeto(FUGA_V, t, tFoge0, tFoge1, 4.5);
  const angL = t < tFoge0 ? PI * 0.5 : mix(PI * 0.5, fogeT.ang, sm(prog(t, tFoge0, tFoge0 + 0.25)));
  const angF = t > tFoge1 ? mix(fogeT.ang, -0.35, sm(prog(t, tFoge1, tFoge1 + 0.4))) : angL;
  // cerdas: alvo perto da lagartixa, seguindo com atraso (sempre ≥ 9 cm dela)
  const ergue = sm(prog(t, w("vassoura", "nojo") - 0.1, w("vassoura", "expulsa") - 0.1));
  const atras = trajeto(FUGA_V, t - 0.45, tFoge0, tFoge1, 4.5).pos;
  const varr = Math.sin(Math.max(0, t - tFoge0) * 2 * PI * 1.1) * 0.06;
  const alvo: V3 = t < tFoge0 ? [AFR_FIM[0] - 0.2, AFR_FIM[1] - 0.04, 0.1] : [Math.min(0.46, atras[0] - 0.12 + varr), atras[1] - 0.15, 0.1];
  const repouso: V3 = [pos[0] + 0.35, 1.2, pos[2] + 0.1];
  const C = mixV(repouso, alvo, ergue);
  // o humano olha para a lagartixa
  const angH = Math.atan2(AFR_FIM[0] - pos[0], AFR_FIM[2] - pos[2]);
  const ang = mix(PI / 2, angH, sm(prog(t, S("vassoura") + 0.2, w("vassoura", "nojo"))));
  const toLocal = (v: V3): V3 => { const c = Math.cos(-ang), s2 = Math.sin(-ang); return [v[0] * c + v[2] * s2, v[1], -v[0] * s2 + v[2] * c]; };
  const toWorld = (v: V3): V3 => { const c = Math.cos(ang), s2 = Math.sin(ang); return [v[0] * c + v[2] * s2 + pos[0], v[1] + pos[1], -v[0] * s2 + v[2] * c + pos[2]]; };
  const ombD = toWorld([-0.42, 2.85, 0]), ombE = toWorld([0.42, 2.85, 0]);
  const dD: V3 = [C[0] - ombD[0], C[1] - ombD[1], C[2] - ombD[2]];
  const nD = Math.hypot(...dD);
  const u: V3 = [dD[0] / nD, dD[1] / nD, dD[2] / nD];
  const RE = 0.8; // braço um pouco dobrado
  const mao: V3 = [ombD[0] + u[0] * RE, ombD[1] + u[1] * RE, ombD[2] + u[2] * RE];
  const L = Math.max(0.15, nD - RE - 0.5); // da mão até a amarração das cerdas
  const B: V3 = [C[0] - u[0] * 0.5, C[1] - u[1] * 0.5, C[2] - u[2] * 0.5];
  const qv = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-u[0], -u[1], -u[2]));
  const eu = new THREE.Euler().setFromQuaternion(qv);
  const maoE: V3 = [mao[0] + u[0] * 0.35, mao[1] + u[1] * 0.35, mao[2] + u[2] * 0.35];
  const bD = mirarBraco(toLocal([mao[0] - ombD[0], mao[1] - ombD[1], mao[2] - ombD[2]]), -1);
  const bE = mirarBraco(toLocal([maoE[0] - ombE[0], maoE[1] - ombE[1], maoE[2] - ombE[2]]), 1);
  const solto: [number, number, number] = [0.15, 0, 0.08];
  return (
    <>
      {varanda(t, { semVassoura: true })}
      <HumanoAzul t={t} position={pos} rotation={[0, ang, 0]} andar={entra > 0 && entra < 1 ? 1 : 0} fase={entra * 2.5} cabeca={[0, 0.3 * ergue]} bracoD={{ ombro: [mix(solto[0], bD[0] + 0.2, ergue), mix(0, bD[1], ergue), 0.04], cotovelo: mix(0.3, 0.45, ergue) }} bracoE={{ ombro: [mix(solto[0], bE[0] + 0.2, ergue), mix(0, bE[1], ergue), 0.04], cotovelo: mix(0.3, 0.5, ergue) }} />
      {ergue > 0.02 ? (
        <group position={B} rotation={[eu.x, eu.y, eu.z]}>
          <group scale={[1, 1, 1]}>
            <VassouraPalha cabo={L + 0.7} />
          </group>
        </group>
      ) : null}
      <Lag t={t} position={t < tFoge0 ? AFR_FIM : fogeT.pos} rotation={rotP(angF)} andar={fogeT.andando} correr={1} dist={fogeT.dist} {...caudaEm(t)} rabo={0} />
    </>
  );
}

// câmera da fuga: acompanha o trajeto (amostrado a cada 0,2 s), com a lagartixa no terço de cima
const FUGA_PTS: [number, number][] = [[0.3, 1.74], [0.42, 2.4], [0.5, 3.1], [0.42, 3.86]];
const camFuga = (): LKey[] => {
  const t0 = w("gancho", "sobreviver") + 0.2, t1 = w("nome", "lagartixa") + 0.3;
  const ks: LKey[] = [];
  for (let t = t0 - 0.2; t <= t1 + 0.45; t += 0.2) {
    const tr = trajeto(FUGA_PTS, t, t0, t1);
    const y = Math.max(1.7, tr.pos[1] + 0.06);
    ks.push({ t, pos: [tr.pos[0] + 0.2, y - 0.05, 0.6], look: [tr.pos[0], y, 0], fov: 42, lin: true });
  }
  return ks;
};
// ---------- câmeras-base ----------
const C_Q0 = { pos: [0.43, 1.68, 0.6] as V3, look: [0.31, 1.72, 0.02] as V3, fov: 43 };
const C_PLIC = (() => {
  const LP = L0(0);
  const a = pontaMundo(LP, sAnel(ANEL)), b = pontaMundo(LP, 9.6);
  const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0];
  return { pos: [m[0] + 0.12, m[1] - 0.02, 0.3] as V3, look: [m[0] - 0.005, m[1], 0.01] as V3, fov: 34 };
})();
const C_NOME = { pos: cm(LAMP_L, 14, 4, 26) as V3, look: cm(LAMP_L, 1, 3, 0) as V3, fov: 34 };
const C_TETO = { pos: [QX + 0.02, VAR.teto - 0.42, 1.0] as V3, look: [QX, VAR.teto, 0.72] as V3, fov: 44 }; // lagartixa no terço de baixo, lupa grande em cima
const C_REG = { pos: cm(REG_POS, 2, -3.5, 36) as V3, look: cm(REG_POS, 0.5, -3, 0) as V3, fov: 36 };
const C_CMP = { pos: [REG_POS[0] - 0.12, REG_POS[1] - 0.06, 1.0] as V3, look: [REG_POS[0] - 0.12, REG_POS[1] - 0.06, 0] as V3, fov: 40 };
const C_CANO = { pos: cm(REG_POS, 3, -5, 15) as V3, look: cm(REG_POS, 1.2, -4.5, 0) as V3, fov: 36 };
const C_LADO = { pos: cm(REG_POS, -6, -9, 24) as V3, look: cm(REG_POS, 1.5, -5, 0) as V3, fov: 40 };
const C_LADO2 = { pos: cm(REG_POS, -4, -2, 14) as V3, look: cm(REG_POS, 0.8, -2.2, 0) as V3, fov: 38 };
const C_CACA = { pos: [0.52, 3.9, 0.82] as V3, look: [0.25, 3.86, 0] as V3, fov: 44 };

// ---------- planos ----------
const tPlic = w("gancho", "para") + 0.1;
export const PLANS: Plan[] = [
  // gancho
  P(0, w("gancho", "rabo"), { keys: mov(0, w("gancho", "rabo"), C_Q0.pos, C_Q0.look, cm(C_Q0.pos, -3, 1, -6), C_Q0.look, C_Q0.fov), scene: (t) => abertura(t, t) }),
  P(w("gancho", "rabo"), w("gancho", "sobreviver") + 0.2, { keys: fixa(0, 99, C_PLIC.pos, C_PLIC.look, C_PLIC.fov), scene: (t) => soltura(t, T_SOLTA()) }),
  P(w("gancho", "sobreviver") + 0.2, w("nome", "lagartixa") + 0.5, { keys: camFuga(), scene: (t) => fuga(t, w("gancho", "sobreviver") + 0.2, w("nome", "lagartixa") + 0.3) }),
  // nome: a varanda aparece (lâmpada, forro, insetos) e depois aproxima na cabeça
  P(w("nome", "lagartixa") + 0.5, w("nome", "hemidactylus"), { keys: mov(w("nome", "lagartixa") + 0.5, w("nome", "hemidactylus"), [0.95, 3.75, 1.25], [0.25, 3.98, 0], [0.85, 3.8, 1.05], [0.28, 3.96, 0], 44), scene: (t) => nome(t) }),
  P(w("nome", "hemidactylus"), S("solta"), { keys: mov(w("nome", "hemidactylus"), S("solta"), cm(LAMP_L, 16, 9, 28), cm(LAMP_L, 1, 7, 0), cm(LAMP_L, 13, 9, 23), cm(LAMP_L, 1, 7, 0), 36), scene: (t) => nome(t) }),
  // solta (replay)
  P(S("solta"), w("solta", "voce", 1), { keys: mov(S("solta"), w("solta", "voce", 1), [0.95, 1.5, 0.62], [0.2, 1.58, 0.02], [0.88, 1.52, 0.55], [0.2, 1.6, 0.02], 40), scene: (t) => replay(t, S("solta")) }),
  P(w("solta", "voce", 1), w("solta", "e"), { keys: fixa(0, 99, C_PLIC.pos, C_PLIC.look, C_PLIC.fov), scene: (t) => soltura(t, w("solta", "solta") + 0.05) }),
  P(w("solta", "e"), S("duble"), { keys: mov(w("solta", "e"), S("duble"), [VIT[0] + 0.72, 2.2, VIT[2] + 3.4], [VIT[0] + 0.72, 1.95, VIT[2] + 0.3], [VIT[0] + 0.72, 2.2, VIT[2] + 3.35], [VIT[0] + 0.72, 1.95, VIT[2] + 0.35], 80), scene: (t) => ladrao(t) }),
  // dublê: o pedaço cai no banco (plano aberto), depois close
  P(S("duble"), w("duble", "pula") - 0.25, { keys: [
    { t: S("duble"), pos: [0.85, 1.5, 1.05], look: [0.2, 1.4, 0.05], fov: 44 },
    { t: T_QUEDA() + 0.05, pos: [0.85, 1.48, 1.0], look: [0.24, 1.34, 0.05], fov: 44 },
    { t: T_QUEDA() + 0.9, pos: [0.86, 1.13, 0.55], look: [0.56, 0.97, 0.17], fov: 40 },
    { t: 99, pos: [0.84, 1.11, 0.52], look: [0.57, 0.96, 0.17], fov: 40 },
  ], scene: (t) => queda(t) }),
  P(w("duble", "pula") - 0.25, w("duble", "num"), { keys: fixa(0, 99, cm(RB, 7, 5, 19), cm(RB, -2, 1.2, 3), 36), scene: (t) => (<>{varanda(t)}{raboBanco(t)}{gatoQueda(t)}</>) }),
  P(w("duble", "num"), w("duble", "mexeu"), { keys: mov(w("duble", "num"), w("duble", "mexeu"), cm(RB, -3, 2.5, 21), cm(RB, -2, 1, 3), cm(RB, -2, 2.5, 18), cm(RB, -2, 1, 3), 34), scene: (t) => (<>{varanda(t)}{raboBanco(t)}{gatoQueda(t)}</>) }),
  P(w("duble", "mexeu"), w("duble", "um"), { keys: mov(w("duble", "mexeu"), w("duble", "um"), cm(RB, 8, 3.5, 12), cm(RB, -2, 1, 3), cm(RB, 7, 3.2, 10.5), cm(RB, -2, 1, 3), 34), scene: (t) => (<>{varanda(t)}{raboBanco(t)}{gatoQueda(t)}</>) }),
  P(w("duble", "um"), w("duble", "por", 1), { keys: mov(w("duble", "um"), w("duble", "por", 1), [1.05, 1.5, 1.65], [0.38, 1.15, 0.2], [1.0, 1.48, 1.55], [0.4, 1.14, 0.2], 46), scene: (t) => (<>{varanda(t)}{raboBanco(t)}{gatoQueda(t)}</>) }),
  P(w("duble", "por", 1), w("duble", "e", 1), { keys: mov(w("duble", "por", 1), w("duble", "e", 1), [1.2, 1.48, 1.15], [0.42, 1.2, 0.15], [1.1, 1.5, 1.08], [0.42, 1.24, 0.15], 50), scene: (t) => dubleMordida(t) }),
  P(w("duble", "e", 1), w("duble", "esse"), { keys: mov(w("duble", "e", 1), w("duble", "esse"), [-0.05, 4.68, 0.85], [-0.28, 4.8, 0], [-0.12, 4.75, 0.78], [-0.36, 4.88, 0], 44), scene: (t) => some(t, w("duble", "e", 1) - 0.1, w("duble", "esse") - 0.2) }),
  P(w("duble", "esse"), S("picote"), { keys: mov(w("duble", "esse"), S("picote"), [1.4, 1.62, 1.15], [0.6, 1.38, 0.2], [1.3, 1.6, 1.05], [0.62, 1.4, 0.2], 40), scene: (t) => gatoMastiga(t) }),
  // picote (raio-x no rabo da própria cena)
  P(S("picote"), w("picote", "musculo") - 0.2, { keys: mov(S("picote"), w("picote", "musculo") - 0.2, cm(LZ0, 6, -2, 22), cm(LZ0, -1, -2.5, 0), cm(LZ0, 4, -3, 15), cm(LZ0, -1.5, -3, 0), 34), scene: (t) => raioX(t) }),
  P(w("picote", "musculo") - 0.2, S("teto"), { keys: mov(w("picote", "musculo") - 0.2, S("teto"), cm(LZ0, 2, -3.5, 9), cm(LZ0, -1.5, -3.5, 0), cm(LZ0, 3, -3.3, 12), cm(LZ0, -1.5, -3.3, 0), 32), scene: (t) => raioX(t) }),
  // teto
  P(S("teto"), w("teto", "seus"), { keys: mov(S("teto"), w("teto", "seus"), [QX + 0.3, 4.55, 0.8], [QX, 4.98, 0.12], [QX + 0.25, 4.62, 0.75], [QX, 5.05, 0.18], 46), scene: (t) => teto(t, S("teto") - 0.3, w("teto", "seus") + 0.2) }),
  P(w("teto", "seus"), S("gambiarra"), { keys: fixa(0, 99, C_TETO.pos, C_TETO.look, C_TETO.fov), scene: (t) => noTeto(t, prog(t, w("teto", "seus"), w("teto", "dedos") + 0.2)) }),
  // gambiarra
  P(S("gambiarra"), w("gambiarra", "tres"), { keys: mov(S("gambiarra"), w("gambiarra", "tres"), C_REG.pos, C_REG.look, cm(C_REG.pos, 0, -1, -4), C_REG.look, C_REG.fov), scene: (t) => regen(t) }),
  P(w("gambiarra", "tres"), w("gambiarra", "mas"), { keys: mov(w("gambiarra", "tres"), w("gambiarra", "mas"), [0.05, 2.0, 4.05], [-0.05, 1.85, 0.6], [0.1, 2.0, 3.95], [0.0, 1.85, 0.6], 68), scene: (t) => regen(t, true) }),
  P(w("gambiarra", "mas"), w("gambiarra", "cano"), { keys: mov(w("gambiarra", "mas"), w("gambiarra", "cano"), C_CMP.pos, C_CMP.look, cm(C_CMP.pos, 0, 0, -6), C_CMP.look, C_CMP.fov), scene: (t) => gambiarra(t, true) }),
  P(w("gambiarra", "cano"), w("gambiarra", "sem"), { keys: mov(w("gambiarra", "cano"), w("gambiarra", "sem"), C_CANO.pos, C_CANO.look, cm(C_CANO.pos, 0, 0, -3), C_CANO.look, C_CANO.fov), scene: (t) => gambiarra(t, false) }),
  P(w("gambiarra", "sem"), w("gambiarra", "da"), { keys: mov(w("gambiarra", "sem"), w("gambiarra", "da"), cm(REG_POS, 7, -5, 8.5), cm(REG_POS, 1.2, -4.6, 0), cm(REG_POS, 6, -5.5, 7.5), cm(REG_POS, 1.2, -5, 0), 34), scene: (t) => gambiarra(t, false) }),
  P(w("gambiarra", "da"), w("gambiarra", "mais", 2) - 0.1, { keys: fixa(0, 99, C_LADO.pos, C_LADO.look, C_LADO.fov), scene: (t) => gambiarra(t, false) }),
  P(w("gambiarra", "mais", 2) - 0.1, w("gambiarra", "esse"), { keys: fixa(0, 99, C_LADO2.pos, C_LADO2.look, C_LADO2.fov), scene: (t) => gambiarra(t, false) }),
  P(w("gambiarra", "esse"), S("rodizio"), { keys: mov(w("gambiarra", "esse"), S("rodizio"), C_REG.pos, C_REG.look, cm(REG_POS, 2, -3.5, 17), cm(REG_POS, 1, -3.5, 0), C_REG.fov), scene: (t) => gambiarra(t, false) }),
  // rodízio
  P(S("rodizio"), w("rodizio", "vira") - 0.45, { keys: mov(S("rodizio"), w("rodizio", "vira") - 0.45, [0.58, 3.9, 1.05], [0.24, 3.88, 0], C_CACA.pos, C_CACA.look, 44), scene: (t) => caca(t, w("rodizio", "vira") + 0.1, 0) }),
  P(w("rodizio", "vira") - 0.45, w("rodizio", "e"), { keys: fixa(0, 99, cm(CAB_CACA, 5, -4, 15), cm(CAB_CACA, -0.5, 1, 0), 36), scene: (t) => caca(t, w("rodizio", "vira") + 0.1, 0) }),
  P(w("rodizio", "e"), w("rodizio", "esse"), { keys: [
    { t: w("rodizio", "e"), pos: [0.6, 3.44, 0.9], look: [0.5, 3.48, 0], fov: 44 },
    { t: w("rodizio", "ja") - 0.6, pos: [0.6, 3.44, 0.82], look: [0.5, 3.46, 0], fov: 44 },
    { t: w("rodizio", "ja") + 0.2, pos: cm(ADULTA_BOTE, 9, -10, 50), look: cm(ADULTA_BOTE, 4, -7, 0), fov: 42 },
    { t: 99, pos: cm(ADULTA_BOTE, 9, -10, 50), look: cm(ADULTA_BOTE, 4, -7, 0), fov: 42 },
  ], scene: (t) => canibal(t) }),
  P(w("rodizio", "esse"), S("africa"), { keys: fixa(0, 99, cm(CAB_RODIZIO, 7, -3, 24), cm(CAB_RODIZIO, 2, -3, 0), 36), scene: (t) => canibal(t) }),
  // África
  P(S("africa"), S("vassoura"), { keys: mov(S("africa"), S("vassoura"), [0.75, 3.35, 1.15], [0.6, 3.3, 0], [VAR.quadro.c[0] - 0.22, VAR.quadro.c[1] + 0.12, 1.05], [VAR.quadro.c[0] - 0.22, VAR.quadro.c[1] + 0.12, 0], 42, 40), scene: (t) => africa(t) }),
  // vassoura
  P(S("vassoura"), w("vassoura", "logo"), { keys: [
    { t: S("vassoura"), pos: [0.35, 2.55, 3.9], look: [0.0, 2.55, 0.6], fov: 58 },
    { t: w("vassoura", "nojo") + 0.2, pos: [0.4, 2.8, 3.4], look: [0.15, 2.85, 0.5], fov: 54 },
    { t: w("vassoura", "expulsa") + 0.1, pos: [0.55, 3.2, 1.75], look: [0.42, 3.28, 0], fov: 42 },
    { t: w("vassoura", "logo"), pos: [0.5, 3.35, 1.7], look: [0.4, 3.45, 0], fov: 42 },
  ], scene: (t) => vassoura(t) }),
  P(w("vassoura", "logo"), w("vassoura", "janta") - 0.5, { keys: mov(w("vassoura", "logo"), w("vassoura", "janta") - 0.5, [0.05, 3.7, 0.95], [0.3, 3.85, 0], [0.1, 3.75, 0.8], [0.3, 3.85, 0], 44), scene: (t) => caca(t, w("vassoura", "janta") + 0.1, 1) }),
  P(w("vassoura", "janta") - 0.5, S("final"), { keys: fixa(0, 99, cm(CAB_CACA, -6, -3, 15), cm(CAB_CACA, 0.5, 1, 0), 36), scene: (t) => caca(t, w("vassoura", "janta") + 0.1, 1) }),
  // final (recap) — cada flash roda uma cena já vista com o relógio dela
  P(S("final"), w("final", "deixa"), { keys: fixa(0, 99, cm(LZ0, 2.5, -3.4, 10.5), cm(LZ0, -1.5, -3.4, 0), 32), scene: (t) => raioX(t - S("final") + w("picote", "osso") - 0.4) }),
  P(w("final", "deixa"), w("final", "anda"), { keys: fixa(0, 99, [1.3, 1.6, 1.05], [0.62, 1.4, 0.2], 40), scene: (t) => gatoMastiga(t - w("final", "deixa") + w("duble", "esse")) }),
  P(w("final", "anda"), w("final", "faz"), { keys: fixa(0, 99, C_TETO.pos, C_TETO.look, C_TETO.fov), scene: (t) => noTeto(t - w("final", "anda") + w("teto", "seus"), prog(t, w("final", "anda"), w("final", "faz"))) }),
  P(w("final", "faz"), w("final", "e"), { keys: fixa(0, 99, C_REG.pos, C_REG.look, C_REG.fov), scene: (t) => regen(t - w("final", "faz") + w("gambiarra", "rabo")) }),
  P(w("final", "e"), w("final", "voce", 1), { keys: fixa(0, 99, C_CACA.pos, C_CACA.look, C_CACA.fov), scene: (t) => caca(t, w("final", "limpa") + 0.1, 2) }),
  // último quadro = primeiro: a abertura roda com u = t − FIM (em FIM, u = 0)
  P(w("final", "voce", 1), FIM + 1 / FPS, { keys: [{ t: 0, pos: C_Q0.pos, look: C_Q0.look, fov: C_Q0.fov }], scene: (t) => abertura(t - FIM, t - FIM) }),
];
// a câmera do último plano é a do 1º quadro (fixa)

// legenda: o apelido ("Esse é seu ___") todo em amarelo
const WORDS: Word[] = TL.cenas.flatMap((c) => {
  const ws = c.words.map((x) => ({ ...x, s: x.s + OFF, e: x.e + OFF }));
  if (!c.label) return ws;
  return ws;
});

const Plano: React.FC<{ p: Plan }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = p.from + f / fps;
  return (
    <AbsoluteFill>
      <PalcoNoite exposure={p.exp ?? 1.05}>
        <LagCam t={t} keys={p.keys} />
        {p.scene(t)}
      </PalcoNoite>
      {p.over ? p.over(t) : null}
    </AbsoluteFill>
  );
};
// âncora da lupa: projeta o dedo da frente (no forro) na tela
const telaDe = (pt: V3, k: { pos: V3; look: V3; fov: number }): [number, number] => {
  const cam = new THREE.PerspectiveCamera(k.fov, 1080 / 1920, 0.01, 60);
  cam.position.set(...k.pos);
  cam.lookAt(new THREE.Vector3(...k.look));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const v = new THREE.Vector3(...pt).project(cam);
  return [(v.x + 1) * 540, (1 - v.y) * 960];
};
const PX_ANTES = telaDe(localParaMundo([0, 0, -8], ANTES_POS, REG_ROT), C_CMP).map((v, i) => (i ? v - 40 : v)) as [number, number];
const PX_AGORA = telaDe(localParaMundo([0, 0, -8], REG_POS, REG_ROT), C_CMP).map((v, i) => (i ? v - 40 : v)) as [number, number];
const PX_FALHA = telaDe(pontaMundo({ t: 0, position: REG_POS, rotation: REG_ROT, rabo: 0 }, sAnel(ANEL) + 2.0), C_LADO);
const PX_PLANO = telaDe(pontaMundo({ t: 0, position: REG_POS, rotation: REG_ROT, rabo: 0 }, sAnel(3)), C_LADO2);
const PX_FALHA2 = telaDe(pontaMundo({ t: 0, position: REG_POS, rotation: REG_ROT, rabo: 0 }, sAnel(ANEL) + 2.0), C_LADO2);
const DEDO_TETO = telaDe(localParaMundo([1.3, 0, 3.9], [TETO_POS[0], TETO_POS[1], TETO_POS[2] + 0.05], TETO_ROT), C_TETO);
void amostraCam;
void PX_FALHA2;
void TRONCO;

export const Lagartixa: React.FC = () => {
  useKitFont();
  const fps = FPS;
  const tLupa = w("teto", "dedos");
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#0B1020" }}>
        {PLANS.map((p, i) => (
          <Sequence key={i} from={Math.round(p.from * fps)} durationInFrames={Math.max(1, Math.round(p.to * fps) - Math.round(p.from * fps))} layout="none">
            <Plano p={p} />
          </Sequence>
        ))}
        {/* lupa do dedo no teto (picture-in-picture) */}
        <Sequence from={Math.round(tLupa * fps)} durationInFrames={Math.round((S("gambiarra") - tLupa) * fps)} layout="none">
          <LupaSeq t0={tLupa} />
        </Sequence>
        {/* cabeçalhos e números */}
        <NumeroTopo de={w("gancho", "sobreviver") + 0.2} ate={S("solta")} numero="Lagartixa-de-parede" sub="Hemidactylus mabouia" tamanho={84} />
        <Etiqueta de={S("solta")} ate={w("solta", "e")} texto="REPLAY · CÂMERA LENTA" y={560} />
        <NumeroTopo de={w("solta", "nao")} ate={w("solta", "voce", 1)} numero="NÃO PUXA" tamanho={120} />
        <NumeroTopo de={w("solta", "solta")} ate={w("solta", "e")} numero="SOLTA" tamanho={140} corNumero="#FFD21F" />
        <NumeroTopo de={w("solta", "e")} ate={S("duble")} numero="SE FOSSE VOCÊ" tamanho={110} />
        <NumeroTopo de={w("duble", "meia") - 0.3} ate={w("duble", "um")} numero="ATÉ 30 MIN" sub="gecko-leopardo, seu primo" tamanho={120} />
        <Relogio de={w("duble", "meia") - 0.3} ate={w("duble", "um")} voltas={6} x={540} y={640} raio={86} />
        <Episodio de={w("duble", "um")} ate={w("duble", "por", 1)} />
        <NumeroTopo de={w("duble", "um")} ate={w("duble", "por", 1)} numero="1 EPISÓDIO" sub="inteiro de série" tamanho={120} />
        <Etiqueta de={S("final")} ate={w("final", "deixa")} texto="REPLAY" y={560} cor="#FFD21F" tamanho={56} />
        <Etiqueta de={S("picote")} ate={w("picote", "esse")} texto="REPLAY · COMO?" y={560} cor="#FFD21F" tamanho={56} />
        <NumeroTopo de={w("picote", "linha")} ate={w("picote", "o", 0)} numero="LINHA DE QUEBRA" tamanho={104} />
        <NumeroTopo de={w("picote", "musculo")} ate={w("picote", "esse")} numero="MÚSCULO APERTA" tamanho={104} />
        <NumeroTopo de={w("teto", "sem")} ate={w("teto", "fita")} numero="SEM COLA" tamanho={130} corNumero="#FF5A4E" />
        <Etiqueta de={w("gambiarra", "volta") - 0.2} ate={w("gambiarra", "tres")} texto="TEMPO ACELERADO" y={1480} />
        <ContaDias de={S("gambiarra")} ate={w("gambiarra", "tres")} />
        <NumeroTopo de={w("gambiarra", "mais")} ate={w("gambiarra", "tres")} numero="+1 MM/DIA" sub="no auge" tamanho={120} />
        <NumeroTopo de={w("gambiarra", "tres")} ate={w("gambiarra", "mas")} numero="3X" sub="cabelo de gente" tamanho={170} />
        <Barras3X de={w("gambiarra", "tres")} ate={w("gambiarra", "mas")} />
        <NumeroTopo de={w("gambiarra", "cano")} ate={w("gambiarra", "da")} numero="CANO DE CARTILAGEM" sub="sem ossinho · sem picote" tamanho={88} />
        <Etiqueta de={w("gambiarra", "mas") + 0.3} ate={w("gambiarra", "cano")} texto="ANTES" x={PX_ANTES[0]} y={PX_ANTES[1]} />
        <Etiqueta de={w("gambiarra", "mas") + 0.3} ate={w("gambiarra", "cano")} texto="AGORA" x={PX_AGORA[0]} y={PX_AGORA[1]} cor="#FFD21F" />
        <Xis de={w("gambiarra", "vez")} ate={w("gambiarra", "vai") + 0.3} x={PX_FALHA[0]} y={PX_FALHA[1]} />
        <Seta de={w("gambiarra", "mais", 2) - 0.1} ate={w("gambiarra", "esse")} x0={Math.min(1000, PX_PLANO[0] + 300)} y0={PX_PLANO[1] + 260} x1={PX_PLANO[0] + 40} y1={PX_PLANO[1] + 20} />
        <NumeroTopo de={w("gambiarra", "mais", 2)} ate={w("gambiarra", "esse")} numero="MAIS PERTO" sub="do corpo" tamanho={120} />
        <RotaAfrica de={w("africa", "africa") - 0.2} ate={S("vassoura")} />
        <Etiqueta de={w("africa", "provavelmente")} ate={w("africa", "e")} texto="provavelmente" y={1810} />
        <NumeroTopo de={w("africa", "quase")} ate={S("vassoura")} numero="~400 ANOS" sub="registro de ~1640" tamanho={120} />
        <NumeroTopo de={S("vassoura")} ate={S("vassoura") + 2.1} numero="DEIXA OU EXPULSA?" tamanho={96} />
        {/* apelidos */}
        <ApelidoAmarelo de={w("duble", "duble")} ate={S("picote")} texto="Dublê" />
        <ApelidoAmarelo de={w("picote", "picote")} ate={S("teto")} texto="Picote" />
        <ApelidoAmarelo de={w("teto", "fita")} ate={S("gambiarra")} texto="Fita dupla-face" tamanho={86} />
        <Sequence from={Math.round(w("teto", "essa") * FPS)} durationInFrames={Math.round((S("gambiarra") - w("teto", "essa")) * FPS)} layout="none">
          <FitaDuplaFace de={0} ate={S("gambiarra") - w("teto", "essa")} />
        </Sequence>
        <ApelidoAmarelo de={w("gambiarra", "rabo", 1)} ate={S("rodizio")} texto="Rabo de gambiarra" tamanho={82} />
        <ApelidoAmarelo de={w("rodizio", "rodizio")} ate={S("africa")} texto="Rodízio" />
        <Legenda1Palavra palavras={WORDS} />
        <Sequence from={Math.round(OFF * FPS)} layout="none">
          <Audio src={staticFile("lagartixa/narracao.wav")} />
        </Sequence>
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
// título que sempre cabe em ~88 % da largura (fonte 900 com contorno: ~0,72 × tamanho por letra)
const NumeroTopo: React.FC<React.ComponentProps<typeof NumeroTopoKit>> = (p) => {
  const txt = String(p.numero);
  const cabe = Math.floor(930 / (txt.length * 0.72));
  return <NumeroTopoKit {...p} tamanho={Math.min(p.tamanho ?? 150, cabe)} />;
};
// imagem de uma fita dupla-face: tira branca com o filme vermelho descascando (entra deslizando, sem piscar)
const FitaDuplaFace: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const dur = ate - de;
  const a = sm(clamp01(t / 0.35)) * (1 - sm(clamp01((t - (dur - 0.3)) / 0.3)));
  const pele = sm(clamp01((t - 0.3) / 0.6));
  if (t < 0 || t > dur) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity: a }}>
        <g transform={`translate(${mix(-500, 540, a)} 1660) rotate(-6)`}>
          <rect x={-360} y={-62} width={720} height={124} rx={10} fill="#F7F4EA" stroke="#2A2A2A" strokeWidth={6} />
          {Array.from({ length: 34 }).map((_, i) => (
            <circle key={i} cx={-340 + (i % 17) * 42} cy={i < 17 ? -24 : 24} r={7} fill="#DCD6C3" />
          ))}
          <path d={`M ${-360 + 720 * pele} -62 L 360 -62 L 360 62 L ${-360 + 720 * pele} 62 Z`} fill="#E8352B" stroke="#2A2A2A" strokeWidth={6} />
          <path d={`M ${-360 + 720 * pele} -62 Q ${-360 + 720 * pele - 90 * pele} -150 ${-360 + 720 * pele - 160 * pele} -120 L ${-360 + 720 * pele - 160 * pele} -10 Q ${-360 + 720 * pele - 80 * pele} -40 ${-360 + 720 * pele} 62 Z`} fill="#FF6B5A" stroke="#2A2A2A" strokeWidth={6} opacity={pele} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
// contador de dias (tempo acelerado do crescimento)
const ContaDias: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const n = Math.max(1, Math.round(mix(1, 40, prog(t, T_REG0(), T_REG1(), (x) => 1 - Math.pow(1 - x, 1.6)))));
  const a = sm(clamp01((t - de) / 0.3)) * (1 - sm(clamp01((t - (ate - 0.25)) / 0.25)));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 1550, width: "100%", textAlign: "center", opacity: a, fontFamily: "Inter, Arial Black, sans-serif", fontWeight: 900, fontSize: 64, color: "#FFFFFF", textShadow: "0 0 10px #000, 0 0 4px #000", fontVariantNumeric: "tabular-nums" }}>
        DIA {n}
      </div>
    </AbsoluteFill>
  );
};
// "1 episódio inteiro de série": tela de player com play e barra de episódio enchendo (fade, sem encolher)
const Episodio: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const a = sm(clamp01((t - de) / 0.3)) * (1 - sm(clamp01((t - (ate - 0.25)) / 0.25)));
  const k = clamp01((t - de) / (ate - de));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: a }}>
        <g transform="translate(540 650)">
          <rect x={-170} y={-100} width={340} height={200} rx={22} fill="#15171C" stroke="#FFFFFF" strokeWidth={8} />
          <path d="M -28 -48 L 42 0 L -28 48 Z" fill="#FFFFFF" />
          <rect x={-140} y={66} width={280} height={14} rx={7} fill="#4A4D55" />
          <rect x={-140} y={66} width={280 * k} height={14} rx={7} fill="#E8352B" />
          <circle cx={-140 + 280 * k} cy={73} r={13} fill="#E8352B" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
// 3x: barras grandes RABO × CABELO crescendo no centro (acima da legenda)
const Barras3X: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const a = sm(clamp01((t - de) / 0.3)) * (1 - sm(clamp01((t - (ate - 0.25)) / 0.25)));
  const k = sm(clamp01((t - de - 0.2) / (ate - de - 0.6)));
  const H = 560, base = 1130;
  const barra = (x: number, cor: string, alt: number, rot: string) => (
    <g transform={`translate(${x} ${base})`}>
      <rect x={-70} y={-H - 10} width={140} height={H + 10} rx={18} fill="rgba(20,22,27,0.55)" stroke="#FFFFFF" strokeWidth={5} />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={-70} x2={-40} y1={-i * (H / 6)} y2={-i * (H / 6)} stroke="#FFFFFF" strokeWidth={5} />
      ))}
      <rect x={-46} y={-alt} width={92} height={alt} rx={14} fill={cor} stroke="#14161B" strokeWidth={6} />
      <text x={0} y={70} textAnchor="middle" fontFamily="Inter, Arial Black, sans-serif" fontWeight={900} fontSize={54} fill={cor} stroke="#14161B" strokeWidth={10} paintOrder="stroke">{rot}</text>
    </g>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: a }}>
        {barra(330, "#FFD21F", H * 0.96 * k, "RABO")}
        {barra(750, "#8FD0FF", (H * 0.96 * k) / 3, "CABELO")}
      </svg>
    </AbsoluteFill>
  );
};
const LupaSeq: React.FC<{ t0: number }> = ({ t0 }) => {
  const f = useCurrentFrame();
  const t = t0 + f / FPS;
  const nivel = prog(t, w("teto", "pelinhos") - 0.2, w("teto", "pelinhos") + 0.4) + prog(t, w("teto", "sem") - 0.5, w("teto", "sem") + 0.1);
  const fecha = 1 - prog(t, w("teto", "essa") - 0.1, w("teto", "essa") + 0.3);
  return <LupaDedo t={t} abrir={prog(t, t0, t0 + 0.5) * fecha} nivel={nivel} cola={prog(t, w("teto", "sem"), w("teto", "nenhuma") + 0.3)} cx={540} cy={760} raio={290} ancora={DEDO_TETO} etapas={["", "", ""]} rotulo="" />;
};
void sm;
