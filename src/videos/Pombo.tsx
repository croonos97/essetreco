import { AbsoluteFill, Audio, getInputProps, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import timelineJson from "../../public/pombo/timeline.json";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import { AMARELO, ApelidoAmarelo, FONT_KIT, Legenda1Palavra, NumeroTopo as NumeroTopoKit, TINTA, useKitFont } from "../three/animais/ui";
import { Etiqueta } from "../three/animais/LagartixaTela";
import { HumanoAzul } from "../three/animais/LagartixaHumano";
import { LookAve, LookConcreto, LookPalco, TipoPlano } from "../three/look";
import { bocaLocal, matrizRaiz, pontaBicoLocal, pontoCabeca, PoseAve } from "../three/pombo/Ave";
import { Falcao, poseFalcao, poseFalcaoFreio, poseFalcaoMergulho, poseFalcaoVoo } from "../three/pombo/Falcao";
import { especieFilhote, Filhote, poseFilhoteDeitado, poseFilhotePedindo } from "../three/pombo/Filhote";
import { HomemPipoca, MeninoCrescendo, Pipoca, Vassoura, Zelador } from "../three/pombo/Humanos";
import { IconeGota } from "../three/pombo/IconeGota";
import { clamp01, HUMANO, LKey, mix, PomboCam, seg01, sm, V3 } from "../three/pombo/PomboComum";
import { andarPombo, Pombo, POMBO, poseAlimentar, poseArrulho, poseBicar, POSE_PARADO, poseVoo } from "../three/pombo/Pombo";
import { ANTENA_PAREDE_POUSO, AR, BANCO, FIO_POUSO, GAIOLA_AZULEJO, JANELA, MARQ, NINHO_Q, NINHO_Q_FUNDO, PORTA, Quarteirao } from "../three/pombo/Quarteirao";

// =====================================================================
// "Você bebe leite de macho." — filhote de pombo-doméstico (Columba livia). Kit: src/three/pombo/* (1 un = 1 cm).
// LOOK aprovado (src/three/look/*) em TODOS os planos: <LookPalco cena="marquise_dia" plano=close|medio|aberto>.
// Cenário único: o quarteirão (marquise, ar de janela com o ninho, calçada, rua, praça). Cada plano é cravado numa
// palavra da narração (wordAt + OFF). Último quadro = primeiro (quadro 0: pai alimentando, papo estufado).
// REGRAS DE PLATAFORMA: "FILHOTE DE POMBO" na tela desde o quadro 0; 1º quadro em plano médio com o papo estufado;
// o corte dos ~2 s vai para o PAPO (não para os bicos); pasta amarelo-pálida só dentro do papo; nenhum bebê humano
// (o menino começa com 4 anos; gota "LEITE MATERNO"); nada que sexualize o filhote; "macho" em branco na legenda.
// ESTADO: o filhote do ninho tem 10 dias (alimentação) em todo o vídeo; o "jovem" de 28 dias só aparece no trecho do
// modo anônimo (é o futuro dele) e no flash do recap. O zelador troca de roupa (A → B) em "roupa trocada" e fica B.
// =====================================================================
const TL = timelineJson as Timeline;
const FPS = 30;
const OFF = 0.5;
export const pomboDuration = (fps: number) => Math.ceil((TL.duration + OFF + 0.5) * fps);
const FIM = (pomboDuration(FPS) - 1) / FPS;
const w = (c: string, word: string, n = 0) => wordAt(TL, c, word, n) + OFF;
const S = (c: string) => cena(TL, c).start + OFF;
const PI = Math.PI;
const PREVIA = (getInputProps() as { previa?: boolean }).previa === true;
const add = (p: V3, d: V3): V3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const lerpV = (a: V3, b: V3, k: number): V3 => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

type Plan = { from: number; to: number; tipo: TipoPlano; keys: LKey[]; near?: number; luz: { foco: V3; raio: number }; alvo?: V3 | ((t: number) => V3); ajuste?: Record<string, unknown>; scene: (t: number) => React.ReactNode };
const P = (from: number, to: number, p: Omit<Plan, "from" | "to">): Plan => ({ from, to, ...p });
const fixa = (pos: V3, look: V3, fov: number): LKey[] => [{ t: 0, pos, look, fov }];
const mov = (a: number, b: number, p0: V3, l0: V3, p1: V3, l1: V3, f0: number, f1 = f0, lin = false): LKey[] => [
  { t: a, pos: p0, look: l0, fov: f0, lin },
  { t: b, pos: p1, look: l1, fov: f1 },
];

// ======================= ALIMENTAÇÃO (cinemática do kit, par girado em volta do ninho) =======================
const NX = NINHO_Q[0], NZ = NINHO_Q[2];
const TOPO_AR = AR.y1;
const IDADE = 10;
const FILHOTE_POS: V3 = [NX - 1, NINHO_Q_FUNDO, NZ];
const FILHOTE_ROT: V3 = [0, PI / 2 - 0.55, 0];
const BICO_ALIM = 0.5;
const ROT_P: V3 = [0, -PI / 2 + 0.3, 0];
// o par inteiro gira em volta do eixo vertical do ninho: o pai passa a olhar mais para a rua (3/4 para a câmera do
// lado da parede, sem o "colar" do papo de frente) e o contato dos bicos continua o mesmo do kit
const ALFA = 0.2;
const BETA = 0.6; // giro extra só do pai, em volta da ponta do bico do filhote
const LEVANTA = 2.5; // cm: a boca do pai fica acima da ponta do bico do filhote (sem encostar bico no bico)
const INFLAR = 0.5; // papo estufado (bolsa maior) durante a alimentação
const giraNinho = (p: V3): V3 => {
  const x = p[0] - NX, z = p[2] - NZ, c = Math.cos(ALFA), s = Math.sin(ALFA);
  return [NX + x * c + z * s, p[1], NZ - x * s + z * c];
};
const alimentar = (t: number, k = 1, cotos = 0) => {
  const { E: Ef, escala: ef } = especieFilhote(IDADE);
  const pf = poseFilhotePedindo(IDADE, k, t, cotos);
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...ROT_P));
  const pfFin = poseFilhotePedindo(IDADE, 1, 0, 0);
  const pontaFin = pontoCabeca(Ef, pfFin, pontaBicoLocal(Ef)).applyMatrix4(matrizRaiz(FILHOTE_POS, FILHOTE_ROT, ef));
  let melhor = { b: 1, err: 1e9 };
  for (let i = 0; i <= 40; i++) {
    const b = 0.15 + (i / 40) * 0.55;
    const ps = { ...poseAlimentar(t, 1, 1.6, b), bico: BICO_ALIM, corpoY: 0 };
    const m = pontoCabeca(POMBO, ps, bocaLocal(POMBO, BICO_ALIM)).applyMatrix4(R);
    const err = Math.abs(TOPO_AR + m.y - (pontaFin.y + LEVANTA));
    if (err < melhor.err) melhor = { b, err };
  }
  const base: PoseAve = { ...poseAlimentar(t, k, 1.6, melhor.b), bico: BICO_ALIM * k, inflar: INFLAR * k };
  const fin: PoseAve = { ...poseAlimentar(0.25 / 1.6 + 0.5 / 1.6, 1, 1.6, melhor.b), bico: BICO_ALIM, corpoY: 0 };
  const bocaFin = pontoCabeca(POMBO, fin, bocaLocal(POMBO, BICO_ALIM)).applyMatrix4(R);
  const corpoY = Math.max(-4, Math.min(2, pontaFin.y + LEVANTA - (TOPO_AR + bocaFin.y))) * k;
  const posP: V3 = [pontaFin.x - bocaFin.x, TOPO_AR, pontaFin.z - bocaFin.z];
  return { pf, pp: { ...base, corpoY }, posP, ponta: pontaFin };
};
const A0 = alimentar(0);
const BOCA = giraNinho(A0.ponta.toArray() as V3); // ponto de encontro dos bicos (mundo)
// o pai gira BETA em volta do eixo vertical que passa pela ponta do bico do filhote (o contato não muda):
// fica de perfil para a câmera do quadro 0 (papo contra o fundo) e a cauda aponta para a parede
const PONTA_L: V3 = A0.ponta.toArray() as V3;
const giraBoca = (p: V3): V3 => {
  const x = p[0] - PONTA_L[0], z = p[2] - PONTA_L[2], c = Math.cos(BETA), s = Math.sin(BETA);
  return [PONTA_L[0] + x * c + z * s, p[1], PONTA_L[2] - x * s + z * c];
};
const PAI_A = giraNinho(giraBoca(A0.posP)); // pés do pai na alimentação (mundo)
// base do pescoço do pai (onde fica o papo), em coordenadas do mundo
const PAPO_A: V3 = (() => {
  const q = new THREE.Vector3(0, 13, 5).applyEuler(new THREE.Euler(0, ROT_P[1] + ALFA + BETA, 0));
  return [PAI_A[0] + q.x, PAI_A[1] + q.y, PAI_A[2] + q.z];
})();
type Raio = { parede: number; leite: number; soltar: number; fluxo: number; lado?: 1 | -1; descida?: boolean };
const ParAlimentando: React.FC<{ t: number; k?: number; cotos?: number; raio?: Raio; filhote?: boolean; olhar?: number }> = ({ t, k = 1, cotos = 0, raio, filhote = true, olhar = 0 }) => {
  const c0 = alimentar(t, k, cotos);
  const cab = c0.pp.cabeca ?? [0, 0];
  const c = olhar ? { ...c0, pp: { ...c0.pp, cabeca: [cab[0] + olhar, cab[1] + 0.35 * Math.abs(olhar), cab[2] ?? 0] as [number, number, number] } } : c0;
  return (
    <group position={[NX, 0, NZ]} rotation={[0, ALFA, 0]}>
      <group position={[-NX, 0, -NZ]}>
        <group position={PONTA_L} rotation={[0, BETA, 0]}>
          <group position={[-PONTA_L[0], -PONTA_L[1], -PONTA_L[2]]}>
            <Pombo t={t} pose={c.pp} position={c.posP} rotation={ROT_P} raioX={raio ? { corte: new THREE.Vector4(0, 0, 0, 1), papo: raio, fantasma: "#97B1CC" } : undefined} />
          </group>
        </group>
        {filhote ? <Filhote idade={IDADE} t={t} pose={c.pf} position={FILHOTE_POS} rotation={FILHOTE_ROT} /> : null}
      </group>
    </group>
  );
};

