import * as THREE from "three";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { HumanoAzul } from "../animais/LagartixaHumano";
import { bocaLocal, matrizRaiz, pontaBicoLocal, pontoCabeca, PoseAve } from "./Ave";
import { Carcara, POSE_CARCARA } from "./Carcara";
import { Falcao, poseFalcao, poseFalcaoFreio, poseFalcaoMergulho, poseFalcaoVoo } from "./Falcao";
import { especieFilhote, Filhote, poseFilhoteDeitado, poseFilhotePedindo, tamanhoFilhote } from "./Filhote";
import { HomemPipoca, MeninoCrescendo, Pipoca, Zelador } from "./Humanos";
import { IconeGota } from "./IconeGota";
import { HUMANO, LKey, LuzDia, mix, PalcoDia, PomboCam, seg01, sm, V3 } from "./PomboComum";
import { andarPombo, Pombo, POMBO, poseAlimentar, poseArrulho, poseBicar, POSE_PARADO, poseVoo } from "./Pombo";
import { ANTENA_PAREDE_POUSO, ANTENA_VIZ_POUSO, AR, BANCO, FIO, FIO_POUSO, GAIOLA_AZULEJO, JANELA, MARQ, NINHO_Q, NINHO_Q_FUNDO, PORTA, Quarteirao } from "./Quarteirao";

// =====================================================================
// LABORATÓRIO DO KIT POMBO (quarteirão do roteiro aprovado v4). Cada setup tem a sua duração; LAB_INI[i] = início.
// Unidade: cm. A luz fica SÓ aqui (LuzDia), nunca dentro dos modelos — o módulo de look pode trocá-la.
// =====================================================================
type S = { nome: string; dur?: number; cam: LKey[]; near?: number; roll?: number; luz?: { foco: V3; raio: number }; el: (t: number, tl: number) => React.ReactNode; ui?: (tl: number) => React.ReactNode };

const NX = NINHO_Q[0], NZ = NINHO_Q[2];
const TOPO_AR = AR.y1;
// pai parado em cima do ar-condicionado, à direita do ninho, olhando para o ninho (−x)
const PAI_POS: V3 = [-50, TOPO_AR, 26];
const OLHA_X_NEG: V3 = [0, Math.PI / 2, 0]; // (nome antigo) o pai olha +x, para o ninho
const OLHA_RUA: V3 = [0, 0, 0];
const FALCAO_ROT: V3 = [0, 0, 0]; // de frente para a rua (+z); olhar −70° = vira a cabeça para o ninho (−x)
const FALCAO_POS: V3 = ANTENA_PAREDE_POUSO; // (ANTENA_VIZ_POUSO = alternativa no vizinho)
void ANTENA_VIZ_POUSO;