// ======================= MUNDO (o que está sempre lá) =======================
const FALCAO_POS: V3 = ANTENA_PAREDE_POUSO;
const PRACA_POMBOS: { p: V3; r: number; f: number; femea?: boolean }[] = [
  { p: [520, 0, 945], r: 2.6, f: 1.3 },
  { p: [585, 0, 935], r: -2.2, f: 1.5, femea: true },
  { p: [470, 0, 960], r: 1.9, f: 1.2 },
  { p: [625, 0, 960], r: -1.4, f: 1.4 },
  { p: [545, 0, 905], r: 3.0, f: 1.25, femea: true },
];
const MAO_PIPOCA: V3 = [BANCO[0] - 30, 105, BANCO[2] - 25];
const Praca: React.FC<{ t: number; jovem?: boolean; semPombos?: boolean }> = ({ t, jovem = false, semPombos = false }) => (
  <>
    <HumanoPipoca t={t} />
    <Pipoca t={t} t0={0} mao={MAO_PIPOCA} alvo={[BANCO[0], 0, 950]} raio={70} levas={30} periodo={1.6} />
    {semPombos
      ? null
      : PRACA_POMBOS.map((q, i) => (
          <LookAve key={i}>
            <Pombo femea={q.femea} t={t} pose={poseBicar(t + i * 0.37, 1, q.f)} position={q.p} rotation={[0, q.r, 0]} sombra />
          </LookAve>
        ))}
    {jovem ? (
      <LookAve>
        <Filhote idade={28} t={t} pose={poseBicar(t + 0.9, 1, 1.3)} position={JOVEM_PRACA} rotation={[0, -2.6, 0]} />
      </LookAve>
    ) : null}
  </>
);
const JOVEM_PRACA: V3 = [500, 0, 915];
const HumanoPipoca: React.FC<{ t: number }> = ({ t }) => <HomemPipoca t={t} position={[BANCO[0], 0, BANCO[2] + 2]} rotation={[0, PI, 0]} />;
const Mundo: React.FC<{ t: number; ninho?: boolean; falcao?: boolean; olharFalcao?: number; praca?: boolean; jovem?: boolean; mae?: boolean }> = ({ t, ninho = true, falcao = true, olharFalcao = 0, praca = true, jovem = false, mae = true }) => (
  <>
    <LookConcreto>
      <Quarteirao ninho={ninho} />
    </LookConcreto>
    {falcao ? (
      <LookAve sheenCor="#D8D8D8">
        <Falcao t={t} pose={poseFalcao(olharFalcao)} position={FALCAO_POS} rotation={[0, 0, 0]} />
      </LookAve>
    ) : null}
    {mae ? (
      <LookAve>
        <Pombo femea t={t} pose={{ ...POSE_PARADO, pes: { e: [1.4, 0.2, 0.8], d: [-1.4, 0.2, 0.8] } }} position={[FIO_POUSO[0], FIO_POUSO[1], FIO_POUSO[2] - 0.8]} rotation={[0, 0.25, 0]} />
      </LookAve>
    ) : null}
    {praca ? <Praca t={t} jovem={jovem} /> : null}
  </>
);
// ave voando com yaw (direção) e pitch/roll no referencial dela
const Voa: React.FC<{ children: React.ReactNode; p: V3; yaw: number; pitch?: number; roll?: number }> = ({ children, p, yaw, pitch = 0, roll = 0 }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <group rotation={[pitch, 0, roll]}>{children}</group>
  </group>
);
const rumo = (a: V3, b: V3) => ({ yaw: Math.atan2(b[0] - a[0], b[2] - a[2]), pitch: -Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) });

// ======================= PLANOS: funções de cena =======================
// quadro 0 (e loop): u = tempo local (u = 0 é o 1º quadro)
const quadro0 = (t: number, u: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <ParAlimentando t={u} />
    </LookAve>
  </>
);
const C0 = { pos: [-124, 293, 7] as V3, look: [60, 238, 39] as V3, fov: 27 };
const C0b = { pos: add(C0.pos, [8, -2, 1]), look: C0.look, fov: 27 };
const keys0 = (a: number, b: number): LKey[] => [{ t: a, pos: C0.pos, look: C0.look, fov: C0.fov }, { t: b, pos: C0b.pos, look: C0b.look, fov: C0b.fov }];

// close do papo (corte dos ~2 s): lateral do pescoço do pai, bicos fora do centro
const C_PAPO = { pos: add(PAPO_A, [-34, 3, -13]), look: add(PAPO_A, [0, -3, 0]), fov: 30 };

// filhote solta o bico e bate os cotos (2,45 → 3,6)
const cotos = (t: number) => {
  const t0 = w("filhote", "voce");
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <ParAlimentando t={t} k={1 - seg01(t, t0, t0 + 0.5)} cotos={seg01(t, t0 + 0.2, t0 + 0.6)} />
      </LookAve>
    </>
  );
};
// contraplano do falcão: vira a cabeça da rua para o ninho
// contraplano por cima do ombro do falcão: a cabeça dele em primeiro plano e o ninho (pai + filhote) ao fundo, lente longa
const CAB_FAL: V3 = add(FALCAO_POS, [0, 27, 0]);
const C_FAL = (() => {
  const pos = add(CAB_FAL, [85, 3, 16]);
  const dh = new THREE.Vector3(...CAB_FAL).sub(new THREE.Vector3(...pos)).normalize();
  const dn = new THREE.Vector3(NX, TOPO_AR + 10, NZ).sub(new THREE.Vector3(...pos)).normalize();
  const d = dh.add(dn).normalize().multiplyScalar(100);
  return { pos, look: add(pos, [d.x, d.y, d.z]), fov: 22 };
})();
const falcaoOlha = (t: number, t0: number) => (
  <>
    <Mundo t={t} falcao={false} />
    <LookAve>
      <ParAlimentando t={t} />
    </LookAve>
    <LookAve sheenCor="#D8D8D8">
      <Falcao t={t} pose={poseFalcao(-70 * sm(clamp01((t - t0 - 0.1) / 0.45)), 6 * sm(clamp01((t - t0 - 0.1) / 0.45)))} position={FALCAO_POS} rotation={[0, 0, 0]} />
    </LookAve>
  </>
);
// raio-x da alimentação: a pasta amarelo-pálida fica SÓ dentro do papo (fluxo 0)
const raioAlim = (t: number, leite = 0.65, lado: 1 | -1 = 1) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <ParAlimentando t={t} raio={{ parede: 1, leite, soltar: 1, fluxo: 0, lado, descida: false }} />
    </LookAve>
  </>
);
const C_RX = { pos: add(PAPO_A, [42, 6, 12]), look: add(PAPO_A, [-6, -3, 0]), fov: 34 };
// filhote em 3/4 de frente (olho e bico à vista), pai ao lado
const C_FIL = { pos: [-27, TOPO_AR + 18, 72] as V3, look: [-46, TOPO_AR + 8, 24] as V3, fov: 32 };

// ---------- ESTIRÃO: o fantasma do filhote cresce até o tamanho do pai ----------
const PAI_EST: V3 = [-22, TOPO_AR, 22];
const FANT_POS: V3 = [NX + 2, NINHO_Q_FUNDO, NZ + 2];
const T_CRESCE0 = () => w("estirao", "quatro");
const T_CRESCE1 = () => w("estirao", "dele");
const idadeFant = (t: number) => mix(IDADE, 28, seg01(t, T_CRESCE0(), T_CRESCE1()));
const estirao = (t: number, dFix?: number) => {
  const d = dFix ?? idadeFant(t);
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <Pombo t={t} pose={POSE_PARADO} position={PAI_EST} rotation={[0, -PI / 2, 0]} />
        <Filhote idade={IDADE} t={t} pose={poseFilhoteDeitado(IDADE, t)} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, PI / 2 - 0.3, 0]} sombra={false} />
        <Filhote fantasma idade={d} t={t} pose={{ ...poseFilhoteDeitado(d), sentado: 0 }} position={FANT_POS} rotation={[0, PI / 2, 0]} />
      </LookAve>
    </>
  );
};
const C_EST = { pos: [-98, TOPO_AR + 16, 98] as V3, look: [-36, TOPO_AR + 12, 22] as V3, fov: 32 };

// ---------- janela: menino 4 → 18 anos ao lado do homem ----------
const idadeMenino = (t: number) => mix(4, 18, seg01(t, w("estirao", "humano"), w("estirao", "anos")));
const janela = (t: number) => (
  <>
    <LookConcreto>
      <Quarteirao />
    </LookConcreto>
    <HumanoAzul t={t} escala={HUMANO} position={[JANELA.x0 + 40, JANELA.y0 - 39, -90]} rotation={[0, 0.2, 0]} />
    <MeninoCrescendo t={t} idade={idadeMenino(t)} position={[JANELA.x0 + 95, JANELA.y0 - 39, -80]} rotation={[0, -0.2, 0]} />
  </>
);
const C_JAN = { pos: [JANELA.x0 + 60, 215, 330] as V3, look: [JANELA.x0 + 60, 200, -80] as V3, fov: 40 };

// ---------- MOTOBOY ----------
// decolagem do ar de janela para a praça
const VOO_PRACA = { a: add(PAI_A, [0, 4, 0]), b: [520, 30, 905] as V3 };
const vooPraca = (t: number) => {
  const t0 = w("motoboy", "por"), t1 = w("motoboy", "praca") + 0.7;
  const k = clamp01((t - t0) / (t1 - t0));
  const arco = Math.sin(PI * k) * 60;
  const p = lerpV(VOO_PRACA.a, VOO_PRACA.b, k);
  p[1] += arco * 0.4;
  const p2 = lerpV(VOO_PRACA.a, VOO_PRACA.b, Math.min(1, k + 0.02));
  const r = rumo(p, p2);
  return { p, ...r };
};
const decola = (t: number) => {
  const v = vooPraca(t);
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <Filhote idade={IDADE} t={t} pose={poseFilhotePedindo(IDADE, 0.3, t, 0.4)} position={FILHOTE_POS} rotation={FILHOTE_ROT} />
        <Voa p={v.p} yaw={v.yaw} pitch={v.pitch * 0.6}>
          <Pombo t={t} pose={poseVoo(t, 3)} />
        </Voa>
      </LookAve>
    </>
  );
};
// praça: o pai chega voando no meio dos pombos que bicam a pipoca
// praça: o pai já pousou no meio dos pombos e bica a pipoca (corte de tempo depois da decolagem)
const PAI_PRACA: V3 = [505, 0, 905];
const pracaChega = (t: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <Pombo t={t} pose={{ ...poseBicar(t + 0.2, 1, 1.4), papo: 0.2 }} position={PAI_PRACA} rotation={[0, 2.3, 0]} />
    </LookAve>
  </>
);
const C_PRACA = { pos: [395, 115, 680] as V3, look: [525, 50, 930] as V3, fov: 42 };

// falcão na antena (close, rua atrás)
const C_FAL2 = { pos: add(FALCAO_POS, [-58, 6, 40]), look: add(FALCAO_POS, [0, 18, 0]), fov: 30 };

// perseguição: o pai volta da praça com o papo cheio; o falcão mergulha da antena; o pai desvia; o falcão passa reto
const T_PER0 = () => w("motoboy", "que");
const T_CRUZA = () => w("motoboy", "desvia") + 0.15;
const T_CHEGA = () => w("motoboy", "serve") - 0.05;
const PAI_V0: V3 = [520, 170, 760];
const PAI_V1: V3 = add(PAI_A, [8, 6, 30]);
const paiBase = (t: number): V3 => {
  const k = clamp01((t - T_PER0()) / (T_CHEGA() - T_PER0()));
  const p = lerpV(PAI_V0, PAI_V1, sm(k * 0.85 + 0.15 * k));
  p[1] += Math.sin(PI * k) * 70;
  return p;
};
const desvio = (t: number) => sm(clamp01((t - (T_CRUZA() - 0.45)) / 0.35)) * (1 - sm(clamp01((t - (T_CRUZA() + 0.35)) / 0.7)));
const paiVoo = (t: number) => {
  const d = desvio(t);
  const b = paiBase(t);
  const p: V3 = [b[0] - 35 * d, b[1] - 45 * d, b[2]];
  const p2b = paiBase(t + 0.04);
  const r = rumo(b, p2b);
  return { p, yaw: r.yaw, pitch: r.pitch * 0.5 + 0.35 * d, roll: -0.9 * d };
};
const XC = () => paiBase(T_CRUZA()); // onde o pai estaria se não desviasse (o falcão passa por aqui)
const falcaoVoo = (t: number) => {
  const t0 = T_PER0() + 0.2, tc = T_CRUZA();
  const P0 = add(FALCAO_POS, [0, 10, 20]);
  const X = XC();
  const C = add(lerpV(P0, XC(), 0.5), [40, 10, 90]);
  if (t <= t0) return { p: P0, yaw: -PI / 2, pitch: 0.2, pose: poseFalcao(-70, 6), mergulho: false };
  if (t <= tc) {
    const u = (t - t0) / (tc - t0);
    const q = (a: number, b: number, c: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
    const p: V3 = [q(P0[0], C[0], X[0]), q(P0[1], C[1], X[1]), q(P0[2], C[2], X[2])];
    const u2 = Math.min(1, u + 0.03);
    const q2 = (a: number, b: number, c: number) => (1 - u2) * (1 - u2) * a + 2 * (1 - u2) * u2 * b + u2 * u2 * c;
    const p2: V3 = [q2(P0[0], C[0], X[0]), q2(P0[1], C[1], X[1]), q2(P0[2], C[2], X[2])];
    const r = rumo(p, p2);
    return { p, yaw: r.yaw, pitch: r.pitch, pose: poseFalcaoMergulho(), mergulho: true };
  }
  // passa reto (sem contato), freia e sobe para longe
  const v = t - tc;
  const dir = new THREE.Vector3(X[0] - C[0], X[1] - C[1], X[2] - C[2]).normalize();
  const k = clamp01(v / 0.9);
  const p: V3 = [X[0] + dir.x * 260 * v, X[1] + dir.y * 260 * v * (1 - k) + 160 * k * k, X[2] + dir.z * 260 * v];
  const r = rumo(X, add(X, [dir.x, dir.y, dir.z]));
  return { p, yaw: r.yaw, pitch: mix(r.pitch, -0.4, k), pose: poseFalcaoFreio(k), mergulho: false };
};
const perseguicao = (t: number, ninhoComPai = false) => {
  const pv = paiVoo(t), fv = falcaoVoo(t);
  return (
    <>
      <Mundo t={t} falcao={false} />
      <LookAve>
        {ninhoComPai ? null : <Filhote idade={IDADE} t={t} pose={poseFilhotePedindo(IDADE, 0.4, t, 0.5)} position={FILHOTE_POS} rotation={FILHOTE_ROT} />}
        <Voa p={pv.p} yaw={pv.yaw} pitch={pv.pitch} roll={pv.roll}>
          <Pombo t={t} pose={{ ...poseVoo(t, 3), papo: 1 }} />
        </Voa>
      </LookAve>
      <LookAve sheenCor="#D8D8D8">
        <Voa p={fv.p} yaw={fv.yaw} pitch={fv.pitch}>
          <Falcao t={t} pose={fv.pose} />
        </Voa>
      </LookAve>
    </>
  );
};
// câmeras que acompanham (amostradas a cada 0,1 s, trechos lineares)
const segue = (a: number, b: number, fn: (t: number) => { pos: V3; look: V3 }, fov: number): LKey[] => {
  const ks: LKey[] = [];
  for (let t = a; t < b + 0.1; t += 0.1) {
    const c = fn(Math.min(t, b));
    ks.push({ t: Math.min(t, b), pos: c.pos, look: c.look, fov, lin: true });
  }
  return ks;
};
// alimentação depois da volta (k entra de 0 → 1)
const serve = (t: number, t0: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <ParAlimentando t={t} k={seg01(t, t0, t0 + 0.7)} />
    </LookAve>
  </>
);
// fome: o papo murcha (a alimentação termina) e o pai ergue a cabeça e olha para a rua/praça
const alimentaMedio = (t: number) => {
  const k = 1 - seg01(t, w("motoboy", "fome") - 0.3, w("motoboy", "danada") + 0.2);
  const olha = 55 * seg01(t, w("motoboy", "danada"), w("motoboy", "por") - 0.1);
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <ParAlimentando t={t} k={k} olhar={olha} />
      </LookAve>
    </>
  );
};
const C_MED = { pos: [-22, TOPO_AR + 13, 64] as V3, look: add(BOCA, [3, -1, 0]), fov: 32 };

// ---------- REQUEIJÃO: calçada (rua e praça atrás), pai e mãe ----------
const CAL_PAI: V3 = [0, 0, 190];
const CAL_MAE: V3 = [8, 0, 262];
const ROT_CAL: V3 = [0, -PI / 2, 0]; // olham −x (perfil para a câmera do lado da parede)
const arrulho = (t: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <Pombo t={t} pose={poseArrulho(t - S("requeijao"), sm(clamp01((t - S("requeijao")) / 0.5)))} position={CAL_PAI} rotation={[0, -PI / 2 + 0.5, 0]} />
    </LookAve>
  </>
);
const C_ARR = { pos: add(CAL_PAI, [-34, 18, -52]), look: add(CAL_PAI, [-2, 13, 0]), fov: 32 };
// mãe chega voando e pousa ao lado do pai
const T_POUSO = () => w("requeijao", "mae") - 0.1;
const maeVoo = (t: number) => {
  const t0 = w("requeijao", "seu") - 0.1;
  const A: V3 = add(CAL_MAE, [160, 120, 60]);
  const k = clamp01((t - t0) / (T_POUSO() - t0));
  const e = 1 - (1 - k) * (1 - k);
  const p = lerpV(A, CAL_MAE, e);
  return { p, k, yaw: Math.atan2(CAL_MAE[0] - A[0], CAL_MAE[2] - A[2]) };
};
const POSE_PAPO: PoseAve = { ...POSE_PARADO, papo: 1, inflar: 0.35 }; // papo cheio: o corpo do fantasma envolve o papo
const PAPO_CAL = { parede: 1, leite: 0.6, soltar: 1, lado: -1 as const, descida: false };
const maePousa = (t: number, rx = false) => {
  const m = maeVoo(t);
  const pousada = m.k >= 1;
  const asa = pousada ? 0 : mix(1, 0.32, sm(clamp01((m.k - 0.55) / 0.45)));
  const rxP = rx ? { corte: new THREE.Vector4(0, 0, 0, 1), papo: PAPO_CAL } : undefined;
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <Pombo t={t} pose={rx ? POSE_PAPO : POSE_PARADO} position={CAL_PAI} rotation={ROT_CAL} raioX={rxP} />
        {pousada ? (
          <Pombo femea t={t} pose={rx ? POSE_PAPO : POSE_PARADO} position={CAL_MAE} rotation={ROT_CAL} raioX={rxP} />
        ) : (
          <Voa p={m.p} yaw={mix(m.yaw, -PI / 2, sm(m.k))} pitch={-0.25 * (1 - m.k)}>
            <Pombo femea t={t} pose={{ ...poseVoo(t, 3, 40 * (1 - 0.6 * m.k)), asa, recolher: 1 - m.k, pesc: [38, 42, 28, 12].map((v, i) => mix(v, (POSE_PARADO.pesc as number[])[i], sm(clamp01((m.k - 0.5) / 0.5)))), cabeca: [0, mix(-2, -6, m.k)] }} />
          </Voa>
        )}
      </LookAve>
    </>
  );
};
const C_CAL = { pos: add(CAL_PAI, [-6, 30, -84]), look: add(CAL_PAI, [6, 12, 30]), fov: 34 };
// pai e mãe em raio-x: câmera alta do lado da parede; o pai embaixo (perto), a mãe em cima (longe)
const C_DOIS = { pos: add(CAL_PAI, [-4, 24, -66]), look: add(CAL_PAI, [-2, 13, 40]), fov: 24 };
// parede do papo 1× → 20×, descama, vira pasta (pai sozinho, close lateral)
const T_PAR0 = () => w("requeijao", "parede");
const T_PAR1 = () => w("requeijao", "vinte") + 0.35;
const paredeK = (t: number) => seg01(t, T_PAR0() + 0.2, T_PAR1());
const papoCorte = (t: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <Pombo
        t={t}
        pose={POSE_PAPO}
        position={CAL_PAI}
        rotation={ROT_CAL}
        raioX={{ corte: new THREE.Vector4(0, 0, 0, 1), papo: { parede: paredeK(t), soltar: seg01(t, w("requeijao", "descasca") - 0.2, w("requeijao", "pasta")), leite: 0.65 * seg01(t, w("requeijao", "vira") - 0.3, w("requeijao", "pasta") + 0.6), lado: -1, descida: false } }}
      />
    </LookAve>
  </>
);
const PAPO_C: V3 = add(CAL_PAI, [-5, 13, 0]);
const C_PAR = { pos: add(PAPO_C, [-3, 2.5, -28]), look: add(PAPO_C, [-0.5, 0, 0]), fov: 30 };
const C_PAR2 = { pos: add(PAPO_C, [-10, 4, -22]), look: add(PAPO_C, [-0.5, -1, 0]), fov: 28 };