// ---------- alimentação (cinemática pura): filhote no ninho olhando +x, pai em cima do ar à direita ----------
const IDADE_ALIM = 10; // filhote que já alcança alto: o pai quase não dobra o pescoço (sem corneta)
const FILHOTE_POS: V3 = [NX - 1, NINHO_Q_FUNDO, NZ];
const FILHOTE_ROT: V3 = [0, Math.PI / 2 - 0.55, 0]; // olha para +x (o pai) e um pouco para a rua
// cinemática pura: o pai pisa no topo do ar (lado esquerdo) olhando +x; procura o quanto baixar o pescoço
// para a boca dele (entre as mandíbulas) encontrar a ponta do bico do filhote; o resto vira corpoY (±2 cm).
const BICO_ALIM = 0.5; // bico do pai pouco aberto
export const cenaAlimentar = (t: number, k = 1, cotos = 0) => {
  const { E: Ef, escala: ef } = especieFilhote(IDADE_ALIM);
  const pf = poseFilhotePedindo(IDADE_ALIM, k, t, cotos);
  const ponta = pontoCabeca(Ef, pf, pontaBicoLocal(Ef)).applyMatrix4(matrizRaiz(FILHOTE_POS, FILHOTE_ROT, ef));
  const rotP: V3 = [0, -Math.PI / 2 + 0.3, 0]; // pai olha −x (para o filhote e para o sol)
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotP));
  let melhor = { b: 1, err: 1e9 };
  for (let i = 0; i <= 40; i++) {
    const b = 0.15 + (i / 40) * 0.55; // pescoço mais erguido (pose próxima do plano 8)
    const ps = { ...poseAlimentar(t, 1, 1.6, b), bico: BICO_ALIM, corpoY: 0 };
    const m = pontoCabeca(POMBO, ps, bocaLocal(POMBO, BICO_ALIM)).applyMatrix4(R);
    const err = Math.abs(TOPO_AR + m.y - ponta.y);
    if (err < melhor.err) melhor = { b, err };
  }
  const base: PoseAve = { ...poseAlimentar(t, k, 1.6, melhor.b), bico: BICO_ALIM * k };
  // posição dos pés FIXA: calculada na pose final (k = 1) sem o pulso → os pés não deslizam na entrada nem no bombear
  const fin: PoseAve = { ...poseAlimentar(0.25 / 1.6 + 0.5 / 1.6, 1, 1.6, melhor.b), bico: BICO_ALIM, corpoY: 0 };
  const pfFin = poseFilhotePedindo(IDADE_ALIM, 1, 0, 0);
  const pontaFin = pontoCabeca(Ef, pfFin, pontaBicoLocal(Ef)).applyMatrix4(matrizRaiz(FILHOTE_POS, FILHOTE_ROT, ef));
  const Rf = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotP));
  const bocaFin = pontoCabeca(POMBO, fin, bocaLocal(POMBO, BICO_ALIM)).applyMatrix4(Rf);
  const corpoY = Math.max(-4, Math.min(2, pontaFin.y - (TOPO_AR + bocaFin.y))) * k;
  const posP: V3 = [pontaFin.x - bocaFin.x, TOPO_AR, pontaFin.z - bocaFin.z];
  void R;
  return { pf, pp: { ...base, corpoY }, posP, rotP, ponta };
};
const Alimentando: React.FC<{ t: number; k?: number; cotos?: number; raio?: { parede: number; leite: number; soltar: number; fluxo: number; lado?: 1 | -1 } }> = ({ t, k = 1, cotos = 0, raio }) => {
  const c = cenaAlimentar(t, k, cotos);
  const corte = raio ? new THREE.Vector4(0, 0, 0, 1) : undefined;
  return (
    <>
      <Pombo t={t} pose={c.pp} position={c.posP} rotation={c.rotP} raioX={raio ? { corte, papo: raio } : undefined} />
      <Filhote idade={IDADE_ALIM} t={t} pose={c.pf} position={FILHOTE_POS} rotation={FILHOTE_ROT} />
    </>
  );
};
// pombos da praça bicando a pipoca em volta do homem do banco
const PRACA_POMBOS: { p: V3; r: number; f: number; femea?: boolean }[] = [
  { p: [520, 0, 945], r: 2.6, f: 1.3 },
  { p: [585, 0, 935], r: -2.2, f: 1.5, femea: true },
  { p: [470, 0, 960], r: 1.9, f: 1.2 },
  { p: [625, 0, 960], r: -1.4, f: 1.4 },
];
const MAO_PIPOCA: V3 = [BANCO[0] - 30, 105, BANCO[2] - 25];
const Praca: React.FC<{ t: number }> = ({ t }) => (
  <>
    <HomemPipoca t={t} position={[BANCO[0], 0, BANCO[2] + 2]} rotation={[0, Math.PI, 0]} />
    <Pipoca t={t} t0={0} mao={MAO_PIPOCA} alvo={[BANCO[0], 0, 950]} raio={70} levas={30} periodo={1.6} />
    {PRACA_POMBOS.map((q, i) => (
      <Pombo key={i} femea={q.femea} t={t} pose={poseBicar(t + i * 0.37, 1, q.f)} position={q.p} rotation={[0, q.r, 0]} sombra />
    ))}
  </>
);
// tudo que está no quadro 0 (o "mundo" de fundo)
const Mundo: React.FC<{ t: number; ninho?: boolean; falcao?: boolean; olharFalcao?: number; mae?: boolean; praca?: boolean; zelador?: boolean; janela?: boolean }> = ({ t, ninho = true, falcao = true, olharFalcao = 0, mae = true, praca = true, zelador = true, janela = true }) => (
  <>
    <Quarteirao ninho={ninho} />
    {falcao ? <Falcao t={t} pose={poseFalcao(olharFalcao)} position={FALCAO_POS} rotation={FALCAO_ROT} /> : null}
    {mae ? <Pombo femea t={t} pose={{ ...POSE_PARADO, pes: { e: [1.4, 0.2, 0.8], d: [-1.4, 0.2, 0.8] } }} position={[FIO_POUSO[0], FIO_POUSO[1], FIO_POUSO[2] - 0.8]} rotation={[0, 0.25, 0]} /> : null}
    {praca ? <Praca t={t} /> : null}
    {zelador ? <Zelador t={t} roupa="A" position={[PORTA.x0 - 40, 0, 70]} rotation={[0, 0.9, 0]} /> : null}
    {janela ? (
      <>
        <HumanoAzul t={t} escala={HUMANO} position={[JANELA.x0 + 40, JANELA.y0 - 39, -90]} rotation={[0, 0.2, 0]} />
        <MeninoCrescendo t={t} idade={7} position={[JANELA.x0 + 95, JANELA.y0 - 39, -80]} rotation={[0, -0.2, 0]} />
      </>
    ) : null}
  </>
);
const Chao: React.FC<{ y?: number }> = ({ y = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
    <planeGeometry args={[3000, 3000]} />
    <meshStandardMaterial color="#B0A99D" roughness={0.95} />
  </mesh>
);
const giro = (u: number, c: V3, r: number, h: number): V3 => [c[0] + Math.sin(u * Math.PI * 2) * r, h, c[2] + Math.cos(u * Math.PI * 2) * r];
const PF = cenaAlimentar(0).ponta;

const LAB: S[] = [
  // ---------- 0–3 cenário ----------
  {
    nome: "QUADRO 0: pai alimenta, papo estufado, falcão na antena", near: 1,
    cam: [{ t: 0, pos: [-84, 287, 30], look: [14, 262, 23.7], fov: 40 }],
    luz: { foco: [-300, 280, 20], raio: 520 },
    el: (t) => <><Mundo t={t} janela={false} zelador={false} /><Alimentando t={t} /></>,
  },
  {
    nome: "contraplano: falcão vira a cabeça (1 s)", near: 1,
    cam: [{ t: 0, pos: [FALCAO_POS[0] + 40, FALCAO_POS[1] + 22, FALCAO_POS[2] + 75], look: [FALCAO_POS[0], FALCAO_POS[1] + 18, FALCAO_POS[2]], fov: 30 }],
    luz: { foco: FALCAO_POS, raio: 60 },
    el: (t, tl) => <><Mundo t={t} praca={false} falcao={false} /><Alimentando t={t} /><Falcao t={t} pose={poseFalcao(-70 * sm(seg01(tl, 0.15, 0.75)), 6)} position={FALCAO_POS} rotation={FALCAO_ROT} /></>,
  },
  {
    nome: "quarteirão inteiro (da praça)", near: 2,
    cam: [{ t: 0, pos: [760, 330, 1350], look: [60, 240, 0], fov: 42 }],
    luz: { foco: [200, 200, 600], raio: 900 },
    el: (t) => <><Mundo t={t} /><Alimentando t={t} /></>,
  },
  {
    nome: "de baixo da marquise: rua e praça", near: 1,
    cam: [{ t: 0, pos: [-120, 300, 30], look: [300, 120, 900], fov: 44 }],
    luz: { foco: [200, 150, 500], raio: 700 },
    el: (t) => <><Mundo t={t} /><Alimentando t={t} /></>,
  },
  // ---------- 4–12 pombo adulto ----------
  { nome: "macho perfil (em cima do ar)", near: 0.5, cam: [{ t: 0, pos: [-50, TOPO_AR + 13, 95], look: [-50, TOPO_AR + 11, 26], fov: 30 }], luz: { foco: [-50, TOPO_AR + 10, 25], raio: 50 }, el: (t) => <><Mundo t={t} ninho={false} /><Pombo t={t} pose={POSE_PARADO} position={PAI_POS} rotation={OLHA_X_NEG} /></> },
  { nome: "macho 3/4 frente", near: 0.5, cam: [{ t: 0, pos: [-12, TOPO_AR + 22, 72], look: [-50, TOPO_AR + 11, 26], fov: 30 }], luz: { foco: [-50, TOPO_AR + 10, 25], raio: 50 }, el: (t) => <><Mundo t={t} ninho={false} /><Pombo t={t} pose={POSE_PARADO} position={PAI_POS} rotation={OLHA_X_NEG} /></> },
  { nome: "cabeça close (pescoço iridescente)", near: 0.2, cam: [{ t: 0, pos: [-38, TOPO_AR + 20, 46], look: [-44, TOPO_AR + 17, 26], fov: 30 }], luz: { foco: [-45, TOPO_AR + 15, 25], raio: 30 }, el: (t) => <><Mundo t={t} ninho={false} /><Pombo t={t} pose={POSE_PARADO} position={PAI_POS} rotation={OLHA_X_NEG} /></> },
  {
    nome: "andando na calçada (2 s, balanço de cabeça)", dur: 2, near: 0.5,
    cam: [{ t: 0, pos: [44, 16, 290], look: [44, 10, 190], fov: 30, lin: true }, { t: 2, pos: [16, 16, 290], look: [16, 10, 190], fov: 30 }],
    luz: { foco: [25, 10, 190], raio: 60 },
    el: (t, tl) => {
      const dist = tl * 14;
      const a = andarPombo(POMBO, dist);
      return <><Mundo t={t} /><Pombo t={t} pose={{ ...POSE_PARADO, pes: a.pes, avancoCab: a.avancoCab, corpoY: a.corpoY }} position={[52 - dist, 0, 190]} rotation={OLHA_X_NEG} /></>;
    },
  },
  { nome: "arrulhando, papo estufado (2 s)", dur: 2, near: 0.5, cam: [{ t: 0, pos: [-12, TOPO_AR + 18, 72], look: [-48, TOPO_AR + 13, 26], fov: 32 }], luz: { foco: [-50, TOPO_AR + 10, 25], raio: 50 }, el: (t, tl) => <><Mundo t={t} ninho={false} /><Pombo t={t} pose={poseArrulho(tl, sm(tl / 0.6))} position={PAI_POS} rotation={[0, Math.PI / 2 + tl * 0.4, 0]} /></> },
  {
    nome: "voando para a praça (2 s, câmera lenta)", dur: 2, near: 1,
    cam: [{ t: 0, pos: [-50, 305, 310], look: [0, 290, 250], fov: 32, lin: true }, { t: 2, pos: [110, 175, 660], look: [160, 160, 600], fov: 32 }],
    luz: { foco: [100, 200, 450], raio: 300 },
    el: (t, tl) => <><Mundo t={t} /><Pombo t={t} pose={poseVoo(tl, 3)} position={[mix(0, 160, tl / 2), mix(290, 160, tl / 2), mix(250, 600, tl / 2)]} rotation={[0.25, 0.4, 0]} /></>,
  },
  {
    nome: "pombos bicando a pipoca do homem azul (2 s)", dur: 2, near: 1,
    cam: [{ t: 0, pos: [420, 95, 720], look: [555, 55, 990], fov: 42 }],
    luz: { foco: [560, 30, 960], raio: 150 },
    el: (t) => <Mundo t={t} />,
  },
  { nome: "mãe no fio do poste", near: 1, cam: [{ t: 0, pos: [20, FIO.y - 18, 400], look: [FIO_POUSO[0], FIO.y + 12, FIO.z], fov: 30 }], luz: { foco: [FIO_POUSO[0], FIO.y, FIO.z], raio: 60 }, el: (t) => <Mundo t={t} /> },
  { nome: "macho (atrás) × fêmea (frente), de perfil", near: 0.5, cam: [{ t: 0, pos: [0, 46, 100], look: [0, 9, -6], fov: 34 }], luz: { foco: [0, 10, -5], raio: 50 }, el: (t) => <><Chao /><Pombo t={t} pose={POSE_PARADO} position={[0, 0, -22]} rotation={OLHA_X_NEG} /><Pombo femea t={t} pose={POSE_PARADO} position={[0, 0, 12]} rotation={OLHA_X_NEG} /></> },
  // ---------- 13–18 filhote ----------
  {
    nome: "régua: adulto, filhote 26, 7 e 0 dias (de trás para a frente)", near: 0.3, cam: [{ t: 0, pos: [0, 50, 82], look: [0, 4, -12], fov: 34 }], luz: { foco: [0, 5, -10], raio: 50 },
    el: (t) => <><Chao /><Pombo t={t} pose={POSE_PARADO} position={[0, 0, -42]} rotation={OLHA_X_NEG} /><Filhote idade={26} t={t} position={[0, 0, -18]} rotation={[0, Math.PI / 2, 0]} /><Filhote idade={7} t={t} position={[2, 0, 2]} rotation={[0, Math.PI / 2, 0]} /><Filhote idade={0} t={t} position={[2, 0, 14]} rotation={[0, Math.PI / 2, 0]} /></>,
  },
  {
    nome: "filhotes de perfil: 0, 3, 7, 14 dias", near: 0.2, cam: [{ t: 0, pos: [0, 30, 48], look: [0, 3, -10], fov: 32 }], luz: { foco: [0, 4, -10], raio: 35 },
    el: (t) => <><Chao /><Filhote idade={14} t={t} position={[0, 0, -28]} rotation={[0, Math.PI / 2, 0]} /><Filhote idade={7} t={t} position={[0, 0, -12]} rotation={[0, Math.PI / 2, 0]} /><Filhote idade={3} t={t} position={[0, 0, -2]} rotation={[0, Math.PI / 2, 0]} /><Filhote idade={0} t={t} position={[0, 0, 6]} rotation={[0, Math.PI / 2, 0]} /></>,
  },
  { nome: "recém-nascido (d0) no ninho", near: 0.1, cam: [{ t: 0, pos: [NX + 10, NINHO_Q_FUNDO + 9, NZ + 12], look: [NX + 0.5, NINHO_Q_FUNDO + 1.6, NZ + 0.5], fov: 30 }], luz: { foco: [NX, NINHO_Q_FUNDO, NZ], raio: 25 }, el: (t) => <><Mundo t={t} /><Filhote idade={0} t={t} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, 0.25, 0]} /></> },
  { nome: "1 semana (d7): canhões", near: 0.1, cam: [{ t: 0, pos: [NX + 19, NINHO_Q_FUNDO + 16, NZ + 23], look: [NX + 1, NINHO_Q_FUNDO + 3.5, NZ + 1], fov: 30 }], luz: { foco: [NX, NINHO_Q_FUNDO, NZ], raio: 25 }, el: (t) => <><Mundo t={t} /><Filhote idade={7} t={t} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, 0.25, 0]} /></> },
  { nome: "4 semanas (d26): quase adulto", near: 0.2, cam: [{ t: 0, pos: [NX + 24, NINHO_Q_FUNDO + 18, NZ + 42], look: [NX, NINHO_Q_FUNDO + 8, NZ], fov: 30 }], luz: { foco: [NX, NINHO_Q_FUNDO, NZ], raio: 40 }, el: (t) => <><Mundo t={t} /><Filhote idade={26} t={t} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, 0.7, 0]} /></> },
  {
    nome: "crescimento 0→28 d (4 s)", dur: 4, near: 0.1,
    cam: [{ t: 0, pos: [NX + 9, NINHO_Q_FUNDO + 8, NZ + 12], look: [NX, NINHO_Q_FUNDO + 2, NZ], fov: 32 }, { t: 4, pos: [NX + 24, NINHO_Q_FUNDO + 18, NZ + 42], look: [NX, NINHO_Q_FUNDO + 8, NZ], fov: 32 }],
    luz: { foco: [NX, NINHO_Q_FUNDO + 4, NZ], raio: 40 },
    el: (t, tl) => <><Mundo t={t} /><Filhote idade={28 * seg01(tl, 0.2, 3.8)} t={t} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, 0.7, 0]} /></>,
  },
  {
    nome: "fantasma do filhote cresce até o pai (2 s)", dur: 2, near: 0.3,
    cam: [{ t: 0, pos: [-112, TOPO_AR + 15, 62], look: [-38, TOPO_AR + 11, 24], fov: 32 }],
    luz: { foco: [-38, TOPO_AR + 10, 25], raio: 45 },
    el: (t, tl) => (
      <>
        <Mundo t={t} />
        <Pombo t={t} pose={POSE_PARADO} position={[-22, TOPO_AR, 26]} rotation={[0, -Math.PI / 2, 0]} />
        <Filhote idade={6} t={t} position={[NX, NINHO_Q_FUNDO, NZ]} rotation={[0, 0.7, 0]} />
        <Filhote fantasma idade={6 + 22 * seg01(tl, 0.2, 1.8)} t={t} pose={{ ...poseFilhoteDeitado(6 + 22 * seg01(tl, 0.2, 1.8)), sentado: 0 }} position={[NX + 2, NINHO_Q_FUNDO, NZ + 4]} rotation={[0, Math.PI / 2, 0]} />
      </>
    ),
  },
  // ---------- 19–21 alimentação ----------
  { nome: "alimentando (3 s): papo pulsa", dur: 3, near: 0.3, cam: [{ t: 0, pos: [-40, NINHO_Q_FUNDO + 14, 88], look: [-40, NINHO_Q_FUNDO + 8, 24], fov: 32 }], luz: { foco: [-40, NINHO_Q_FUNDO + 6, 24], raio: 35 }, el: (t, tl) => <><Mundo t={t} /><Alimentando t={t} k={seg01(tl, 0, 0.8)} /></> },
  { nome: "médio-close de perfil: as duas cabeças + papo do pai (2 s)", dur: 2, near: 0.1, cam: [{ t: 0, pos: [PF.x + 2, PF.y + 6, PF.z + 46], look: [PF.x + 2.5, PF.y - 2.5, PF.z], fov: 30 }], luz: { foco: [NX + 8, NINHO_Q_FUNDO + 6, NZ], raio: 30 }, el: (t) => <><Mundo t={t} /><Alimentando t={t} /></> },
  { nome: "filhote solta e bate os cotos (1 s)", near: 0.2, cam: [{ t: 0, pos: [-60, NINHO_Q_FUNDO + 12, 62], look: [-46, NINHO_Q_FUNDO + 6, 24], fov: 32 }], luz: { foco: [-30, NINHO_Q_FUNDO + 6, 24], raio: 35 }, el: (t, tl) => <><Mundo t={t} /><Alimentando t={t} k={1 - seg01(tl, 0, 0.5)} cotos={seg01(tl, 0.2, 0.5)} /></> },
  // ---------- 22–25 raio-x ----------
  {
    nome: "raio-x varrendo (2 s)", dur: 2, near: 0.5,
    cam: [{ t: 0, pos: [-50, TOPO_AR + 14, 90], look: [-50, TOPO_AR + 12, 26], fov: 30 }], luz: { foco: [-50, TOPO_AR + 10, 25], raio: 50 },
    el: (t, tl) => {
      const y = TOPO_AR + mix(26, -2, seg01(tl, 0.2, 1.8));
      return <><Mundo t={t} ninho={false} /><Pombo t={t} pose={POSE_PARADO} position={PAI_POS} rotation={OLHA_X_NEG} raioX={{ corte: new THREE.Vector4(0, 1, 0, -y), papo: { parede: 0.1, leite: 0, soltar: 0, lado: -1 } }} /></>;
    },
  },
  {
    nome: "papo cortado: parede 1×→20×, descama, pasta (3 s)", dur: 3, near: 0.2,
    cam: [{ t: 0, pos: [-45, TOPO_AR + 15.5, 54], look: [-45.5, TOPO_AR + 13, 26], fov: 30 }], luz: { foco: [-45, TOPO_AR + 12, 25], raio: 40 },
    el: (t, tl) => <><Mundo t={t} ninho={false} /><Pombo t={t} pose={POSE_PARADO} position={PAI_POS} rotation={OLHA_X_NEG} raioX={{ corte: new THREE.Vector4(0, 0, 0, 1), papo: { parede: seg01(tl, 0.1, 1.4), soltar: seg01(tl, 1.2, 2.6), leite: 0.65 * seg01(tl, 1.4, 2.9), lado: -1 } }} /></>,
  },
  {
    nome: "alimentando em raio-x: pasta SÓ dentro do papo (2 s)", dur: 2, near: 0.3,
    cam: [{ t: 0, pos: [-40, NINHO_Q_FUNDO + 14, 88], look: [-40, NINHO_Q_FUNDO + 8, 24], fov: 32 }], luz: { foco: [-40, NINHO_Q_FUNDO + 6, 24], raio: 35 },
    el: (t, tl) => <><Mundo t={t} /><Alimentando t={t} raio={{ parede: 1, leite: mix(0.7, 0.55, tl / 2), soltar: 1, fluxo: 0, lado: 1 }} /></>,
  },
  {
    nome: "♂ = ♀: os dois papos (prolactina) + ícone gota", near: 0.5,
    cam: [{ t: 0, pos: [0, 46, 100], look: [0, 9, -6], fov: 34 }], luz: { foco: [0, 10, -5], raio: 50 },
    el: (t) => (
      <>
        <Chao />
        <Pombo t={t} pose={POSE_PARADO} position={[0, 0, -22]} rotation={OLHA_X_NEG} raioX={{ corte: new THREE.Vector4(0, 0, 0, 1), papo: { parede: 1, leite: 0.6, soltar: 1, lado: -1 } }} />
        <Pombo femea t={t} pose={POSE_PARADO} position={[0, 0, 12]} rotation={OLHA_X_NEG} raioX={{ corte: new THREE.Vector4(0, 0, 0, 1), papo: { parede: 1, leite: 0.6, soltar: 1, lado: -1 } }} />
      </>
    ),
    ui: () => <IconeGota x={400} y={200} escala={1} />,
  },
  // ---------- 26–29 humanos ----------
  {
    nome: "janela: menino 4→18 anos ao lado do homem (3 s)", dur: 3, near: 1,
    cam: [{ t: 0, pos: [JANELA.x0 + 70, 230, 210], look: [JANELA.x0 + 70, 225, -80], fov: 36 }], luz: { foco: [JANELA.x0 + 60, 200, -40], raio: 160 },
    el: (t, tl) => (
      <>
        <Quarteirao />
        <HumanoAzul t={t} escala={HUMANO} position={[JANELA.x0 + 40, JANELA.y0 - 39, -90]} rotation={[0, 0.2, 0]} />
        <MeninoCrescendo t={t} idade={mix(4, 18, seg01(tl, 0.2, 2.6))} position={[JANELA.x0 + 95, JANELA.y0 - 39, -80]} rotation={[0, -0.2, 0]} />
      </>
    ),
  },
  { nome: "zelador roupa A varrendo/enxotando (2 s)", dur: 2, near: 1, cam: [{ t: 0, pos: [470, 140, 400], look: [300, 95, 80], fov: 38 }], luz: { foco: [280, 90, 100], raio: 160 }, el: (t, tl) => <><Mundo t={t} zelador={false} /><Zelador t={t} roupa="A" enxotar={seg01(tl, 0.8, 1.2)} position={[PORTA.x0 - 40, 0, 70]} rotation={[0, 0.9, 0]} /><Pombo t={t} pose={POSE_PARADO} position={[250, 0, 170]} rotation={[0, -2.2, 0]} /></> },
  { nome: "zelador roupa B parado, braços abertos", near: 1, cam: [{ t: 0, pos: [470, 140, 400], look: [300, 95, 80], fov: 38 }], luz: { foco: [280, 90, 100], raio: 160 }, el: (t) => <><Mundo t={t} zelador={false} /><Zelador t={t} roupa="B" varrer={0} bracosAbertos={1} position={[PORTA.x0 - 40, 0, 70]} rotation={[0, 0.9, 0]} /></> },
  { nome: "homem da pipoca (close)", near: 1, cam: [{ t: 0, pos: [440, 120, 720], look: [545, 75, 990], fov: 40 }], luz: { foco: [560, 60, 980], raio: 150 }, el: (t) => <Mundo t={t} /> },
  // ---------- 30–31 azulejo ----------
  { nome: "azulejo: caravela e gaiola", near: 1, cam: [{ t: 0, pos: [-240, 225, 230], look: [-240, 225, 0], fov: 40 }], luz: { foco: [-240, 225, 0], raio: 150 }, el: (t) => <Mundo t={t} /> },
  {
    nome: "pombo sai voando da gaiola pintada (2 s)", dur: 2, near: 1,
    cam: [{ t: 0, pos: [-160, 240, 260], look: [-200, 245, 30], fov: 40 }], luz: { foco: [-200, 240, 30], raio: 150 },
    el: (t, tl) => {
      const u = seg01(tl, 0.1, 1.9);
      const p: V3 = [mix(GAIOLA_AZULEJO[0], -60, u), mix(GAIOLA_AZULEJO[1], MARQ.y1 + 2, u) + Math.sin(Math.PI * u) * 25, mix(GAIOLA_AZULEJO[2] - 6, 110, u)];
      return <><Mundo t={t} /><Pombo t={t} pose={poseVoo(tl, 3, 40)} position={p} rotation={[0, 0.5, 0]} /></>;
    },
  },
  // ---------- 32–36 falcão (e carcará extra) ----------
  { nome: "falcão-peregrino na antena (close)", near: 0.5, cam: [{ t: 0, pos: [FALCAO_POS[0] + 30, FALCAO_POS[1] + 22, FALCAO_POS[2] + 55], look: [FALCAO_POS[0], FALCAO_POS[1] + 20, FALCAO_POS[2]], fov: 32 }], luz: { foco: FALCAO_POS, raio: 50 }, el: (t) => <Mundo t={t} olharFalcao={-30} /> },
  {
    nome: "falcão mergulha e desvia (2 s, sem contato)", dur: 2, near: 1,
    cam: [{ t: 0, pos: [690, 320, 170], look: [600, 300, 55], fov: 38, lin: true }, { t: 1.2, pos: [290, 300, 280], look: [200, 290, 150], fov: 38, lin: true }, { t: 2, pos: [40, 330, 400], look: [-100, 370, 300], fov: 38 }],
    luz: { foco: [250, 300, 150], raio: 400 },
    el: (t, tl) => {
      const u = seg01(tl, 0, 1.2), v = seg01(tl, 1.2, 2);
      const p: V3 = [mix(FALCAO_POS[0], 200, u) - v * 300, mix(FALCAO_POS[1] + 10, 290, u) + v * 80, mix(FALCAO_POS[2] + 20, 150, u) + v * 150];
      return <><Mundo t={t} falcao={false} /><Falcao t={t} pose={tl < 1.2 ? poseFalcaoMergulho() : poseFalcaoFreio(v)} position={p} rotation={[tl < 1.2 ? 0.35 : mix(0.35, -0.3, v), -1.75, 0]} /></>;
    },
  },
  {
    nome: "falcão voando (2 s)", dur: 2, near: 1,
    cam: [{ t: 0, pos: [-95, 455, 600], look: [-60, 420, 450], fov: 36, lin: true }, { t: 2, pos: [85, 455, 600], look: [120, 420, 450], fov: 36 }],
    luz: { foco: [0, 420, 450], raio: 200 },
    el: (t, tl) => <><Mundo t={t} falcao={false} /><Falcao t={t} pose={poseFalcaoVoo(tl)} position={[-60 + tl * 90, 420, 450]} rotation={[0, Math.PI / 2 + 0.3, 0]} /></>,
  },
  { nome: "falcão (atrás) × pombo, de perfil", near: 0.5, cam: [{ t: 0, pos: [0, 40, 130], look: [0, 14, -8], fov: 34 }], luz: { foco: [0, 15, -8], raio: 60 }, el: (t) => <><Chao /><Falcao t={t} pose={poseFalcao(0)} position={[0, 0, -30]} rotation={OLHA_X_NEG} /><Pombo t={t} pose={POSE_PARADO} position={[0, 0, 12]} rotation={OLHA_X_NEG} /></> },
  { nome: "carcará (extra, não está no roteiro)", near: 0.5, cam: [{ t: 0, pos: [0, 36, 140], look: [0, 26, 0], fov: 34 }], luz: { foco: [0, 20, 0], raio: 60 }, el: (t) => <><Chao /><Carcara t={t} pose={POSE_CARCARA} position={[0, 0, 0]} rotation={[0, 0.5, 0]} /></> },
  // ---------- 37–40 conferências ----------
  {
    nome: "giro de câmera (1 s): nada some nem fica preto", near: 0.5,
    cam: Array.from({ length: 11 }, (_, i) => ({ t: i * 0.1, pos: giro(i * 0.1, [0, 0, 0], 70, 26), look: [0, 11, 0] as V3, fov: 30, lin: true })),
    luz: { foco: [0, 10, 0], raio: 50 },
    el: (t) => <><Chao /><Pombo t={t} pose={POSE_PARADO} position={[0, 0, 0]} rotation={OLHA_RUA} /></>,
  },
  { nome: "pés close", near: 0.1, cam: [{ t: 0, pos: [-8, 3.5, 13], look: [0, 1.2, 1], fov: 30 }], luz: { foco: [0, 2, 0], raio: 20 }, el: (t) => <><Chao /><Pombo t={t} pose={POSE_PARADO} position={[0, 0, 0]} rotation={OLHA_RUA} /></> },
  { nome: "asa aberta vista de cima (câmera girada 90°)", near: 0.5, cam: [{ t: 0, pos: [0, 125, -3], look: [0, 12, -3.2], fov: 40 }], roll: Math.PI / 2, luz: { foco: [0, 12, 0], raio: 50 }, el: (t) => <><Chao /><Pombo t={t} pose={{ ...POSE_PARADO, asa: 1, bater: 0.25, amp: 6, recolher: 0, leque: 0.6 }} position={[0, 0, 0]} rotation={OLHA_RUA} /></> },
  { nome: "voo: meio da batida, 3/4 de cima (câmera girada 90°)", near: 0.5, cam: [{ t: 0, pos: [22, 95, 45], look: [0, 24, -3], fov: 40 }], roll: Math.PI / 2, luz: { foco: [0, 20, 0], raio: 60 }, el: (t) => <><Chao /><Pombo t={t} pose={{ ...poseVoo(0, 3), bater: 0.5 }} position={[0, 24, 0]} rotation={OLHA_RUA} /></> },
  { nome: "falcão: asa aberta, meio da batida (câmera girada 90°)", near: 0.5, cam: [{ t: 0, pos: [25, 150, 55], look: [0, 30, -5], fov: 40 }], roll: Math.PI / 2, luz: { foco: [0, 30, 0], raio: 80 }, el: (t) => <><Chao /><Falcao t={t} pose={{ ...poseFalcaoVoo(0), bater: 0.5 }} position={[0, 30, 0]} rotation={OLHA_RUA} /></> },
  // ---------- 43–46 verificação do papo cheio com pescoço dobrado (pose dos planos 0, 20 e 21), 1 s cada ----------
  { nome: "verif. papo: perfil (da rua)", near: 0.3, cam: [{ t: 0, pos: [-33, TOPO_AR + 13, 100], look: [-33, TOPO_AR + 10, 24], fov: 32 }], luz: { foco: [-38, TOPO_AR + 8, 24], raio: 40 }, el: (t) => <><Mundo t={t} janela={false} /><Alimentando t={t} /></> },
  { nome: "verif. papo: de cima, 3/4 de trás", near: 0.3, cam: [{ t: 0, pos: [22, TOPO_AR + 45, 75], look: [-35, TOPO_AR + 8, 24], fov: 32 }], luz: { foco: [-38, TOPO_AR + 8, 24], raio: 40 }, el: (t) => <><Mundo t={t} janela={false} /><Alimentando t={t} /></> },
  { nome: "verif. papo: de baixo, 3/4 de frente", near: 0.3, cam: [{ t: 0, pos: [-88, TOPO_AR + 6, 62], look: [-32, TOPO_AR + 11, 24], fov: 32 }], luz: { foco: [-38, TOPO_AR + 8, 24], raio: 40 }, el: (t) => <><Mundo t={t} janela={false} /><Alimentando t={t} /></> },
  { nome: "verif. papo: close do peito, de frente", near: 0.2, cam: [{ t: 0, pos: [-78, TOPO_AR + 18, 52], look: [-35, TOPO_AR + 11, 25], fov: 32 }], luz: { foco: [-35, TOPO_AR + 8, 24], raio: 35 }, el: (t) => <><Mundo t={t} janela={false} /><Alimentando t={t} /></> },
  { nome: "controle do teste magenta: câmera dentro do corpo", near: 0.05, cam: [{ t: 0, pos: [0, 8.5, -1], look: [0, 12, 8], fov: 70 }], luz: { foco: [0, 10, 0], raio: 40 }, el: (t) => <><Chao /><Pombo t={t} pose={{ ...POSE_PARADO, papo: 1 }} position={[0, 0, 0]} rotation={OLHA_RUA} /></> },
];
void tamanhoFilhote;
export const SETUPS = LAB;
export const LAB_INI = LAB.reduce<number[]>((a, s) => (a.push(a[a.length - 1] + (s.dur ?? 1)), a), [0]);
export const LAB_DUR = LAB_INI[LAB_INI.length - 1];
export const PomboLab: React.FC = () => {
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
      <PalcoDia>
        <PomboCam t={t} keys={keys} near={s.near ?? 0.5} far={12000} roll={s.roll ?? 0} />
        <LuzDia foco={s.luz?.foco ?? [-10, 12, 0]} raio={s.luz?.raio ?? 45} />
        {s.el(t, tl)}
      </PalcoDia>
      {s.ui ? s.ui(tl) : null}
      <div style={{ position: "absolute", left: 30, top: 30, right: 30, color: "#fff", font: "bold 38px sans-serif", textShadow: "0 0 6px #000" }}>
        {i} · {s.nome} · t={t0.toFixed(0)}s
      </div>
    </AbsoluteFill>
  );
};