// ---------- MODO ANÔNIMO ----------
const C_QUART = { pos: [760, 330, 1350] as V3, look: [60, 175, 0] as V3, fov: 42 };
const visto = (t: number) => (
  <>
    <Mundo t={t} />
    <LookAve>
      <ParAlimentando t={t} />
    </LookAve>
  </>
);
// o jovem (28 dias) sai do ninho andando pelo ar de janela
const E28 = especieFilhote(28).E;
const T_SAI0 = () => w("anonimo", "sai") + 0.1;
const jovemDist = (t: number) => Math.max(0, Math.min(1.6, t - T_SAI0())) * 13;
const jovemSai = (t: number) => {
  const d = jovemDist(t);
  const a = andarPombo(E28, d);
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <Filhote idade={28} t={t} pose={{ ...POSE_PARADO, pes: a.pes, avancoCab: a.avancoCab, corpoY: a.corpoY }} position={[NX + d, NINHO_Q_FUNDO - 1.6 * clamp01(d / 6), NZ]} rotation={[0, PI / 2, 0]} />
        <Pombo t={t} pose={POSE_PARADO} position={[-14, TOPO_AR, 26]} rotation={[0, -PI / 2, 0]} />
      </LookAve>
    </>
  );
};
const C_JOV = { pos: [-50, TOPO_AR + 14, 112] as V3, look: [-26, TOPO_AR + 11, 24] as V3, fov: 34 };
const C_JOV2 = { pos: [-38, TOPO_AR + 12, 86] as V3, look: [-26, TOPO_AR + 11, 24] as V3, fov: 30 };
const pracaJovem = (t: number) => <Mundo t={t} jovem />;
const C_PRJ = { pos: [720, 20, 930] as V3, look: [520, 12, 932] as V3, fov: 34 };

// ---------- RANCOR: o zelador ----------
const ZEL: V3 = [PORTA.x0 - 40, 0, 70];
const T_ENX = () => w("rancor", "enxota");
const T_TROCA = () => w("rancor", "roupa");
const roupa = (t: number): "A" | "B" => (t >= T_TROCA() + 0.12 ? "B" : "A");
const POMBOS_CAL: { p: V3; r: number; f: number }[] = [
  { p: [235, 0, 165], r: -2.2, f: 1.3 },
  { p: [205, 0, 215], r: -1.6, f: 1.45 },
  { p: [262, 0, 232], r: -2.6, f: 1.2 },
];
// pombos que bicam perto do zelador; ao serem enxotados levantam voo e saem pela rua (+z, −x)
const pombosEnxotados = (t: number) =>
  POMBOS_CAL.map((q, i) => {
    const tv = T_ENX() + 0.35 + i * 0.12;
    if (t < tv) return <Pombo key={i} t={t} pose={poseBicar(t + i * 0.5, 1, q.f)} position={q.p} rotation={[0, q.r, 0]} />;
    const v = t - tv;
    const dir = new THREE.Vector3(-1, 0, 0.25 + i * 0.1).normalize();
    const p: V3 = [q.p[0] + dir.x * 55 * v, 6 + 45 * v, q.p[2] + dir.z * 55 * v];
    return (
      <Voa key={i} p={p} yaw={Math.atan2(dir.x, dir.z)} pitch={-0.35}>
        <Pombo t={t} pose={poseVoo(t + i * 0.2, 3)} />
      </Voa>
    );
  });
const enxota = (t: number) => (
  <>
    <Mundo t={t} />
    <Zelador t={t} roupa="A" enxotar={seg01(t, T_ENX() - 0.1, T_ENX() + 0.35)} position={ZEL} rotation={[0, 0.9, 0]} />
    <LookAve>{pombosEnxotados(t)}</LookAve>
  </>
);
const C_ZEL = { pos: [520, 150, 470] as V3, look: [290, 95, 110] as V3, fov: 46 };
// pombo que vigia o zelador (perfil, olho no quadro); o zelador anda ao fundo
const VIGIA: V3 = [138, 0, 288];
const vigiaRot = (t: number): V3 => [0, mix(1.9, 2.25, seg01(t, w("rancor", "pombo"), w("rancor", "reconhece") + 0.4)), 0];
const zelAnda = (t: number) => {
  const t0 = w("rancor", "pombo");
  const v = Math.max(0, Math.min(t - t0, 6));
  return add(ZEL, [-12 * v, 0, 4 * v]);
};
const vigia = (t: number, sai = false) => {
  const tS = w("rancor", "mesmo") + 0.25;
  const d = sai && t > tS ? (t - tS) * 16 : 0;
  const a = andarPombo(POMBO, d);
  const r = vigiaRot(t);
  const fwd: V3 = [Math.sin(r[1] + PI), 0, Math.cos(r[1] + PI)];
  const pos: V3 = sai ? add(VIGIA, [fwd[0] * d, 0, fwd[2] * d]) : VIGIA;
  return (
    <>
      <Mundo t={t} />
      <Zelador t={t} roupa={roupa(t)} varrer={0.6} andar={t > w("rancor", "pombo") ? 1 : 0} position={zelAnda(t)} rotation={[0, 0.9, 0]} />
      <LookAve>
        <Pombo t={t} pose={sai && d > 0 ? { ...POSE_PARADO, pes: a.pes, avancoCab: a.avancoCab, corpoY: a.corpoY } : { ...POSE_PARADO, cabeca: [mix(0, -25, seg01(t, w("rancor", "reconhece"), w("rancor", "correu"))), -6] }} position={pos} rotation={sai && d > 0 ? [0, r[1] + PI, 0] : r} />
      </LookAve>
    </>
  );
};
const C_VIG = { pos: [95, 42, 372] as V3, look: [165, 44, 250] as V3, fov: 58 };
// zelador B parado de braços abertos; os pombos passam desviando só dele
const T_PARA = () => w("rancor", "e");
const desviam = (t: number) =>
  [0, 1, 2].map((i) => {
    // passam na frente do zelador, sempre a 70–110 cm dele, andando de lado (desviando só dele)
    const v = Math.max(0, t - T_PARA());
    const c = zelAnda(t);
    const n = [0.6, 0, 0.8], tv = [0.8, 0, -0.6];
    const R = 115 + i * 20, d = v * 16 - 40 + i * 28;
    const p: V3 = [c[0] + n[0] * R + tv[0] * d, 0, c[2] + n[2] * R + tv[2] * d];
    const a = andarPombo(POMBO, v * 16);
    return <Pombo key={i} t={t} pose={{ ...POSE_PARADO, pes: a.pes, avancoCab: a.avancoCab, corpoY: a.corpoY }} position={p} rotation={[0, Math.atan2(tv[0], tv[2]), 0]} />;
  });
// "mesmo sem enxotar": a vassoura fica encostada na parede ao lado dele (nunca some da mão por limiar)
const VassouraEncostada: React.FC = () => (
  <group position={[ZEL[0] - 40, 96, 5]} rotation={[-0.3, 0, 0]} scale={HUMANO}>
    <Vassoura />
  </group>
);
const semEnxotar = (t: number) => (
  <>
    <Mundo t={t} />
    <Zelador t={t} roupa="B" varrer={0} bracosAbertos={seg01(t, w("rancor", "mesmo", 1) - 0.3, w("rancor", "mesmo", 1) + 0.4)} semVassoura position={zelAnda(t)} rotation={[0, 0.9, 0]} />
    <VassouraEncostada />
    <LookAve>{desviam(t)}</LookAve>
  </>
);
const C_SEM = { pos: [445, 75, 350] as V3, look: [250, 78, 120] as V3, fov: 50 };
const rancorClose = (t: number) => (
  <>
    <Mundo t={t} />
    <Zelador t={t} roupa="B" varrer={0} bracosAbertos={1} semVassoura position={zelAnda(t)} rotation={[0, 0.9, 0]} />
    <VassouraEncostada />
    <LookAve>
      <Pombo t={t} pose={{ ...POSE_PARADO, cabeca: [-25, -8] }} position={VIGIA} rotation={[0, 2.25, 0]} />
    </LookAve>
  </>
);

// ---------- VIRADA ----------
const andaCalcada = (t: number, t0: number) => {
  const d = (t - t0) * 14;
  const a = andarPombo(POMBO, d);
  return (
    <>
      <Mundo t={t} />
      <LookAve>
        <Pombo t={t} pose={{ ...POSE_PARADO, pes: a.pes, avancoCab: a.avancoCab, corpoY: a.corpoY }} position={[40 - d, 0, 205]} rotation={[0, -PI / 2, 0]} />
      </LookAve>
    </>
  );
};
const C_ANDA = (t0: number, t1: number) => mov(t0, t1, [44, 18, 120], [40, 12, 215], [10, 18, 120], [6, 12, 215], 30, 30, true);
const C_AZ = { pos: [-240, 225, 240] as V3, look: [-240, 225, 0] as V3, fov: 40 };
const T_GAI = () => w("virada", "pra") - 0.1;
const gaiola = (t: number) => {
  const u = seg01(t, T_GAI(), T_GAI() + 1.6);
  const p: V3 = [mix(GAIOLA_AZULEJO[0], -120, u), mix(GAIOLA_AZULEJO[1], 250, u) + Math.sin(PI * u) * 18, mix(GAIOLA_AZULEJO[2] - 6, 170, u)];
  const r = rumo(p, [mix(GAIOLA_AZULEJO[0], -120, Math.min(1, u + 0.02)), p[1], mix(GAIOLA_AZULEJO[2] - 6, 170, Math.min(1, u + 0.02))]);
  return (
    <>
      <Mundo t={t} />
      {t >= T_GAI() ? (
        <LookAve>
          <Voa p={p} yaw={r.yaw}>
            <Pombo t={t} pose={poseVoo(t, 3, 40)} />
          </Voa>
        </LookAve>
      ) : null}
    </>
  );
};
const C_GAI = { pos: [-120, 235, 330] as V3, look: [-175, 240, 60] as V3, fov: 42 };
const pipoca = (t: number) => <Mundo t={t} />;
const C_PIP = { pos: [400, 140, 690] as V3, look: [540, 70, 980] as V3, fov: 44 };

// ======================= PLANOS =======================
const LUZ_NINHO = { foco: [-40, TOPO_AR + 6, 24] as V3, raio: 60 };
const LUZ_Q0 = { foco: [-20, 280, 30] as V3, raio: 140 };
const LUZ_CAL = { foco: [10, 10, 205] as V3, raio: 60 };
const LUZ_ZEL = { foco: [260, 60, 160] as V3, raio: 220 };
export const PLANS: Plan[] = [
  // ---------- GANCHO ----------
  P(0, w("gancho", "macho"), { tipo: "medio", keys: keys0(0, 2.4), near: 1, luz: LUZ_Q0, alvo: BOCA, scene: (t) => quadro0(t, t) }),
  P(w("gancho", "macho"), w("filhote", "voce"), { tipo: "close", keys: mov(w("gancho", "macho"), w("filhote", "voce"), C_PAPO.pos, C_PAPO.look, add(C_PAPO.pos, [3, 0, 2]), C_PAPO.look, C_PAPO.fov), near: 0.3, luz: LUZ_NINHO, alvo: PAPO_A, scene: (t) => quadro0(t, t) }),
  P(w("filhote", "voce"), w("filhote", "pombo"), { tipo: "medio", keys: mov(w("filhote", "voce"), w("filhote", "pombo"), add(C_FIL.pos, [3, 0, 5]), C_FIL.look, C_FIL.pos, C_FIL.look, C_FIL.fov), near: 0.5, luz: LUZ_NINHO, alvo: BOCA, scene: (t) => cotos(t) }),
  P(w("filhote", "pombo"), w("filhote", "e", 1), { tipo: "medio", keys: fixa(C_FAL.pos, C_FAL.look, C_FAL.fov), near: 1, luz: { foco: FALCAO_POS, raio: 70 }, alvo: add(FALCAO_POS, [0, 22, 0]), scene: (t) => falcaoOlha(t, w("filhote", "pombo")) }),
  P(w("filhote", "e", 1), S("estirao"), { tipo: "close", keys: mov(w("filhote", "e", 1), S("estirao"), C_RX.pos, C_RX.look, add(C_RX.pos, [4, 0, 3]), C_RX.look, C_RX.fov), near: 0.3, luz: LUZ_NINHO, alvo: PAPO_A, scene: (t) => raioAlim(t, 0.65, 1) }),
  // ---------- ESTIRÃO ----------
  P(S("estirao"), w("estirao", "um"), { tipo: "medio", keys: mov(S("estirao"), w("estirao", "um"), C_EST.pos, C_EST.look, add(C_EST.pos, [6, 0, -8]), C_EST.look, C_EST.fov), near: 0.5, luz: LUZ_NINHO, alvo: [-38, TOPO_AR + 10, 22], scene: (t) => estirao(t) }),
  P(w("estirao", "um"), w("estirao", "esse"), { tipo: "medio", keys: mov(w("estirao", "um"), w("estirao", "esse"), add(C_JAN.pos, [0, 0, 30]), C_JAN.look, C_JAN.pos, C_JAN.look, C_JAN.fov), near: 1, luz: { foco: [JANELA.x0 + 60, 200, -40], raio: 180 }, alvo: [JANELA.x0 + 70, 180, -85], scene: (t) => janela(t) }),
  P(w("estirao", "esse"), S("motoboy"), { tipo: "medio", keys: mov(w("estirao", "esse"), S("motoboy"), add(C_EST.pos, [6, 0, -8]), C_EST.look, add(C_EST.pos, [12, -2, -18]), add(C_EST.look, [0, 2, 0]), C_EST.fov), near: 0.5, luz: LUZ_NINHO, alvo: [-38, TOPO_AR + 12, 22], scene: (t) => estirao(t, 28) }),
  // ---------- MOTOBOY ----------
  P(S("motoboy"), w("motoboy", "por"), { tipo: "medio", keys: mov(S("motoboy"), w("motoboy", "por"), add(C_MED.pos, [-4, 2, -2]), C_MED.look, add(C_MED.pos, [4, 0, 4]), C_MED.look, C_MED.fov), near: 0.5, luz: LUZ_NINHO, alvo: BOCA, scene: (t) => alimentaMedio(t) }),
  P(w("motoboy", "por"), w("motoboy", "praca"), { tipo: "medio", keys: segue(w("motoboy", "por"), w("motoboy", "praca"), (t) => { const v = vooPraca(t); return { pos: add(v.p, [70, 18, 95]), look: add(v.p, [10, -4, 10]) }; }, 36), near: 1, luz: { foco: [200, 150, 450], raio: 600 }, alvo: (t) => vooPraca(t).p, scene: (t) => decola(t) }),
  P(w("motoboy", "praca"), w("motoboy", "e"), { tipo: "aberto", keys: fixa(C_PRACA.pos, C_PRACA.look, C_PRACA.fov), near: 1, luz: { foco: [540, 40, 930], raio: 200 }, alvo: [545, 20, 945], scene: (t) => pracaChega(t) }),
  P(w("motoboy", "e"), w("motoboy", "que"), { tipo: "medio", keys: mov(w("motoboy", "e"), w("motoboy", "que"), add(C_FAL2.pos, [-6, 0, 6]), C_FAL2.look, C_FAL2.pos, C_FAL2.look, C_FAL2.fov), near: 0.5, luz: { foco: FALCAO_POS, raio: 70 }, alvo: add(FALCAO_POS, [0, 22, 0]), scene: (t) => <Mundo t={t} olharFalcao={-20} /> }),
  P(w("motoboy", "que"), w("motoboy", "seu", 1), { tipo: "medio", keys: segue(w("motoboy", "que"), w("motoboy", "seu", 1), (t) => { const f = falcaoVoo(t).p; return { pos: add(f, [-12, 6, 82]), look: add(f, [-4, 0, 0]) }; }, 38), near: 1, luz: { foco: [450, 250, 400], raio: 700 }, alvo: (t) => falcaoVoo(t).p, scene: (t) => perseguicao(t) }),
  P(w("motoboy", "seu", 1), w("motoboy", "volta"), { tipo: "medio", keys: segue(w("motoboy", "seu", 1), w("motoboy", "volta"), (t) => { const m = lerpV(paiVoo(t).p, falcaoVoo(t).p, 0.5); return { pos: add(m, [-15, 8, 150]), look: m }; }, 42), near: 1, luz: { foco: [300, 250, 450], raio: 600 }, alvo: () => XC(), scene: (t) => perseguicao(t) }),
  P(w("motoboy", "volta"), w("motoboy", "serve"), { tipo: "medio", keys: segue(w("motoboy", "volta"), w("motoboy", "serve"), (t) => { const l = paiVoo(t).p; return { pos: add(l, [-58, 10, 40]), look: l }; }, 42), near: 1, luz: { foco: [-20, 270, 100], raio: 260 }, alvo: (t) => paiVoo(t).p, scene: (t) => perseguicao(t) }),
  P(w("motoboy", "serve"), w("motoboy", "esse"), { tipo: "medio", keys: mov(w("motoboy", "serve"), w("motoboy", "esse"), lerpV(C_MED.pos, C_MED.look, 0.12), C_MED.look, lerpV(C_MED.pos, C_MED.look, 0.17), C_MED.look, C_MED.fov), near: 0.5, luz: LUZ_NINHO, alvo: BOCA, scene: (t) => serve(t, w("motoboy", "serve") - 0.15) }),
  P(w("motoboy", "esse"), S("requeijao"), { tipo: "medio", keys: mov(w("motoboy", "esse"), S("requeijao"), C0b.pos, C0.look, add(C0b.pos, [10, 0, 1]), C0.look, 30), near: 1, luz: LUZ_Q0, alvo: BOCA, scene: (t) => quadro0(t, t) }),
  // ---------- REQUEIJÃO ----------
  P(S("requeijao"), w("requeijao", "seu"), { tipo: "close", keys: mov(S("requeijao"), w("requeijao", "seu"), C_ARR.pos, C_ARR.look, add(C_ARR.pos, [4, 0, 5]), C_ARR.look, C_ARR.fov), near: 0.5, luz: LUZ_CAL, alvo: add(CAL_PAI, [-4, 14, 0]), scene: (t) => arrulho(t) }),
  P(w("requeijao", "seu"), w("requeijao", "com"), { tipo: "medio", keys: fixa(C_CAL.pos, C_CAL.look, C_CAL.fov), near: 0.5, luz: LUZ_CAL, alvo: add(CAL_PAI, [6, 12, 18]), scene: (t) => maePousa(t) }),
  P(w("requeijao", "com"), w("requeijao", "a"), { tipo: "medio", keys: mov(w("requeijao", "com"), w("requeijao", "a"), C_DOIS.pos, C_DOIS.look, add(C_DOIS.pos, [2, -2, 8]), C_DOIS.look, C_DOIS.fov), near: 0.5, luz: LUZ_CAL, alvo: add(CAL_PAI, [6, 12, 18]), scene: (t) => maePousa(t, true) }),
  P(w("requeijao", "a"), w("requeijao", "ai"), { tipo: "close", keys: mov(w("requeijao", "a"), w("requeijao", "ai"), C_PAR.pos, C_PAR.look, add(C_PAR.pos, [0, 0, 3]), C_PAR.look, C_PAR.fov), near: 0.3, luz: LUZ_CAL, alvo: PAPO_C, scene: (t) => papoCorte(t) }),
  P(w("requeijao", "ai"), w("requeijao", "esse"), { tipo: "close", keys: mov(w("requeijao", "ai"), w("requeijao", "esse"), C_PAR2.pos, C_PAR2.look, add(C_PAR2.pos, [2, 0, 3]), C_PAR2.look, C_PAR2.fov), near: 0.3, luz: LUZ_CAL, alvo: PAPO_C, scene: (t) => papoCorte(t) }),
  P(w("requeijao", "esse"), S("anonimo"), { tipo: "close", keys: mov(w("requeijao", "esse"), S("anonimo"), lerpV(C_RX.pos, C_RX.look, 0.15), C_RX.look, lerpV(C_RX.pos, C_RX.look, 0.4), C_RX.look, C_RX.fov), near: 0.3, luz: LUZ_NINHO, alvo: PAPO_A, scene: (t) => raioAlim(t, 0.75) }),
  // ---------- MODO ANÔNIMO ----------
  P(S("anonimo"), w("anonimo", "porque"), { tipo: "aberto", keys: mov(S("anonimo"), w("anonimo", "porque"), C_QUART.pos, C_QUART.look, add(C_QUART.pos, [-40, -10, -60]), C_QUART.look, C_QUART.fov), near: 2, luz: { foco: [200, 200, 600], raio: 900 }, alvo: [300, 150, 600], scene: (t) => visto(t) }),
  P(w("anonimo", "porque"), w("anonimo", "tamanho"), { tipo: "medio", keys: mov(w("anonimo", "porque"), w("anonimo", "tamanho"), C_JOV.pos, C_JOV.look, add(C_JOV.pos, [4, 0, -6]), C_JOV.look, C_JOV.fov), near: 0.5, luz: LUZ_NINHO, alvo: [-34, TOPO_AR + 10, 24], scene: (t) => jovemSai(t) }),
  P(w("anonimo", "tamanho"), w("anonimo", "esse"), { tipo: "medio", keys: fixa(C_JOV2.pos, C_JOV2.look, C_JOV2.fov), near: 0.5, luz: LUZ_NINHO, alvo: [-24, TOPO_AR + 11, 24], scene: (t) => jovemSai(t) }),
  P(w("anonimo", "esse"), S("rancor"), { tipo: "medio", keys: mov(w("anonimo", "esse"), S("rancor"), C_PRJ.pos, C_PRJ.look, add(C_PRJ.pos, [10, 0, 14]), C_PRJ.look, C_PRJ.fov), near: 1, luz: { foco: [540, 30, 930], raio: 180 }, alvo: JOVEM_PRACA, scene: (t) => pracaJovem(t) }),
  // ---------- RANCOR ----------
  P(S("rancor"), w("rancor", "pombo"), { tipo: "medio", keys: fixa(C_ZEL.pos, C_ZEL.look, C_ZEL.fov), near: 1, luz: LUZ_ZEL, alvo: [300, 90, 90], scene: (t) => enxota(t) }),
  P(w("rancor", "pombo"), w("rancor", "mesmo"), { tipo: "close", keys: mov(w("rancor", "pombo"), w("rancor", "mesmo"), C_VIG.pos, C_VIG.look, add(C_VIG.pos, [3, 0, -6]), C_VIG.look, C_VIG.fov), near: 0.5, luz: LUZ_ZEL, alvo: add(VIGIA, [0, 18, 0]), scene: (t) => vigia(t) }),
  P(w("rancor", "mesmo"), w("rancor", "e"), { tipo: "medio", keys: mov(w("rancor", "mesmo"), w("rancor", "e"), add(C_VIG.pos, [6, 0, 4]), C_VIG.look, add(C_VIG.pos, [12, 2, 10]), C_VIG.look, C_VIG.fov), near: 1, luz: LUZ_ZEL, alvo: [200, 60, 160], scene: (t) => vigia(t, true) }),
  P(w("rancor", "e"), w("rancor", "esse"), { tipo: "medio", keys: mov(w("rancor", "e"), w("rancor", "esse"), C_SEM.pos, C_SEM.look, add(C_SEM.pos, [-25, -6, -30]), C_SEM.look, C_SEM.fov), near: 1, luz: LUZ_ZEL, alvo: [260, 90, 120], scene: (t) => semEnxotar(t) }),
  P(w("rancor", "esse"), S("virada"), { tipo: "close", keys: mov(w("rancor", "esse"), S("virada"), C_VIG.pos, C_VIG.look, add(C_VIG.pos, [4, 0, -5]), C_VIG.look, C_VIG.fov), near: 0.5, luz: LUZ_ZEL, alvo: add(VIGIA, [0, 18, 0]), scene: (t) => rancorClose(t) }),
  // ---------- VIRADA ----------
  P(S("virada"), w("virada", "so"), { tipo: "medio", keys: C_ANDA(S("virada"), w("virada", "so")), near: 0.5, luz: LUZ_CAL, alvo: (t) => [40 - (t - S("virada")) * 14, 10, 205], scene: (t) => andaCalcada(t, S("virada")) }),
  P(w("virada", "so"), T_GAI(), { tipo: "medio", keys: mov(w("virada", "so"), T_GAI(), C_AZ.pos, C_AZ.look, add(C_AZ.pos, [0, 0, -60]), C_AZ.look, C_AZ.fov), near: 1, luz: { foco: [-240, 225, 0], raio: 160 }, alvo: [-240, 225, 0], scene: (t) => gaiola(t) }),
  P(T_GAI(), w("virada", "e"), { tipo: "medio", keys: fixa(C_GAI.pos, C_GAI.look, C_GAI.fov), near: 1, luz: { foco: [-180, 240, 40], raio: 180 }, alvo: [-190, 245, 40], scene: (t) => gaiola(t) }),
  P(w("virada", "e"), S("final"), { tipo: "medio", keys: mov(w("virada", "e"), S("final"), C_PIP.pos, C_PIP.look, add(C_PIP.pos, [30, -10, 60]), C_PIP.look, C_PIP.fov), near: 1, luz: { foco: [560, 60, 980], raio: 170 }, alvo: [550, 70, 1000], scene: (t) => pipoca(t) }),
  // ---------- FINAL (recap: REPLAY; cada flash roda uma cena já vista com o relógio dela) ----------
  P(S("final"), w("final", "leite"), { tipo: "medio", keys: fixa(C_EST.pos, C_EST.look, C_EST.fov), near: 0.5, luz: LUZ_NINHO, alvo: [-38, TOPO_AR + 10, 22], scene: (t) => estirao(t - S("final") + T_CRESCE0() + 0.3) }),
  P(w("final", "leite"), w("final", "driblou"), { tipo: "close", keys: fixa(C_RX.pos, C_RX.look, C_RX.fov), near: 0.3, luz: LUZ_NINHO, alvo: PAPO_A, scene: (t) => raioAlim(t, 0.75) }),
  P(w("final", "driblou"), w("final", "sumiu"), { tipo: "medio", keys: segue(w("final", "driblou"), w("final", "sumiu"), (t) => { const u = t - w("final", "driblou") + T_CRUZA() - 0.6; const m = lerpV(paiVoo(u).p, falcaoVoo(u).p, 0.5); return { pos: add(m, [-20, 10, 210]), look: m }; }, 42), near: 1, luz: { foco: [300, 250, 450], raio: 600 }, alvo: (t) => paiVoo(t - w("final", "driblou") + T_CRUZA() - 0.6).p, scene: (t) => perseguicao(t - w("final", "driblou") + T_CRUZA() - 0.6) }),
  P(w("final", "sumiu"), w("final", "e"), { tipo: "medio", keys: fixa(C_PRJ.pos, C_PRJ.look, C_PRJ.fov), near: 1, luz: { foco: [540, 30, 930], raio: 180 }, alvo: JOVEM_PRACA, scene: (t) => pracaJovem(t) }),
  P(w("final", "e"), w("final", "voce", 1), { tipo: "close", keys: fixa(C_VIG.pos, C_VIG.look, C_VIG.fov), near: 0.5, luz: LUZ_ZEL, alvo: add(VIGIA, [0, 18, 0]), scene: (t) => rancorClose(t) }),
  // último quadro = primeiro: o quadro 0 roda com u = t − FIM (em FIM, u = 0; câmera parada na chave 0)
  P(w("final", "voce", 1), FIM + 1 / FPS, { tipo: "medio", keys: fixa(C0.pos, C0.look, C0.fov), near: 1, luz: LUZ_Q0, alvo: BOCA, scene: (t) => quadro0(t - FIM, t - FIM) }),
];

// ---------- tela ----------
// "macho" nunca em amarelo (fica branco na legenda); "leite" pode ser amarelo
const limpa = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
const PALAVRAS = TL.cenas.flatMap((c) => c.words);
const WORDS: Word[] = PALAVRAS.map((x, i) => {
  const ehMacho = limpa(x.w) === "macho" || (limpa(x.w) === "de" && limpa(PALAVRAS[i + 1]?.w ?? "") === "macho");
  return { ...x, s: x.s + OFF, e: x.e + OFF, kw: ehMacho ? false : x.kw };
});
const Plano: React.FC<{ p: Plan }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = p.from + f / fps;
  const alvo = typeof p.alvo === "function" ? p.alvo(t) : p.alvo;
  return (
    <AbsoluteFill>
      <LookPalco cena="marquise_dia" plano={p.tipo} foco={p.luz.foco} raio={p.luz.raio} alvo={alvo} ajuste={p.ajuste} pos={!PREVIA}>
        <PomboCam t={t} keys={p.keys} near={p.near ?? 0.5} far={12000} />
        {p.scene(t)}
        {PREVIA ? <Desenha /> : null}
      </LookPalco>
    </AbsoluteFill>
  );
};
// prévia rápida (sem pós): desenha a cena direto (o LookPalco sem pós não chama o render)
const Desenha: React.FC = () => {
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 1);
  return null;
};
const telaDe = (pt: V3, k: { pos: V3; look: V3; fov: number }): [number, number] => {
  const cam = new THREE.PerspectiveCamera(k.fov, 1080 / 1920, 0.01, 6000);
  cam.position.set(...k.pos);
  cam.lookAt(new THREE.Vector3(...k.look));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const v = new THREE.Vector3(...pt).project(cam);
  return [(v.x + 1) * 540, (1 - v.y) * 960];
};
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
const NumeroTopo: React.FC<React.ComponentProps<typeof NumeroTopoKit>> = (p) => {
  const txt = String(p.numero);
  const cabe = Math.floor(930 / (txt.length * 0.72));
  return <NumeroTopoKit {...p} tamanho={Math.min(p.tamanho ?? 150, cabe)} />;
};
// cabeçalho fixo "FILHOTE DE POMBO": cheio desde o quadro 0 (o último quadro é igual ao primeiro); cresce em "pop" em "filhote"
const CabecalhoFilhote: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const naAbertura = t < S("estirao") - 0.2;
  const noLoop = t >= w("final", "voce", 1);
  if (!naAbertura && !noLoop) return null;
  const tp = w("filhote", "filhote");
  const pop = noLoop ? 0 : sm(clamp01((t - tp) / 0.18)) * (1 - sm(clamp01((t - tp - 0.18) / 0.3)));
  const grande = noLoop ? 0 : sm(clamp01((t - tp) / 0.25));
  const sai = noLoop ? 1 : (1 - sm(clamp01((t - (S("estirao") - 0.45)) / 0.25))) * (1 - sm(clamp01((t - w("filhote", "pombo") + 0.12) / 0.12)) * (1 - sm(clamp01((t - w("filhote", "e", 1) + 0.05) / 0.15))));
  // tamanho grande (2 linhas) fixo desde o quadro 0 e no loop: sem troca de quebra de linha; o "pop" em "filhote" é só escala
  const tam = 96;
  void grande;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 150, left: 60, right: 60, textAlign: "center", opacity: sai, transform: `scale(${1 + 0.12 * pop})`, transformOrigin: "50% 0%", fontFamily: FONT_KIT, fontWeight: 900, fontSize: tam, lineHeight: 1, color: "#FFFFFF", WebkitTextStroke: `${Math.round(tam / 9)}px ${TINTA}`, paintOrder: "stroke fill", textShadow: "0 6px 14px rgba(0,0,0,0.35)" }}>
        FILHOTE DE POMBO
      </div>
    </AbsoluteFill>
  );
};
// contador de idade do menino (4 → 18 ANOS), chega em 18 na palavra "anos"
const ContaIdade: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const n = Math.round(idadeMenino(t));
  const a = sm(clamp01((t - de) / 0.25)) * (1 - sm(clamp01((t - (ate - 0.2)) / 0.2)));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 190, width: "100%", textAlign: "center", opacity: a, fontFamily: FONT_KIT, fontWeight: 900, fontSize: 150, color: n >= 18 ? AMARELO : "#FFFFFF", WebkitTextStroke: `14px ${TINTA}`, paintOrder: "stroke fill", fontVariantNumeric: "tabular-nums" }}>
        {n} ANOS
      </div>
    </AbsoluteFill>
  );
};
// contador da parede do papo: 1× → 20× (chega em 20× na palavra "vinte")
const ContaParede: React.FC<{ de: number; ate: number }> = ({ de, ate }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const n = Math.max(1, Math.round(mix(1, 20, seg01(t, T_PAR0() + 0.2, w("requeijao", "vinte")))));
  const a = sm(clamp01((t - de) / 0.25)) * (1 - sm(clamp01((t - (ate - 0.2)) / 0.2)));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 1440, width: "100%", textAlign: "center", opacity: a, fontFamily: FONT_KIT }}>
        <div style={{ fontWeight: 900, fontSize: 160, lineHeight: 1, color: n >= 20 ? AMARELO : "#FFFFFF", WebkitTextStroke: `15px ${TINTA}`, paintOrder: "stroke fill", fontVariantNumeric: "tabular-nums" }}>{n}×</div>
        <div style={{ fontWeight: 900, fontSize: 58, lineHeight: 1.05, color: "#FFFFFF", WebkitTextStroke: `8px ${TINTA}`, paintOrder: "stroke fill", marginTop: 6 }}>MAIS GROSSA</div>
      </div>
    </AbsoluteFill>
  );
};
// lupa que procura o filhote e não acha
const Lupa: React.FC<{ de: number; ate: number; pontos: [number, number][]; interroga?: boolean; achou?: boolean }> = ({ de, ate, pontos, interroga = true, achou = false }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const a = sm(clamp01((t - de) / 0.25)) * (1 - sm(clamp01((t - (ate - 0.2)) / 0.2)));
  const u = clamp01((t - de) / Math.max(0.1, ate - de - 0.2)) * (pontos.length - 1);
  const i = Math.min(pontos.length - 2, Math.floor(u));
  const k = sm(u - i);
  const x = mix(pontos[i][0], pontos[i + 1][0], k), y = mix(pontos[i][1], pontos[i + 1][1], k);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: a }}>
        <line x1={x + 92} y1={y + 92} x2={x + 190} y2={y + 190} stroke={TINTA} strokeWidth={46} strokeLinecap="round" />
        <line x1={x + 92} y1={y + 92} x2={x + 190} y2={y + 190} stroke="#8A5A2B" strokeWidth={30} strokeLinecap="round" />
        <circle cx={x} cy={y} r={120} fill="rgba(220,240,255,0.12)" stroke={TINTA} strokeWidth={22} />
        <circle cx={x} cy={y} r={120} fill="none" stroke="#FFFFFF" strokeWidth={10} />
        {achou ? (
          <g opacity={sm(clamp01((u - (pontos.length - 1.6)) / 0.5))}>
            <circle cx={x} cy={y} r={104} fill="#EFE3D2" />
            <ellipse cx={x} cy={y + 30} rx={62} ry={52} fill="#E9B9AE" />
            <circle cx={x - 6} cy={y - 28} r={40} fill="#EDC0B4" />
            {Array.from({ length: 22 }, (_, i) => {
              const a2 = -2.6 + (i / 21) * 2.2;
              const r0 = 36 + (i % 3) * 4;
              return <line key={i} x1={x - 6 + Math.cos(a2) * r0} y1={y - 28 + Math.sin(a2) * r0} x2={x - 6 + Math.cos(a2) * (r0 + 22 + (i % 4) * 5)} y2={y - 28 + Math.sin(a2) * (r0 + 22 + (i % 4) * 5)} stroke="#F2D24B" strokeWidth={6} strokeLinecap="round" />;
            })}
            <path d={`M ${x - 26} ${y - 30} q 10 7 20 0`} stroke="#5A4048" strokeWidth={5} fill="none" strokeLinecap="round" />
            <path d={`M ${x + 14} ${y - 28} l 34 6 l -32 12 z`} fill="#D9C2A8" stroke="#8E7460" strokeWidth={3} />
          </g>
        ) : null}
        {interroga ? (
          <text x={x} y={y + 38} textAnchor="middle" fontFamily={FONT_KIT} fontWeight={900} fontSize={110} fill="#FFFFFF" stroke={TINTA} strokeWidth={10} paintOrder="stroke">?</text>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};
// "swish" que cobre a troca de roupa do zelador (0,3 s, visível)
const Swish: React.FC<{ t0: number; x: number; y: number }> = ({ t0, x, y }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const u = (t - t0) / 0.3;
  if (u < 0 || u > 1) return null;
  const a = Math.sin(PI * u);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${x - 170} ${y - 120 + i * 90} Q ${x} ${y - 200 + i * 90} ${x + 170} ${y - 100 + i * 90}`} fill="none" stroke="#FFFFFF" strokeWidth={34 * a} strokeLinecap="round" opacity={0.95 * a} strokeDasharray={`${400 * u} 600`} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
const Gota: React.FC<{ de: number; ate: number; x: number; y: number }> = ({ de, ate, x, y }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < de || t >= ate) return null;
  const pop = sm(clamp01((t - de) / 0.3));
  const out = 1 - sm(clamp01((t - (ate - 0.2)) / 0.2));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: out }}>
      <IconeGota x={x} y={y} pop={pop} escala={1} />
    </AbsoluteFill>
  );
};

// posições de tela
const camDe = (i: number, t: number) => {
  const p = PLANS[i];
  const k = p.keys;
  const a = k[0], b = k[k.length - 1];
  const u = clamp01((t - a.t) / Math.max(1e-3, b.t - a.t));
  return { pos: lerpV(a.pos, b.pos, u), look: lerpV(a.look, b.look, u), fov: a.fov ?? 38 };
};
const iPlano = (t: number) => PLANS.findIndex((p) => t >= p.from && t < p.to);
const PX_PAPO_RX = telaDe(add(PAPO_A, [0, -3.5, 0]), camDe(iPlano(w("filhote", "papo")), w("filhote", "papo")));
const PX_PAI_RX = telaDe(add(PAI_A, [0, 24, 0]), camDe(iPlano(w("filhote", "pai")), w("filhote", "pai")));
const PX_ZEL = telaDe(add(ZEL, [0, 178, 0]), C_ZEL);
const PX_PAPO_PAR = telaDe(PAPO_C, C_PAR);
const PX_MAE = telaDe(add(CAL_MAE, [-5, 12, 0]), camDe(iPlano(w("requeijao", "hormonio")), w("requeijao", "hormonio")));
const PX_PAI_18 = telaDe(add(CAL_PAI, [-5, 22, 0]), C_CAL);
const PX_MAE_18 = telaDe(add(CAL_MAE, [-5, 20, 0]), C_CAL);
const PX_PAI_CAL = telaDe(add(CAL_PAI, [-5, 13, 0]), camDe(iPlano(w("requeijao", "hormonio")), w("requeijao", "hormonio")));
const PX_ZEL_V = telaDe(add(zelAnda(T_TROCA()), [0, 130, 0]), camDe(iPlano(T_TROCA()), T_TROCA()));
const PX_NINHO_Q = telaDe([NX, TOPO_AR + 10, NZ], { pos: add(C_QUART.pos, [-40, -10, -60]), look: C_QUART.look, fov: C_QUART.fov });

export const PomboVideo: React.FC = () => {
  useKitFont();
  const fps = FPS;
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#C9D6E6" }}>
        {PLANS.map((p, i) => (
          <Sequence key={i} from={Math.round(p.from * fps)} durationInFrames={Math.max(1, Math.round(p.to * fps) - Math.round(p.from * fps))} layout="none">
            <Plano p={p} />
          </Sequence>
        ))}
        {/* gancho e filhote */}
        <CabecalhoFilhote />
        <Rotulo de={w("filhote", "papo")} ate={S("estirao")} texto="PAPO" x={Math.min(860, PX_PAPO_RX[0] + 190)} y={Math.min(1180, PX_PAPO_RX[1] + 300)} alvo={PX_PAPO_RX} tamanho={96} cor={AMARELO} largura={420} />
        <Rotulo de={w("filhote", "pai")} ate={S("estirao")} texto="PAI" x={Math.max(220, PX_PAI_RX[0] - 200)} y={Math.max(420, PX_PAI_RX[1] - 260)} alvo={PX_PAI_RX} tamanho={96} largura={360} />
        {/* estirão */}
        <NumeroTopo de={w("estirao", "quatro")} ate={w("estirao", "um")} numero="4 SEMANAS" tamanho={140} />
        <ContaIdade de={w("estirao", "humano")} ate={w("estirao", "esse")} />
        <Etiqueta de={w("estirao", "esse")} ate={S("motoboy")} texto="4 SEMANAS vs 18 ANOS" y={1560} tamanho={52} />
        <Etiqueta de={w("filhote", "pombo") + 0.05} ate={w("filhote", "e", 1)} texto="FALCÃO" y={1560} cor="#FF5A4A" tamanho={52} />
        <ApelidoAmarelo de={w("estirao", "estirao")} ate={S("motoboy")} texto="Estirão" />
        {/* motoboy */}
        <NumeroTopo de={w("motoboy", "fome")} ate={w("motoboy", "por")} numero="FOME DANADA" tamanho={104} />
        <NumeroTopo de={w("motoboy", "falcao-peregrino")} ate={w("motoboy", "que")} numero="FALCÃO-PEREGRINO" tamanho={110} />
        <ApelidoAmarelo de={w("motoboy", "motoboy")} ate={S("requeijao")} texto="Motoboy" />
        {/* requeijão */}
        <Rotulo de={w("requeijao", "pai")} ate={w("requeijao", "com")} texto="PAI" x={Math.min(880, Math.max(200, PX_PAI_18[0] - 200))} y={Math.min(1180, PX_PAI_18[1] + 240)} alvo={PX_PAI_18} tamanho={84} largura={300} />
        <Rotulo de={w("requeijao", "mae")} ate={w("requeijao", "com")} texto="MÃE" x={Math.min(880, Math.max(200, PX_MAE_18[0] + 200))} y={Math.max(460, PX_MAE_18[1] - 230)} alvo={PX_MAE_18} tamanho={84} largura={300} />
        <NumeroTopo de={w("requeijao", "hormonio")} ate={w("requeijao", "a")} numero="PROLACTINA" tamanho={130} />
        <Rotulo de={w("requeijao", "hormonio")} ate={w("requeijao", "a")} texto="PAI" x={Math.min(880, Math.max(200, PX_PAI_CAL[0] - 220))} y={Math.min(1180, PX_PAI_CAL[1] + 200)} alvo={PX_PAI_CAL} tamanho={84} largura={300} />
        <Rotulo de={w("requeijao", "hormonio") + 0.1} ate={w("requeijao", "a")} texto="MÃE" x={Math.min(880, Math.max(200, PX_MAE[0] + 220))} y={Math.max(460, PX_MAE[1] - 230)} alvo={PX_MAE} tamanho={84} largura={300} />
        <Gota de={w("requeijao", "leite")} ate={w("requeijao", "a")} x={450} y={1530} />
        <ContaParede de={w("requeijao", "parede")} ate={w("requeijao", "ai")} />
        <Rotulo de={w("requeijao", "ai") + 0.2} ate={w("requeijao", "esse")} texto="PASTA" x={Math.min(820, PX_PAPO_PAR[0] + 220)} y={Math.min(1150, PX_PAPO_PAR[1] + 300)} alvo={PX_PAPO_PAR} tamanho={90} cor={AMARELO} largura={420} />
        <ApelidoAmarelo de={w("requeijao", "requeijao")} ate={S("anonimo")} texto="Requeijão" />
        {/* modo anônimo */}
        <Lupa de={S("anonimo") + 0.1} ate={w("anonimo", "porque")} pontos={[[320, 1100], [760, 950], [520, 1000], [PX_NINHO_Q[0], PX_NINHO_Q[1]]]} interroga={false} achou />
        <NumeroTopo de={w("anonimo", "quase")} ate={w("anonimo", "porque")} numero="QUASE NINGUÉM VIU" tamanho={100} />
        <NumeroTopo de={w("anonimo", "tamanho")} ate={w("anonimo", "esse")} numero="TAMANHO DE ADULTO" tamanho={100} />
        <Lupa de={w("anonimo", "esse")} ate={S("rancor")} pontos={[[280, 1150], [760, 1100], [540, 1180]]} />
        <ApelidoAmarelo de={w("anonimo", "modo")} ate={S("rancor")} texto="Modo anônimo" tamanho={86} />
        {/* rancor */}
        <Rotulo de={w("rancor", "marcado")} ate={w("rancor", "pombo")} texto="MARCADO" x={Math.min(820, Math.max(260, PX_ZEL[0]))} y={Math.max(380, PX_ZEL[1] - 170)} alvo={PX_ZEL} tamanho={96} cor={AMARELO} largura={560} />
        <NumeroTopo de={w("rancor", "reconhece")} ate={w("rancor", "mesmo")} numero="RECONHECE" tamanho={130} y={80} />
        <Swish t0={T_TROCA() - 0.03} x={PX_ZEL_V[0]} y={PX_ZEL_V[1]} />
        <NumeroTopo de={w("rancor", "roupa") + 0.1} ate={w("rancor", "e")} numero="ROUPA TROCADA" tamanho={120} y={80} />
        <NumeroTopo de={w("rancor", "mesmo", 1)} ate={w("rancor", "esse")} numero="MESMO SEM ENXOTAR" tamanho={100} y={80} />
        <ApelidoAmarelo de={w("rancor", "rancor")} ate={S("virada")} texto="Rancor" y={90} />
        {/* virada */}
        <NumeroTopo de={w("virada", "rato")} ate={w("virada", "so")} numero="RATO COM ASA?" tamanho={120} />
        <NumeroTopo de={w("virada", "trouxe")} ate={w("virada", "e")} numero="SÉCULO XVI" sub="ave de criação" tamanho={130} />
        <NumeroTopo de={w("virada", "tambem")} ate={S("final")} numero="GENTE" tamanho={170} corNumero={AMARELO} />
        {/* recap */}
        <Etiqueta de={S("final")} ate={w("final", "voce", 1)} texto="REPLAY" y={1560} cor={AMARELO} />
        <ApelidoAmarelo de={S("final")} ate={w("final", "leite")} texto="Estirão" />
        <ApelidoAmarelo de={w("final", "leite")} ate={w("final", "driblou")} texto="Requeijão" />
        <ApelidoAmarelo de={w("final", "driblou")} ate={w("final", "sumiu")} texto="Motoboy" y={640} />
        <ApelidoAmarelo de={w("final", "sumiu")} ate={w("final", "e")} texto="Modo anônimo" tamanho={86} />
        <ApelidoAmarelo de={w("final", "e")} ate={w("final", "voce", 1)} texto="Rancor" y={90} />
        <Legenda1Palavra palavras={WORDS} />
        <Sequence from={Math.round(OFF * FPS)} layout="none">
          <Audio src={staticFile("pombo/narracao.wav")} />
        </Sequence>
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
void HUMANO;
void pipoca;
