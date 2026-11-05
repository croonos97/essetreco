import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import * as THREE from "three";
import { CameraRig, Key } from "../engine/Camera";
import { Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import timelineJson from "../../public/animal_macaco/timeline.json";
import { ApelidoAmarelo, HumanoTranslucido, Legenda1Palavra, NumeroTopo, Ondinhas, useKitFont } from "../three/animais";
import { Macaco as Mac, Mao, pegaDupla } from "../three/animais/Macaco";
import { BalaoAviso, Balanca, balancaPrato, Bigorna, BIGORNA_TOPO, Cobra, Coquinho, Coracoes, corpoRastejando, Espirro, Graveto, GRAVETO_L, Lasca, Pedra, PEDRA_R, pedraContato, pedraContatoY, pedraExtY } from "../three/animais/MacacoObjetos";
import { Arqueologo, CorteEstrato, Escavacao, LAJE_TOPO, SerraCapivara, VITRINE_M_TOPO, VitrineMuseu } from "../three/animais/MacacoCenarios";
import { Rotulos } from "../three/animais/uiMacaco";

// =====================================================================
// "Você é um macaco" v2 (macaco-prego da Serra da Capivara, PI) — formato @vocessaoanimais com o KIT ANIMAIS.
// Tudo acontece num mundo só (a Serra), com o macaco no quadro em quase todos os segundos. Cada plano é cravado
// numa palavra da narração (wordAt) — nunca tempo fixo. Último quadro = primeiro (o plano final roda a abertura
// com u = t − FIM). Sensibilidade: humano translúcido só como régua de força (pode ficar vermelho em fade, como a
// cadela); nenhuma comparação de aparência; "humano/gente" escrito nunca junto do corpo do macaco, exceto a placa
// da virada (aprovada); nada de sangue na cobra comida.
// =====================================================================
const TL = timelineJson as Timeline;
const FPS = 30;
// a fala começa aos 0,5 s (o 1º quadro fica parado meio segundo); termina 0,4 s depois da última palavra
const OFF = 0.5;
export const macacoDuration = (fps: number) => Math.ceil((TL.duration + OFF + 0.4) * fps);
const FIM = (macacoDuration(FPS) - 1) / FPS;
const w = (c: string, word: string, n = 0) => wordAt(TL, c, word, n) + OFF;
const S = (c: string) => cena(TL, c).start + OFF;
const PI = Math.PI;

type V3 = [number, number, number];
type Look = { sun?: V3; sunPower?: number; ambient?: number; shadowSize?: number; exposure?: number };
type Plan = { from: number; to: number; keys: Key[]; scene: (t: number) => React.ReactNode; look?: Look; drift?: number };
const P = (from: number, to: number, p: Omit<Plan, "from" | "to">): Plan => ({ from, to, ...p });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function mix(a: number, b: number, k: number) {
  return a + (b - a) * k;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// câmera parada (duas keys iguais): usada onde há texto em textura (a placa não pode "ferver")
const fixa = (a: number, b: number, pos: V3, look: V3, fov: number): Key[] => [
  { t: a, pos, look, fov },
  { t: b, pos, look, fov },
];
const dolly = (a: number, b: number, p0: V3, p1: V3, look: V3, fov0: number, fov1 = fov0): Key[] => [
  { t: a, pos: p0, look, fov: fov0 },
  { t: b, pos: p1, look, fov: fov1 },
];

const DIA: Look = { sun: [4, 9, 6], sunPower: 2.7, ambient: 1.0, shadowSize: 5 };
const TARDE: Look = { sun: [-6, 4, 5], sunPower: 2.2, ambient: 0.85, shadowSize: 5, exposure: 1.1 };
const MUSEU: Look = { sun: [2, 8, 4], sunPower: 0.6, ambient: 0.7, shadowSize: 4 };

// ---------- lugares (Serra) ----------
const M0: V3 = [0, LAJE_TOPO, 0]; // macaco na laje, de frente para +z
const BIG: V3 = [0, 0, 0.42]; // bigorna no espaço do macaco
const NOZ: V3 = [0.02, BIGORNA_TOPO, 0.4]; // coquinho em cima da bigorna (espaço do macaco)
const ESC: V3 = [2.75, 0, -0.5]; // cova fora da laje (o terreno ganha um buraco ali)
const HUM: V3 = [2.25, 0, -0.6]; // humano translúcido (fora da laje, no chão)
const serra = (t: number, luz: "dia" | "tarde" = "dia", livre: { x: number; z: number; r: number }[] = []) => <SerraCapivara t={t} luz={luz} livre={[{ x: 0, z: 0, r: 2.4 }, { x: HUM[0] - 0.4, z: HUM[2], r: 1.8 }, ...livre]} />;
// planos abertos do humano: nada de arbusto entre a câmera e os dois
const LIVRE_HUM = [{ x: 0.9, z: 4.5, r: 3.6 }];

// ---------- martelada ----------
// a pedra sobe devagar, desce rápido e fica parada no ponto de impacto. base = altura do centro no impacto;
// quique = repique (un) depois do golpe. Devolve centro da pedra (espaço do macaco).
const BATE_Y = BIGORNA_TOPO + PEDRA_R * 0.8;
const martelo = (t: number, t0: number, periodo = 1.2, alto = 0.62, base = BATE_Y, quique = 0): { c: V3; impacto: number; fase: number } => {
  const f = (((t - t0) / periodo) % 1 + 1) % 1;
  const up = f < 0.62 ? 1 - Math.pow(1 - f / 0.62, 2) : f < 0.74 ? 1 - Math.pow((f - 0.62) / 0.12, 2) : 0;
  // fica em contato ~3 quadros e só então repica um pouco
  const rep = f >= 0.775 && f < 0.86 ? Math.sin((PI * (f - 0.775)) / 0.085) * quique : 0;
  const impacto = f >= 0.74 && f < 0.86 ? 1 - (f - 0.74) / 0.12 : 0;
  return { c: [NOZ[0], base + up * alto + rep, NOZ[2] - 0.02 - up * 0.12], impacto, fase: f };
};
// t0 que faz o 1º impacto cair em `ti`
const t0Para = (ti: number, periodo = 1.2) => ti - 0.74 * periodo;

// pedra em pedra: a pedra de baixo (alvo) fica apoiada na bigorna no ponto do golpe; o martelo para NA SUPERFÍCIE dela
const MARTELO_ROT: V3 = [0.2, 0.4, 0];
const ALVO_SEED = 7, ALVO_S = 0.8;
// giro da pedra de baixo escolhido para a maior área de apoio sob o martelo (o contato fica no meio, à vista)
const ALVO_ROT: V3 = (() => {
  let best: V3 = [0, 0, 0], bp = -1;
  for (let i = 0; i < 16; i++)
    for (const rx of [0, 0.5, 1.0, 1.6]) {
      const r: V3 = [rx, (i / 16) * PI * 2, 0];
      const c = pedraContato({ seed: 3, scale: 1, rot: MARTELO_ROT, dx: 0, dz: 0 }, { seed: ALVO_SEED, scale: ALVO_S, rot: r });
      if (c.perto > bp) (bp = c.perto), (best = r);
    }
  return best;
})();
const ALVO_C: V3 = [NOZ[0], BIGORNA_TOPO - pedraExtY(ALVO_SEED, ALVO_S, ALVO_ROT)[0] - 0.004, NOZ[2] - 0.02];
const ALVO_TOPO = ALVO_C[1] + pedraExtY(ALVO_SEED, ALVO_S, ALVO_ROT)[1];
// contato malha-malha (não por caixa): sem folga visível em nenhum ângulo de câmera
const BATE_PEDRA = ALVO_C[1] + pedraContatoY({ seed: 3, scale: 1, rot: MARTELO_ROT, dx: 0, dz: 0 }, { seed: ALVO_SEED, scale: ALVO_S, rot: ALVO_ROT }) + 0.001;
// martelo sobre o COCO: a pedra para no topo do coquinho inteiro (sem afundar nele); depois de rachado desce até a bigorna
const COCO_H = 0.056;
const BATE_COCO = BIGORNA_TOPO + COCO_H - pedraExtY(3, 1, MARTELO_ROT)[0];
const BATE_ABERTO = BIGORNA_TOPO + 0.014 - pedraExtY(3, 1, MARTELO_ROT)[0];

// macaco batendo com a pedra (sentado, inclinado sobre a bigorna).
// racha = instante do golpe que racha o coco (abre em 4 quadros a partir daí); sem `racha` o coco fica como `rachar`
// tira 0..1: depois do golpe, ergue a pedra para o lado e deixa o coco aberto à vista
const Batendo: React.FC<{ t: number; t0: number; periodo?: number; alto?: number; racha?: number; rachar?: number; olhar?: [number, number]; extra?: React.ReactNode; pedraEmPedra?: boolean; semCoco?: boolean; tira?: number }> = ({ t, t0, periodo = 1.2, alto = 0.62, racha, rachar = 0, olhar, extra, pedraEmPedra = false, semCoco = false, tira = 0 }) => {
  const q = racha !== undefined ? prog(t, racha, racha + 0.13, (x) => x) : rachar;
  // a pedra afunda junto com o coco que racha (nada de salto de altura entre um golpe e outro)
  const base = pedraEmPedra ? BATE_PEDRA : mix(BATE_COCO, BATE_ABERTO, q);
  const m0 = martelo(t, t0, periodo, alto, base, pedraEmPedra ? 0.014 : 0.01);
  const m = tira > 0 ? { ...m0, c: mixV(racha !== undefined ? martelo(racha, t0, periodo, alto, base).c : m0.c, [-0.14, 0.34, 0.3], tira) } : m0;
  return (
    <Mac t={t} {...pegaDupla(m.c, PEDRA_R * 0.95, 0.85)} inclinar={0.18 + (1 - m.c[1] / 0.9) * 0.1} cabeca={[olhar?.[0] ?? 0, olhar?.[1] ?? 0.35]} boca={m.impacto * 0.3} position={M0}>
      <Bigorna position={BIG} />
      <Pedra position={m.c} rotation={MARTELO_ROT} />
      {pedraEmPedra ? <Pedra seed={ALVO_SEED} position={ALVO_C} rotation={ALVO_ROT} scale={ALVO_S} /> : semCoco ? null : <Coquinho quebrar={q} position={NOZ} />}
      {extra}
    </Mac>
  );
};

// ---------- abertura (= final) em função de u ----------
// macaco INTEIRO (pernas e rabo à vista, bigorna ao lado e não na frente), céu grande; câmera baixa de 3/4
const ABRE_KEYS = (t0: number): Key[] => [
  { t: t0, pos: [1.7, 0.18, 0.42], look: [0.0, 0.6, 0.02], fov: 40 },
  { t: t0 + 1.88, pos: [1.6, 0.18, 0.4], look: [0.0, 0.6, 0.02], fov: 40 },
];
// bigorna AO LADO do macaco (à esquerda dele), para as pernas e o rabo ficarem à vista; ele de frente para a câmera
const AB_BIG: V3 = [0.36, 0, 0.16];
const Abertura: React.FC<{ u: number }> = ({ u }) => {
  const pis = Math.max(0, 1 - Math.abs(u - 0.8) / 0.09);
  const pedra: V3 = [AB_BIG[0] - 0.04, BIGORNA_TOPO - pedraExtY(3, 1, [0, 0, 0])[0], AB_BIG[2] + 0.02];
  return (
    <>
      {serra(u)}
      <Mac t={u} maoE={{ alvo: [pedra[0] - 0.02, pedra[1] + PEDRA_R * 0.85, pedra[2]], palma: [-0.1, -1, 0.15], fechar: 0.55 }} cabeca={[-0.15 + Math.sin(u * 1.4) * 0.12, 0.02]} piscar={pis} rabo={0.35 + 0.15 * Math.sin(u * 1.1)} position={M0} rotation={[0, 1.45, 0]}>
        <Bigorna position={AB_BIG} rotation={[0, 0.5, 0]} scale={0.8} />
        <Pedra position={[pedra[0], pedra[1] - (BIGORNA_TOPO - BIGORNA_TOPO * 0.8), pedra[2]]} />
        <Coquinho position={[AB_BIG[0] + 0.1, BIGORNA_TOPO * 0.8, AB_BIG[2] + 0.1]} />
      </Mac>
    </>
  );
};

// ---------- humano translúcido com a MESMA pedra em escala humana, batendo num coco gigante sobre uma bigorna ----------
// a bigorna humana fica sobre um bloco de pedra na altura da cintura; o golpe leva os braços de cima da cabeça até o coco.
const H_L = 1.22; // ombro → mão (braço quase esticado)
const H_OMBRO = 2.78;
const H_GOLPE = -1.22; // ângulo do braço no impacto
const maoHum = (a: number): V3 => [0, H_OMBRO - H_L * Math.cos(a), -H_L * Math.sin(a)];
const H_IMP = maoHum(H_GOLPE);
const H_PEDRA_DY = -0.12; // centro da pedra um pouco abaixo das mãos
const H_COCO_S = 3.2;
const H_BIG_S = 1.6;
const H_BLOCO_TOPO = H_IMP[1] + H_PEDRA_DY + pedraExtY(3, Math.cbrt(23), [0, 0, 0])[0] - COCO_H * H_COCO_S - BIGORNA_TOPO * H_BIG_S;
const BLOCO_MAT = new THREE.MeshStandardMaterial({ color: "#A6603A", roughness: 0.95, flatShading: true });
const impactoHum = (t0: number, periodo: number) => t0 + 0.72 * periodo;
const HumanoPedra: React.FC<{ t: number; t0: number; periodo?: number; peso: number; vermelho: number; ceder: number; opac?: number; parado?: boolean }> = ({ t, t0, periodo = 1.5, peso, vermelho, ceder, opac = 1, parado = false }) => {
  const s = Math.cbrt(peso);
  const f = parado ? 0 : ((((t - t0) / periodo) % 1) + 1) % 1;
  // sobe devagar (0..0,6), desce rápido (0,6..0,72), fica no coco (0,72..1)
  const k = f < 0.6 ? Math.pow(f / 0.6, 0.7) : f < 0.72 ? 1 - Math.pow((f - 0.6) / 0.12, 2) : 0;
  const a = parado ? -3.0 + ceder * 0.5 : mix(H_GOLPE, -3.0, k);
  const mao = maoHum(a);
  const tremor = Math.sin(t * 22) * 0.012 * (vermelho + ceder);
  const pedraC: V3 = [mao[0] + tremor, mao[1] + H_PEDRA_DY - ceder * 0.25, mao[2]];
  const erguer = clamp01((a - -0.15) / (-3.0 - -0.15));
  const tImp = impactoHum(t0, periodo);
  return (
    <group position={HUM} rotation={[0, -PI / 2 + 0.25, 0]}>
      <HumanoTranslucido t={t} erguer={erguer} ceder={ceder} tremer={vermelho} vermelho={vermelho} olhar={[0, 0.35]} opacidade={opac} />
      {opac > 0.02 ? (
        <>
          <Pedra position={pedraC} scale={s} />
          {/* rocha natural (não caixa) na altura da cintura, como apoio da bigorna humana */}
          <mesh material={BLOCO_MAT} position={[0, H_BLOCO_TOPO * 0.5, H_IMP[2]]} rotation={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.62, H_BLOCO_TOPO, 7, 3]} />
          </mesh>
          <Bigorna position={[0, H_BLOCO_TOPO, H_IMP[2]]} scale={H_BIG_S} cascas={0} />
          <Coquinho quebrar={parado ? 0 : clamp01((t - tImp) / 0.15)} position={[0, H_BLOCO_TOPO + BIGORNA_TOPO * H_BIG_S, H_IMP[2]]} scale={H_COCO_S} />
        </>
      ) : null}
    </group>
  );
};

// ---------- paquera ----------
const MACHO: V3 = [1.05, LAJE_TOPO, -0.35];
// macho sentado de costas para ela, distraído; `acordar` vira a cabeça para ela (dá bola)
// virar 0..1: o corpo todo gira até ficar de frente para ela (dá bola de verdade, legível de longe)
const Macho: React.FC<{ t: number; acordar?: number; virar?: number }> = ({ t, acordar = 0, virar = 0 }) => (
  <Mac t={t} cabeca={[mix(mix(-0.2, 1.05, acordar), 0, virar), mix(0.35, 0.0, acordar)]} piscar={acordar < 0.5 ? 0.5 : 0} sobrancelha={acordar * 0.5} sorriso={acordar > 0.8 ? 0.8 : 0} maoD={{ alvo: [0.05, 0.28 + Math.sin(t * 6) * 0.02 * (1 - acordar), 0.18], palma: [1, -0.3, 0], fechar: 0.5 }} position={MACHO} rotation={[0, mix(2.7, 2 * PI - 1.11, virar), 0]} />
);
const FEM: V3 = [-0.35, LAJE_TOPO, 0.35];
const FEM_ROT = 0.95; // virada para o macho
const FEM_S = 0.86; // fêmeas menores, topete baixo (`femea`)
// pedrinha: sai da mão (a) e quica perto do macho (b). k 0..1
const vooDe = (a: V3, b: V3, k: number, alto = 0.45): V3 => {
  const kk = Math.min(1, k / 0.75);
  const p = mixV(a, b, kk);
  p[1] += Math.sin(kk * PI) * alto;
  if (k > 0.75) {
    const q = (k - 0.75) / 0.25;
    p[0] += q * 0.08;
    p[1] += Math.sin(q * PI) * 0.06;
  }
  return p;
};
// mão que arremessa (espaço da fêmea): do quadril até o alto-frente
const maoArremesso = (arremesso: number): V3 => mixV([0.0, 0.4, 0.22], [0.04, 0.6, 0.34], arremesso);
// posição no mundo de um ponto local da fêmea (escala FEM_S, girada `rot`)
const maoMundo = (base: V3, rot: number, local: V3, s = FEM_S): V3 => [base[0] + s * (local[0] * Math.cos(rot) + local[2] * Math.sin(rot)), base[1] + s * local[1], base[2] + s * (-local[0] * Math.sin(rot) + local[2] * Math.cos(rot))];
const ALVO_MACHO: V3 = [MACHO[0] - 0.2, LAJE_TOPO + 0.04, MACHO[2] + 0.16];
const Femea: React.FC<{ t: number; mao?: Mao; cabeca?: [number, number]; sobrancelha?: number; convencido?: number; sorriso?: number; extra?: React.ReactNode; position?: V3; rot?: number }> = ({ t, mao, cabeca, sobrancelha, convencido, sorriso, extra, position = FEM, rot = FEM_ROT }) => (
  <Mac t={t} femea maoD={mao} cabeca={cabeca ?? [0.1, 0.1]} sobrancelha={sobrancelha} convencido={convencido} sorriso={sorriso} position={position} rotation={[0, rot, 0]} scale={FEM_S}>
    {extra}
  </Mac>
);
const PEDRINHA_MAT = new THREE.MeshStandardMaterial({ color: "#D9C8B0", roughness: 0.6, flatShading: true });
const PEDRINHA_FANT = new THREE.MeshBasicMaterial({ color: "#FFF6E0", transparent: true, opacity: 0.45, depthWrite: false });
const Pedrinha: React.FC<{ p: V3; s?: number; fantasma?: boolean }> = ({ p, s = 1, fantasma = false }) => (
  <mesh material={fantasma ? PEDRINHA_FANT : PEDRINHA_MAT} position={p} scale={0.028 * s} castShadow={!fantasma}>
    <dodecahedronGeometry args={[1, 0]} />
  </mesh>
);
// uma fêmea que arremessa em t0: a mão sobe com a pedrinha, solta (com rastro) e ela quica perto do macho e fica lá
const Arremesso: React.FC<{ t: number; t0: number; base: V3; rot: number; alvo: V3; dur?: number }> = ({ t, t0, base, rot, alvo, dur = 1.0 }) => {
  const arr = prog(t, t0 - 0.25, t0);
  const k = prog(t, t0, t0 + dur, (x) => x);
  const local = maoArremesso(arr);
  const naMao = maoMundo(base, rot, add(local, [0, 0.02, 0.03]));
  const solta = maoMundo(base, rot, add(maoArremesso(1), [0, 0.02, 0.03]));
  return (
    <>
      <Femea t={t} position={base} rot={rot} mao={{ alvo: local, palma: [0, -0.5, 1], fechar: k > 0 ? 0.3 : 0.9 }} cabeca={[0.05, 0.05]} sobrancelha={0.3} sorriso={0.6} />
      {k <= 0 ? <Pedrinha p={naMao} s={1.6} /> : null}
      {k > 0 && k < 1 ? [0.12, 0.09, 0.06, 0.03, 0].map((d, i) => (k - d > 0 ? <Pedrinha key={i} p={vooDe(solta, alvo, k - d)} s={i === 4 ? 1.6 : 1.6 * (0.35 + i * 0.12)} fantasma={i < 4} /> : null)) : null}
      {k >= 1 ? <Pedrinha p={vooDe(solta, alvo, 1)} s={1.6} /> : null}
    </>
  );
};
const pedrinhaPousada = (base: V3, rot: number, alvo: V3) => vooDe(maoMundo(base, rot, add(maoArremesso(1), [0, 0.02, 0.03])), alvo, 1);
// de lado e de frente para os dois: ela à esquerda, ele à direita, a pedrinha cruzando o quadro
const PEDRADA_KEYS = (a: number, b: number): Key[] => dolly(a, b, [0.05, 0.85, 2.35], [0.08, 0.83, 2.2], [0.35, 0.32, 0.0], 42, 41);
// pedrada a dois (paquera e recap): a pedrinha sai da mão dela, quica a um palmo dele; ele se assusta e depois DÁ BOLA
const pedrada = (t: number, t0: number, dur = 1.0) => {
  const quique = t0 + dur * 0.75;
  const susto = Math.max(0, 1 - Math.abs(t - quique - 0.08) / 0.12);
  const bola = prog(t, quique + 0.25, quique + 0.65);
  return (
    <>
      {serra(t)}
      <Macho t={t} acordar={Math.max(0.3 * susto, bola)} virar={bola} />
      <Arremesso t={t} t0={t0} base={FEM} rot={FEM_ROT} alvo={ALVO_MACHO} dur={dur} />
    </>
  );
};
// fêmeas do bando (virou moda): a primeira e outras cinco em volta, todas viradas para o macho
const FEMEAS: { p: V3; rot: number }[] = [
  { p: FEM, rot: FEM_ROT },
  { p: [-0.75, LAJE_TOPO, -0.25], rot: 1.35 },
  { p: [-0.2, LAJE_TOPO, 0.85], rot: 0.55 },
  { p: [-1.05, LAJE_TOPO, 0.45], rot: 1.05 },
  { p: [0.35, LAJE_TOPO, 0.95], rot: 0.2 },
  { p: [-0.6, LAJE_TOPO, -0.85], rot: 1.75 },
];
const alvoN = (i: number): V3 => [ALVO_MACHO[0] + Math.sin(i * 2.3) * 0.12, ALVO_MACHO[1], ALVO_MACHO[2] + Math.cos(i * 1.7) * 0.14];

// ---------- graveto: tronco opaco com furo de verdade (borda + fundo) e larva lá dentro (o MESMO em todos os planos) ----------
const TRONCO: V3 = [0.15, 0, 0.55];
const FURO_N: V3 = (() => {
  const l = Math.hypot(0.5, 0.87);
  return [0.5 / l, 0, -0.87 / l];
})();
const BURACO: V3 = [0.15 + FURO_N[0] * 0.2, 0.3, 0.55 + FURO_N[2] * 0.2]; // um pouco para dentro da boca do furo
const TRONCO_MAT = new THREE.MeshStandardMaterial({ color: "#A07A58", roughness: 0.95, flatShading: true });
const CASCA_MAT = new THREE.MeshStandardMaterial({ color: "#7A5A40", roughness: 1, flatShading: true });
const FURO_MAT = new THREE.MeshStandardMaterial({ color: "#4A3220", roughness: 1, side: THREE.BackSide });
const FUNDO_MAT = new THREE.MeshStandardMaterial({ color: "#1A120B", roughness: 1 });
const BORDA_MAT = new THREE.MeshStandardMaterial({ color: "#C9A27A", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
// larva clara (cor de bicho-de-goiaba) para destacar no escuro do furo; cabeça laranja; se contorce
const LARVA_MAT = new THREE.MeshStandardMaterial({ color: "#F2E3BE", roughness: 0.45, emissive: new THREE.Color("#3A2A10"), emissiveIntensity: 0.4 });
const LARVA_CAB = new THREE.MeshStandardMaterial({ color: "#C8742A", roughness: 0.4 });
const LarvaClara: React.FC<{ t: number; position?: V3; rotation?: V3; scale?: number }> = ({ t, position, rotation, scale = 1 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    {Array.from({ length: 8 }).map((_, i) => {
      const r = i === 0 ? 0.0075 : 0.0095 - Math.abs(i - 3) * 0.0007;
      return (
        <mesh key={i} material={i === 0 ? LARVA_CAB : LARVA_MAT} position={[Math.sin(t * 3.2 - i * 0.7) * 0.0035 * i, Math.cos(t * 2.1 - i * 0.6) * 0.0015 * i, -i * 0.0115]} scale={[r, r * 0.85, r * 0.95]}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      );
    })}
  </group>
);
const Tronco: React.FC<{ t: number; larva?: number }> = ({ t, larva = 0 }) => {
  const ry = Math.atan2(FURO_N[0], FURO_N[2]);
  return (
    <group position={TRONCO}>
      <mesh material={TRONCO_MAT} position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.3, 1.0, 12]} />
      </mesh>
      {/* placas de casca (livres na frente do furo) */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * PI * 2 + 0.3;
        if (Math.abs(((a - ry + PI * 3) % (PI * 2)) - PI) < 0.5) return null;
        return (
          <mesh key={i} material={CASCA_MAT} position={[Math.sin(a) * 0.272, 0.2 + (i % 3) * 0.25, Math.cos(a) * 0.272]} rotation={[0, a, 0]} scale={[0.07, 0.22, 0.02]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        );
      })}
      {/* furo: tubo escuro para dentro do tronco + fundo + borda de madeira roída */}
      <group position={[FURO_N[0] * 0.285, 0.3, FURO_N[2] * 0.285]} rotation={[0, ry, 0]}>
        <mesh material={FURO_MAT} position={[0, 0, -0.09]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.18, 16, 1, true]} />
        </mesh>
        <mesh material={FUNDO_MAT} position={[0, 0, -0.178]}>
          <circleGeometry args={[0.062, 16]} />
        </mesh>
        <mesh material={BORDA_MAT} position={[0, 0, 0.004]}>
          <ringGeometry args={[0.07, 0.088, 20]} />
        </mesh>
        {larva > 0.01 ? (
          <LarvaClara t={t} position={[0.012, -0.03, -0.075 + 0.025 * larva * Math.sin(t * 2.2)]} rotation={[0.25, 0.3, 0]} scale={1.7} />
        ) : null}
      </group>
    </group>
  );
};
const MG: V3 = [0.15, LAJE_TOPO, -0.05]; // o macaco de frente para o buraco do tronco

// graveto entrando/saindo do buraco (fora: 1 = todo para fora, 0 = enfiado).
// lambe 0..1: a mão vai para a frente do peito e o graveto aponta de lá para a boca — a PONTA COM A LARVA chega à boca
// por fora (sem atravessar a bochecha)
function gravetoNoBuraco(t: number, fora: number, larva = false, lambe = 0, larvaNoFuro = 0) {
  const L = GRAVETO_L * 0.85;
  const dentro = (1 - fora) * L * 0.8;
  const n = new THREE.Vector3(...FURO_N);
  const ponta = new THREE.Vector3(...BURACO).addScaledVector(n, L - dentro);
  const maoLocal: V3 = [ponta.x - MG[0], ponta.y - MG[1], ponta.z - MG[2]];
  const boca = new THREE.Vector3(-0.02, 0.44, 0.33);
  const maoLambe = new THREE.Vector3(0.27, 0.3, 0.5);
  const pega = mixV(maoLocal, maoLambe.toArray() as V3, lambe);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
  const qBoca = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), boca.clone().sub(maoLambe).normalize());
  const qq = q.clone().slerp(qBoca, lambe);
  const gira = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 9) * 0.25 * (1 - fora));
  qq.multiply(gira);
  return (
    <>
      {serra(t)}
      <Tronco t={t} larva={larvaNoFuro} />
      <Mac t={t} maoE={{ alvo: pega, palma: [-1, 0.2, 0], fechar: 0.9 }} maoD={{ alvo: [-0.12, 0.25, 0.22], palma: [0.2, -1, 0.2], fechar: 0.5 }} cabeca={[mix(0.5, 0.25, lambe), mix(0.15, 0.1, lambe)]} giro={0.35 * (1 - lambe)} boca={lambe * (0.35 + 0.3 * Math.sin(t * 14))} position={MG}>
        <group position={pega} quaternion={qq}>
          <Graveto t={t} folhas={0} scale={0.85} />
          {larva ? (
            <LarvaClara t={t} position={[0, GRAVETO_L * 0.85 + 0.006, 0.008]} rotation={[-PI / 2, 0, 0]} scale={1.3} />
          ) : null}
        </group>
      </Mac>
    </>
  );
}

// ---------- faíscas e poeira no choque pedra-pedra ----------
const FAISCA = new THREE.MeshBasicMaterial({ color: "#FFE58A" });
const Faiscas: React.FC<{ k: number; position: V3 }> = ({ k, position }) =>
  k > 0.01 ? (
    <group position={position}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * PI * 2 + Math.sin(i * 3.1) * 0.3;
        const r = (0.05 + 0.25 * k) * (0.7 + 0.5 * Math.abs(Math.sin(i * 7.7)));
        return (
          <mesh key={i} material={FAISCA} position={[Math.cos(a) * r, Math.abs(Math.sin(a)) * r * 0.8 + 0.02, Math.sin(a * 1.3) * r * 0.5]} scale={0.007 * (1 - k * 0.6)}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
        );
      })}
    </group>
  ) : null;
const PO_MAT = new THREE.MeshStandardMaterial({ color: "#D8C7AE", roughness: 1, transparent: true, depthWrite: false });
const Poeira: React.FC<{ t: number; ti: number }> = ({ t, ti }) => {
  const k = (t - ti) / 0.35;
  if (k < 0 || k > 1) return null;
  PO_MAT.opacity = 0.5 * (1 - k);
  return (
    <group position={[ALVO_C[0], ALVO_TOPO, ALVO_C[2] + 0.04]}>
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * PI * 2;
        const r = 0.05 + 0.09 * k;
        return (
          <mesh key={i} material={PO_MAT} position={[Math.cos(a) * r, 0.03 * k, Math.sin(a) * r * 0.6]} scale={0.01 + 0.016 * k}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        );
      })}
    </group>
  );
};
// ---------- lascas que SALTAM no impacto (espaço do macaco): não existem antes de ti; voo balístico, pousam deitadas ----------
const LASCA_VOO = [
  { a: 0.3, v: 0.75, vy: 1.05, s: 1.15, seed: 1, giro: [7, 3] },
  { a: 2.6, v: 0.6, vy: 1.25, s: 1.0, seed: 3, giro: [-6, 5] },
  { a: 4.4, v: 0.5, vy: 0.9, s: 0.9, seed: 4, giro: [5, -4] },
];
const lascaVoo = (L: (typeof LASCA_VOO)[number], dt: number, g = 7.5) => {
  const o: V3 = [ALVO_C[0], ALVO_TOPO - 0.015, ALVO_C[2]];
  const vx = Math.cos(L.a) * L.v, vz = Math.sin(L.a) * L.v * 0.7;
  const voo = (chao: number) => (L.vy + Math.sqrt(L.vy * L.vy + 2 * g * (o[1] - chao))) / g;
  let T = voo(BIGORNA_TOPO + 0.008);
  const xT = o[0] + vx * T, zT = o[2] + vz * T;
  if (!(Math.abs(xT - BIG[0]) < 0.3 && Math.abs(zT - BIG[2]) < 0.2)) T = voo(0.008);
  const tau = Math.min(Math.max(0, dt), T);
  const p: V3 = [o[0] + vx * tau, o[1] + L.vy * tau - 0.5 * g * tau * tau, o[2] + vz * tau];
  const r = T - tau;
  return { p, rot: [PI / 2 + L.giro[0] * r, L.a + L.giro[1] * r, 0] as V3 };
};
const LascasVoo: React.FC<{ t: number; ti: number }> = ({ t, ti }) =>
  t < ti ? null : (
    <>
      {LASCA_VOO.map((L, i) => {
        const v = lascaVoo(L, t - ti);
        return <Lasca key={i} seed={L.seed} position={v.p} rotation={v.rot} scale={L.s} brilho={0.15} />;
      })}
    </>
  );

// ---------- bando na Serra (sentados na laje) ----------
type Membro = { p: V3; rot: number; fem?: boolean };
const BANDO_CERCO: Membro[] = Array.from({ length: 6 }).map((_, i) => {
  const a = -PI / 2 + ((i + 0.5) / 6) * PI * 2 + 0.25;
  return { p: [Math.cos(a) * 0.95, LAJE_TOPO, Math.sin(a) * 0.8 + 0.1] as V3, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), fem: i % 2 === 1 };
});
const BANDO_FILA: Membro[] = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((x, i) => ({ p: [x, LAJE_TOPO, (i % 2) * 0.22 - 0.1] as V3, rot: Math.sin(i * 1.7) * 0.35, fem: i % 3 === 1 }));

// ---------- cobra ----------
// venenosa: coral entra pela esquerda, rastejando pela laje até o meio
const coralCaminho = (s: number): V3 => [-1.9 + s, 0, 0.12 + Math.sin(s * 1.3) * 0.12];
const CORAL_L = 0.85;
const coralCorpo = (t: number, frente: number, ergue = 0) => corpoRastejando(coralCaminho, frente, CORAL_L, t, 0.06, ergue, LAJE_TOPO + 0.016);
const coralFrente = (t: number) => mix(0.25, 1.95, prog(t, S("gaviao") - 0.2, w("gaviao", "venenosa"), (x) => 1 - Math.pow(1 - x, 2))) - 0.25 * prog(t, w("gaviao", "cerca"), w("gaviao", "grita") + 0.4);
// inofensiva (cobra-cipó verde) comida: sai da boca, passa pelas duas mãos e pende em curva (cabeça escondida)
const cipoNaMao = (t: number) => (u: number): V3 => {
  const boca: V3 = [-0.01, 0.43, 0.2];
  const m1: V3 = [-0.06, 0.33, 0.24], m2: V3 = [0.07, 0.3, 0.25];
  const s = u;
  if (s < 0.1) return mixV(boca, m1, s / 0.1);
  if (s < 0.25) return mixV(m1, m2, (s - 0.1) / 0.15);
  const k = (s - 0.25) / 0.75;
  const sway = Math.sin(t * 1.6 - k * 3) * 0.04 * k;
  return [m2[0] + 0.12 * k + sway, Math.max(0.012, m2[1] - k * 0.36), m2[2] + 0.1 * Math.sin(k * PI)];
};

// ---------- tempos-chave ----------
const RACHA_1 = S("marreta_num") + 0.34; // 1º golpe do vídeo racha o coco
const MIOLO_DX = 0.03; // metade da direita (+x) do coco aberto
const LASCA_G1 = w("lascas", "pedra", 1) + 0.05; // golpe do close (sem lascas)
const LASCA_G2 = w("lascas", "solta") + 0.02; // golpe que solta as lascas

// ---------- planos ----------
const PLANS: Plan[] = [
  // ======== GANCHO ========
  P(0, w("gancho", "pra"), { keys: ABRE_KEYS(0), look: DIA, drift: 0, scene: (t) => <Abertura u={t} /> }),
  // close das mãos pegando a pedra
  P(w("gancho", "pra"), w("gancho", "levanta"), {
    keys: dolly(w("gancho", "pra"), w("gancho", "levanta"), [0.42, 0.5, 1.05], [0.36, 0.46, 0.95], [0, 0.26, 0.32], 30, 28),
    look: DIA,
    scene: (t) => {
      const k = prog(t, w("gancho", "pra"), w("gancho", "coquinho") + 0.3);
      const c: V3 = [-0.02, BIGORNA_TOPO - pedraExtY(3, 1, [0, 0, 0])[0], 0.34];
      const d = pegaDupla([c[0], c[1] + 0.015, c[2]], PEDRA_R * 0.95, 0.35 + 0.5 * k);
      const rest: V3 = [-0.12, 0.26, 0.2], restE: V3 = [0.12, 0.26, 0.2];
      return (
        <>
          {serra(t)}
          <Mac t={t} maoD={{ ...d.maoD, alvo: mixV(rest, d.maoD.alvo, Math.min(1, k * 1.4)) }} maoE={{ ...d.maoE, alvo: mixV(restE, d.maoE.alvo, Math.min(1, k * 1.4)) }} inclinar={0.25} cabeca={[0, 0.45]} position={M0}>
            <Bigorna position={BIG} />
            <Pedra position={c} />
            <Coquinho position={[0.12, BIGORNA_TOPO, 0.47]} />
          </Mac>
        </>
      );
    },
  }),
  // contra-plongée: fica de pé e ergue a pedra contra o céu (sem pássaro nenhum, sem nuvem atrás da cabeça)
  P(w("gancho", "levanta"), S("marreta_num"), {
    keys: dolly(w("gancho", "levanta"), S("marreta_num"), [0.25, 0.2, 1.62], [0.22, 0.19, 1.48], [0, 0.8, 0.05], 46),
    look: DIA,
    scene: (t) => {
      const k = prog(t, w("gancho", "levanta"), w("gancho", "levanta") + 0.6);
      const ergue = prog(t, w("gancho", "levanta") + 0.2, w("gancho", "pedra") + 0.4);
      const c: V3 = mixV([-0.02, BIGORNA_TOPO - pedraExtY(3, 1, [0, 0, 0])[0], 0.34], [0, 1.02, 0.1], ergue);
      return (
        <>
          {serra(t)}
          <Mac t={t} sentar={1 - k} {...pegaDupla(c, PEDRA_R * 0.95, 0.85)} cabeca={[0, 0.05]} sobrancelha={0.3} rabo={0.6} position={M0}>
            <Bigorna position={BIG} />
            <Pedra position={c} />
            <Coquinho position={[0.12, BIGORNA_TOPO, 0.47]} />
          </Mac>
        </>
      );
    },
  }),
  // ======== MARRETA_NUM ========
  // lateral: o 1º golpe RACHA o coco em duas metades (4 quadros), o miolo fica à mostra
  P(S("marreta_num"), w("marreta_num", "do"), {
    keys: dolly(S("marreta_num"), w("marreta_num", "do"), [0.8, 0.5, 1.05], [0.74, 0.48, 1.0], [0.0, 0.3, 0.38], 36, 34),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Batendo t={t} t0={t0Para(RACHA_1)} racha={RACHA_1} tira={prog(t, RACHA_1 + 0.07, RACHA_1 + 0.27)} />
      </>
    ),
  }),
  // balança: o macaco num prato, 3 pedras iguais à dele no outro (cada pedra = 1/3 do peso dele)
  P(w("marreta_num", "do"), w("marreta_num", "um", 1), {
    keys: dolly(w("marreta_num", "do"), w("marreta_num", "um", 1), [0.0, 0.85, 4.1], [0.0, 0.85, 3.85], [0, 0.7, 0], 40),
    look: DIA,
    scene: (t) => {
      const u = t - w("marreta_num", "do");
      const inc = 0.12 * Math.exp(-u * 2.6) * Math.cos(u * 7.5); // assenta e fica nivelada
      const BS = 1.6;
      const pm = balancaPrato(-1, inc), pp = balancaPrato(1, inc);
      const yP = pp[1] * BS + 0.012 * BS;
      const e = pedraExtY(3, 1, [0, 0, 0]);
      const h = e[1] - e[0];
      const pedras: V3[] = [
        [pp[0] * BS - 0.09, yP - e[0], 0.02],
        [pp[0] * BS + 0.09, yP - e[0], -0.02],
        [pp[0] * BS, yP - e[0] + h * 0.82, 0.0],
      ];
      return (
        <>
          {serra(t)}
          <group position={[0, LAJE_TOPO, 0]}>
            <Balanca inclinar={inc} scale={BS} />
            <Mac t={t} cabeca={[0.5, 0.1]} sobrancelha={0.4} position={[pm[0] * BS, pm[1] * BS + 0.012 * BS, 0]} rotation={[0, 0.2, 0]} rabo={0.5} />
            {pedras.map((p, i) => (
              <Pedra key={i} seed={3} position={p} rotation={[0, 0, 0]} />
            ))}
          </group>
        </>
      );
    },
  }),
  // o humano azul aparece (fade) ao lado, com a MESMA pedra em escala humana sobre bigorna e coco gigantes
  P(w("marreta_num", "um", 1), w("marreta_num", "batendo"), {
    keys: dolly(w("marreta_num", "um", 1), w("marreta_num", "batendo"), [0.9, 1.8, 7.6], [0.88, 1.8, 7.25], [1.05, 1.5, -0.4], 46),
    look: { ...DIA, shadowSize: 7 },
    scene: (t) => (
      <>
        {serra(t, "dia", LIVRE_HUM)}
        <Batendo t={t} t0={t0Para(w("marreta_num", "um", 1) + 0.6)} racha={w("marreta_num", "um", 1) + 0.6} olhar={[0.5, 0.2]} />
        <HumanoPedra t={t} t0={w("marreta_num", "quilos") - 0.75} peso={23} vermelho={0} ceder={0} opac={prog(t, w("marreta_num", "um", 1), w("marreta_num", "humano") + 0.2)} parado={t < w("marreta_num", "quilos") - 0.75} />
      </>
    ),
  }),
  // de perto: o humano bate com os 23 kg (o coco gigante racha)
  P(w("marreta_num", "batendo"), w("marreta_num", "as"), {
    keys: dolly(w("marreta_num", "batendo"), w("marreta_num", "as"), [0.9, 2.5, 5.6], [0.92, 2.5, 5.3], [1.55, 2.2, -0.4], 46),
    look: { ...DIA, shadowSize: 7 },
    scene: (t) => (
      <>
        {serra(t, "dia", LIVRE_HUM)}
        <Batendo t={t} t0={t0Para(w("marreta_num", "batendo"))} rachar={1} />
        <HumanoPedra t={t} t0={w("marreta_num", "quilos") - 0.75} peso={23} vermelho={0} ceder={0} />
      </>
    ),
  }),
  // +35 kg: a pedra fica maior, o humano treme, fica vermelho (fade) e os braços cedem; o macaco bate de novo, tranquilo
  P(w("marreta_num", "as"), S("marreta"), {
    keys: dolly(w("marreta_num", "as"), S("marreta"), [0.9, 1.8, 7.6], [0.88, 1.78, 7.3], [1.05, 1.55, -0.4], 46),
    look: { ...DIA, shadowSize: 7 },
    scene: (t) => {
      const cresce = prog(t, w("marreta_num", "trinta") - 0.2, w("marreta_num", "cinco") + 0.2);
      return (
        <>
          {serra(t, "dia", LIVRE_HUM)}
          <Batendo t={t} t0={t0Para(w("marreta_num", "as") + 0.5)} racha={w("marreta_num", "as") + 0.5} />
          <HumanoPedra t={t} t0={0} parado peso={23 + 12 * cresce} vermelho={cresce} ceder={prog(t, w("marreta_num", "cinco"), S("marreta"))} />
        </>
      );
    },
  }),
  // ======== MARRETA ========
  // close: a casca aberta fica na bigorna; a mão tira o miolo DE DENTRO da metade e leva à boca
  P(S("marreta"), w("marreta", "essa"), {
    keys: dolly(S("marreta"), w("marreta", "essa"), [0.4, 0.56, 1.08], [0.34, 0.55, 0.98], [0.02, 0.33, 0.3], 34, 32),
    look: DIA,
    scene: (t) => {
      const pega = prog(t, S("marreta") + 0.1, w("marreta", "come") + 0.15);
      const leva = prog(t, w("marreta", "come") + 0.25, w("marreta", "castanha") + 0.2);
      const come = t > w("marreta", "castanha") + 0.2;
      const miolo0: V3 = [NOZ[0] + MIOLO_DX, BIGORNA_TOPO + 0.012, NOZ[2]];
      const boca: V3 = [0.0, 0.45, 0.27];
      const naMao = leva > 0;
      const alvo = naMao ? mixV(add(miolo0, [0, 0.01, 0]), boca, leva) : mixV([0.05, 0.3, 0.3], add(miolo0, [0, 0.012, 0]), pega);
      return (
        <>
          {serra(t)}
          <Mac t={t} maoD={{ alvo, palma: naMao ? mixV([0, -1, 0], [0.2, 0.1, -1], leva) : [0, -1, 0], fechar: naMao ? 0.9 : mix(0.3, 0.8, pega) }} maoE={{ alvo: [0.16, 0.22, 0.28], palma: [-0.2, -1, 0.2], fechar: 0.6 }} boca={come ? 0.35 + 0.3 * Math.sin(t * 18) : 0} cabeca={[0.1, mix(0.4, 0.08, leva)]} inclinar={mix(0.2, 0, leva)} position={M0}>
            <Bigorna position={BIG} />
            <Pedra position={[0.16, BIGORNA_TOPO - pedraExtY(3, 1, [0, 0, 0])[0], 0.3]} />
            <Coquinho quebrar={1} semMiolo={naMao} position={NOZ} />
            {naMao && !come ? (
              <mesh position={alvo} scale={[0.014, 0.011, 0.017]}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#F3EAD4" roughness={0.6} />
              </mesh>
            ) : null}
          </Mac>
        </>
      );
    },
  }),
  // essa é sua marreta: no apelido a pedra cai num coco novo e ele racha (câmera de lado: sem cacto atrás da pedra)
  P(w("marreta", "essa"), S("paquera"), {
    keys: dolly(w("marreta", "essa"), S("paquera"), [-0.55, 0.62, 2.1], [-0.5, 0.62, 1.9], [0, 0.6, 0.15], 36),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Batendo t={t} t0={t0Para(w("marreta", "marreta") + 0.05, 1.3)} periodo={1.3} alto={0.7} racha={w("marreta", "marreta") + 0.05} olhar={[-0.3, 0.25]} />
      </>
    ),
  }),
  // ======== PAQUERA ========
  // a fêmea (menor, topete baixo) em primeiro plano, o macho ao fundo; "FÊMEA" no topo
  P(S("paquera"), w("paquera", "nao"), {
    keys: dolly(S("paquera"), w("paquera", "nao"), [0.35, 0.55, 1.55], [0.3, 0.54, 1.42], [-0.25, 0.34, 0.2], 40),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Macho t={t} />
        <Femea t={t} cabeca={[0.25, 0.1]} sobrancelha={-0.6 * prog(t, w("paquera", "quer"), w("paquera", "namorar"))} convencido={0.3} sorriso={prog(t, w("paquera", "namorar"), w("paquera", "nao"))} />
      </>
    ),
  }),
  // não manda recado: pega uma pedrinha do chão
  P(w("paquera", "nao"), w("paquera", "joga"), {
    keys: dolly(w("paquera", "nao"), w("paquera", "joga"), [-1.35, 0.62, 1.75], [-1.25, 0.6, 1.62], [-0.3, 0.36, 0.3], 34, 33),
    look: DIA,
    scene: (t) => {
      const k = prog(t, w("paquera", "nao"), w("paquera", "recado") + 0.2);
      const chao: V3 = [0.02, 0.025, 0.3];
      const alto: V3 = maoArremesso(0);
      const alvo = k < 0.5 ? mixV([-0.1, 0.25, 0.2], chao, k * 2) : mixV(chao, alto, (k - 0.5) * 2);
      return (
        <>
          {serra(t)}
          <Macho t={t} />
          <Femea t={t} mao={{ alvo, palma: [0, -1, 0.2], fechar: k > 0.45 ? 0.9 : 0.3 }} cabeca={[0.2, 0.3 - k * 0.3]} sobrancelha={-0.4} extra={<Pedrinha p={k > 0.45 ? add(alvo, [0, 0.02, 0.03]) : chao} s={1.6 / FEM_S} />} />
        </>
      );
    },
  }),
  // a dois: a pedrinha SAI DA MÃO dela em arco, quica a um palmo dele; ele se assusta e então DÁ BOLA (vira e sorri)
  P(w("paquera", "joga"), w("paquera", "tres"), { keys: PEDRADA_KEYS(w("paquera", "joga"), w("paquera", "tres")), look: DIA, scene: (t) => pedrada(t, w("paquera", "joga")) }),
  // três fêmeas começaram: três em volta, uma de cada vez em "três", "fêmeas", "começaram"
  P(w("paquera", "tres"), w("paquera", "e", 2), {
    keys: dolly(w("paquera", "tres"), w("paquera", "e", 2), [-2.1, 1.5, 2.3], [-1.95, 1.45, 2.15], [0.1, 0.3, 0.0], 46),
    look: DIA,
    scene: (t) => {
      const ts = [w("paquera", "tres"), w("paquera", "femeas"), w("paquera", "comecaram")];
      return (
        <>
          {serra(t)}
          <Macho t={t} acordar={1} virar={1} />
          {FEMEAS.slice(0, 3).map((f, i) => (
            <Arremesso key={i} t={t} t0={ts[i] + 0.1} base={f.p} rot={f.rot} alvo={alvoN(i)} />
          ))}
          <Pedrinha p={pedrinhaPousada(FEM, FEM_ROT, ALVO_MACHO)} s={1.6} />
        </>
      );
    },
  }),
  // e virou moda no bando: seis fêmeas jogando juntas, chuva de pedrinhas em volta do macho, que adora
  P(w("paquera", "e", 2), S("correio"), {
    keys: dolly(w("paquera", "e", 2), S("correio"), [-2.6, 2.2, 3.0], [-2.45, 2.1, 2.8], [0.1, 0.25, -0.05], 48),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Macho t={t} acordar={1} virar={1} />
        {FEMEAS.map((f, i) => (
          <Arremesso key={i} t={t} t0={w("paquera", "virou") + i * 0.13} base={f.p} rot={f.rot} alvo={alvoN(i + 3)} />
        ))}
        <Pedrinha p={pedrinhaPousada(FEM, FEM_ROT, ALVO_MACHO)} s={1.6} />
        {[0, 1, 2].map((i) => (
          <Pedrinha key={i} p={pedrinhaPousada(FEMEAS[i].p, FEMEAS[i].rot, alvoN(i))} s={1.6} />
        ))}
      </>
    ),
  }),
  // ======== CORREIO ========
  // o casal junto: ela com a pedrinha, ele virado para ela; corações subindo entre os dois (longe das bordas e do título)
  P(S("correio"), S("graveto"), {
    keys: dolly(S("correio"), S("graveto"), [0.35, 0.6, 2.3], [0.32, 0.6, 2.15], [0.3, 0.42, 0.0], 40, 38),
    look: TARDE,
    scene: (t) => (
      <>
        {serra(t, "tarde")}
        <Mac t={t} cabeca={[-0.35, 0.05]} sorriso={1} sobrancelha={0.4} position={[0.62, LAJE_TOPO, -0.05]} rotation={[0, -0.6, 0]} />
        <Femea t={t} position={[-0.05, LAJE_TOPO, 0.1]} rot={0.6} mao={{ alvo: [-0.07, 0.36, 0.27], palma: [0, 0.4, 1], fechar: 0.6 }} cabeca={[0.3, 0.0]} sobrancelha={0.65} convencido={0.25} sorriso={1} extra={<Pedrinha p={[-0.07, 0.38, 0.3]} s={1.5} />} />
        <Coracoes t={t} forca={prog(t, S("correio"), w("correio", "correio"))} position={[0.3, 0.75, 0.05]} raio={0.16} faceY={0.0} n={7} />
      </>
    ),
  }),
  // ======== GRAVETO ========
  // o tronco (o mesmo de todos os planos): furo de verdade com uma larva se mexendo lá dentro; o macaco olha
  P(S("graveto"), w("graveto", "voce"), {
    keys: [
      // de um plano com o macaco olhando o tronco até dentro do furo, onde a larva se mexe
      { t: S("graveto"), pos: [1.05, 0.55, -0.95], look: [0.24, 0.36, 0.12], fov: 38 },
      { t: w("graveto", "buraco"), pos: [0.66, 0.36, -0.28], look: [0.31, 0.29, 0.3], fov: 30 },
      { t: w("graveto", "voce"), pos: [0.62, 0.35, -0.22], look: [0.31, 0.29, 0.3], fov: 29 },
    ],
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Tronco t={t} larva={1} />
        <Mac t={t} cabeca={[0.6, 0.2]} sobrancelha={0.5} position={MG} rotation={[0, 0.35, 0]} />
      </>
    ),
  }),
  // quebra um graveto: segura o galho com as duas mãos, dobra e PARTE — o pedaço grosso cai, ele fica com o fino
  P(w("graveto", "voce"), w("graveto", "arranca"), {
    keys: dolly(w("graveto", "voce"), w("graveto", "arranca"), [0.42, 0.52, 0.95], [0.38, 0.5, 0.86], [0.17, 0.37, 0.21], 36, 34),
    look: DIA,
    scene: (t) => quebraGalho(t),
  }),
  // arranca as folhas: uma a uma, cada folha solta cai do lugar dela no graveto
  P(w("graveto", "arranca"), w("graveto", "e"), {
    keys: dolly(w("graveto", "arranca"), w("graveto", "e"), [0.5, 0.52, 0.98], [0.47, 0.5, 0.9], [0.3, 0.36, 0.22], 36, 34),
    look: DIA,
    scene: (t) => tiraFolhas(t),
  }),
  // enfia lá dentro e gira
  P(w("graveto", "e"), S("cotonete"), {
    keys: dolly(w("graveto", "e"), S("cotonete"), [1.6, 0.72, -0.6], [1.5, 0.7, -0.55], [0.27, 0.38, 0.1], 38, 37),
    look: DIA,
    scene: (t) => gravetoNoBuraco(t, 1 - prog(t, w("graveto", "enfia") - 0.15, w("graveto", "dentro")) * 0.65, false, 0, 1),
  }),
  // ======== COTONETE ========
  // tira bicho de buraco: o graveto sai com a larva presa na ponta e ele leva a ponta à boca (por fora do rosto)
  P(S("cotonete"), w("cotonete", "e"), {
    keys: dolly(S("cotonete"), w("cotonete", "e"), [1.6, 0.72, -0.6], [1.5, 0.7, -0.55], [0.27, 0.38, 0.1], 38, 37),
    look: DIA,
    scene: (t) => gravetoNoBuraco(t, 0.35 + prog(t, S("cotonete"), w("cotonete", "bicho") + 0.15) * 0.65, true, prog(t, w("cotonete", "bicho") + 0.3, w("cotonete", "buraco") + 0.25)),
  }),
  // e já pegaram macaca enfiando graveto: close da macaca, graveto fininho na mão subindo até o nariz
  P(w("cotonete", "e"), w("cotonete", "no"), {
    keys: dolly(w("cotonete", "e"), w("cotonete", "no"), [0.62, 0.52, 0.95], [0.55, 0.51, 0.85], [0.0, 0.42, 0.05], 30, 28),
    look: DIA,
    scene: (t) => nariz(t),
  }),
  // no nariz até espirrar: mais perto; o graveto entra um pouco na narina e ATCHIM (nuvenzinha, olhos apertados)
  P(w("cotonete", "no"), w("cotonete", "esse"), {
    keys: dolly(w("cotonete", "no"), w("cotonete", "esse"), [0.42, 0.5, 0.7], [0.38, 0.5, 0.64], [0.0, 0.42, 0.1], 26, 25),
    look: DIA,
    scene: (t) => nariz(t),
  }),
  // esse é seu cotonete: ela segura o graveto longe do rosto, satisfeita
  P(w("cotonete", "esse"), S("lascas"), {
    keys: dolly(w("cotonete", "esse"), S("lascas"), [0.75, 0.6, 1.15], [0.68, 0.58, 1.05], [0.0, 0.45, 0.05], 32, 30),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Mac t={t} femea scale={FEM_S} convencido={1} sorriso={0.7} cabeca={[0.3, 0.05]} maoD={{ alvo: [-0.17, 0.36, 0.3], palma: [0.3, -0.2, 1], fechar: 0.85 }} position={M0}>
          <group position={[-0.17, 0.36, 0.33]} rotation={[0, 0, 0.35]}>
            <Graveto folhas={0} scale={0.45} position={[0, -0.04, 0]} />
          </group>
        </Mac>
      </>
    ),
  }),
  // ======== LASCAS ========
  // close: golpe lento no 2º "pedra": o martelo para NA SUPERFÍCIE da pedra de baixo, repica e solta poeira; nenhuma lasca ainda
  P(S("lascas"), w("lascas", "sem"), {
    keys: dolly(S("lascas"), w("lascas", "sem"), [0.62, 0.42, 1.05], [0.56, 0.4, 0.98], [0.02, 0.32, 0.38], 30, 28),
    look: DIA,
    scene: (t) => {
      const m = martelo(t, t0Para(LASCA_G1, 2.4), 2.4, 0.3, BATE_PEDRA, 0.014);
      return (
        <>
          {serra(t)}
          <Batendo t={t} t0={t0Para(LASCA_G1, 2.4)} periodo={2.4} alto={0.3} pedraEmPedra extra={<><Faiscas k={m.impacto} position={[ALVO_C[0], ALVO_TOPO, ALVO_C[2]]} /><Poeira t={t} ti={LASCA_G1} /></>} />
        </>
      );
    },
  }),
  // sem querer você solta lascas: mesma bigorna e mesma pedra de baixo; um golpe, e as lascas SALTAM no impacto ("solta")
  P(w("lascas", "sem"), w("lascas", "afiadas"), {
    keys: dolly(w("lascas", "sem"), w("lascas", "afiadas"), [1.1, 0.75, 1.35], [1.0, 0.7, 1.25], [0, 0.32, 0.3], 36, 34),
    look: DIA,
    scene: (t) => lascasSaltam(t),
  }),
  // afiadas: macro na lasca que caiu; o gume brilha
  P(w("lascas", "afiadas"), w("lascas", "parecidas"), {
    keys: (() => {
      const p = add(M0, lascaVoo(LASCA_VOO[0], 9).p);
      return dolly(w("lascas", "afiadas"), w("lascas", "parecidas"), add(p, [0.34, 0.2, 0.32]), add(p, [0.28, 0.17, 0.27]), p, 32, 30);
    })(),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Batendo t={t} t0={t0Para(LASCA_G2, 1.6)} periodo={1.6} alto={0.45} pedraEmPedra extra={LASCA_VOO.map((L, i) => {
          const v = lascaVoo(L, 9);
          return <Lasca key={i} seed={L.seed} position={v.p} rotation={v.rot} scale={L.s} brilho={i === 0 ? 0.35 + 0.65 * Math.max(0, Math.sin((t - w("lascas", "afiadas")) * 4.5)) : 0.15} />;
        })} />
      </>
    ),
  }),
  // qual delas o macaco fez? — as duas lascas na laje, o macaco atrás delas (no mundo dele, sem estúdio)
  P(w("lascas", "parecidas"), w("lascas", "da"), {
    keys: dolly(w("lascas", "parecidas"), w("lascas", "da"), [0.0, 0.36, 1.35], [0.0, 0.35, 1.22], [0, 0.24, 0.2], 36),
    look: DIA,
    scene: (t) => duasLascas(t, true),
  }),
  // da humanidade: só as duas lascas (o macaco fica fora do quadro quando "humanidade" está escrito)
  P(w("lascas", "da"), S("idade"), {
    keys: dolly(w("lascas", "da"), S("idade"), [0.0, LAJE_TOPO + 0.22, 0.72], [0.0, LAJE_TOPO + 0.21, 0.67], [0, LAJE_TOPO + 0.04, 0.36], 30),
    look: DIA,
    scene: (t) => duasLascas(t, false),
  }),
  // ======== IDADE ========
  // Piauí: arqueólogos cavando perto da laje (sem macaco no quadro)
  P(S("idade"), w("idade", "cavaram"), {
    keys: dolly(S("idade"), w("idade", "cavaram"), [2.4, 2.4, 5.6], [2.35, 2.2, 5.1], [1.6, 0.35, -0.6], 50),
    look: { ...DIA, shadowSize: 9 },
    scene: (t) => sitio(t, 0),
  }),
  // de cima: o pincel baixa a terra e as pedras e lascas antigas (as mesmas do macaco) vão aparecendo
  P(w("idade", "cavaram"), w("idade", "e"), {
    keys: dolly(w("idade", "cavaram"), w("idade", "e"), [ESC[0], 4.4, ESC[2] + 0.5], [ESC[0], 4.0, ESC[2] + 0.45], [ESC[0], -0.3, ESC[2]], 44),
    look: { ...DIA, shadowSize: 9 },
    scene: (t) => sitio(t, prog(t, w("idade", "cavaram") + 0.1, w("idade", "e") - 0.1, (x) => x)),
  }),
  // corte do terreno: pedras e lascas em cada camada acendem de baixo para cima; contador chega a 3.000 em "mil"
  P(w("idade", "e"), w("idade", "essa"), {
    keys: dolly(w("idade", "e"), w("idade", "essa"), [0.2, -0.45, 4.2], [0.15, -0.42, 3.85], [0, -0.75, 0], 46),
    look: DIA,
    scene: (t) => estrato(t, prog(t, w("idade", "acharam"), w("idade", "mil")), w("idade", "e")),
  }),
  // o macaco de hoje martelando na beira da escavação: essa é sua idade da pedra
  P(w("idade", "essa"), S("gaviao"), {
    keys: dolly(w("idade", "essa"), S("gaviao"), [2.0, 0.85, 2.05], [1.95, 0.83, 1.93], [1.25, 0.4, 0.55], 44),
    look: { ...DIA, shadowSize: 9 },
    scene: (t) => sitio(t, 1, true),
  }),
  // ======== COBRA (cena "gaviao" da timeline) ========
  // mas no chão tem cobra: câmera rente à laje, a coral entra rastejando pela borda; o bando ao fundo ainda não viu
  P(S("gaviao"), w("gaviao", "se"), {
    keys: dolly(S("gaviao"), w("gaviao", "se"), [0.55, 0.2, 1.45], [0.5, 0.19, 1.35], [-0.35, 0.12, 0.1], 40),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Cobra t={t} tipo="coral" corpo={coralCorpo(t, coralFrente(t))} />
        {BANDO_CERCO.slice(0, 3).map((m, i) => (
          <Mac key={i} t={t + i * 0.4} femea={m.fem} position={add(m.p, [0, 0, -0.4])} rotation={[0, m.rot + 0.4, 0]} cabeca={[Math.sin(t * 0.8 + i) * 0.3, 0.1]} />
        ))}
      </>
    ),
  }),
  // se é venenosa: close da cabeça da coral (anéis vermelho, preto e amarelo), língua para fora
  P(w("gaviao", "se"), w("gaviao", "o"), {
    keys: (() => {
      const h = coralCorpo(0, coralFrente(w("gaviao", "venenosa")))(0);
      return dolly(w("gaviao", "se"), w("gaviao", "o"), add(h, [0.32, 0.08, 0.2]), add(h, [0.26, 0.07, 0.16]), add(h, [0, 0.01, 0]), 32, 30);
    })(),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Cobra t={t} tipo="coral" corpo={coralCorpo(t, coralFrente(t), prog(t, w("gaviao", "se"), w("gaviao", "venenosa") + 0.3))} />
      </>
    ),
  }),
  // o bando inteiro cerca e grita: seis macacos em roda, cada um gritando com ondas saindo da boca; a cobra ergue a cabeça e recua
  P(w("gaviao", "o"), w("gaviao", "se", 1), {
    keys: dolly(w("gaviao", "o"), w("gaviao", "se", 1), [0.1, 2.3, 2.6], [0.1, 2.15, 2.35], [-0.1, 0.1, 0.05], 46),
    look: DIA,
    scene: (t) => {
      const fecha = prog(t, w("gaviao", "cerca") - 0.2, w("gaviao", "cerca") + 0.4);
      return (
        <>
          {serra(t)}
          <Cobra t={t} tipo="coral" corpo={coralCorpo(t, coralFrente(t), 0.6 + 0.4 * fecha)} />
          {BANDO_CERCO.map((m, i) => {
            const g = prog(t, w("gaviao", "e", 1) - 0.2 + i * 0.07, w("gaviao", "e", 1) + i * 0.07);
            const p = mixV(m.p, [m.p[0] * 0.82, m.p[1], (m.p[2] - 0.1) * 0.82 + 0.1], fecha);
            return (
              <group key={i}>
                <Mac t={t + i * 0.37} femea={m.fem} grito={g * (0.75 + 0.25 * Math.sin(t * 5 + i))} sobrancelha={-0.6} cabeca={[0, 0.25]} inclinar={0.25 * fecha} position={p} rotation={[0, m.rot, 0]} />
                {g > 0.01 ? <Ondinhas t={t + i * 0.2} intensidade={g} position={add(p, [Math.sin(m.rot) * 0.12, 0.46, Math.cos(m.rot) * 0.12])} alcance={0.35} /> : null}
              </group>
            );
          })}
        </>
      );
    },
  }),
  // se não é, vocês comem: a cobra-cipó verde, fina, pendurada nas mãos dele; ele mastiga a ponta (cabeça escondida, sem sangue)
  P(w("gaviao", "se", 1), S("alarme"), {
    keys: dolly(w("gaviao", "se", 1), S("alarme"), [0.62, 0.55, 1.25], [0.55, 0.54, 1.12], [0.03, 0.36, 0.15], 34, 32),
    look: DIA,
    scene: (t) => comeCobra(t, w("gaviao", "comem")),
  }),
  // ======== ALARME ========
  // grito de alarme: um macaco, um plano só, anéis saindo da boca; céu e caatinga ao fundo
  P(S("alarme"), w("alarme", "um"), {
    keys: dolly(S("alarme"), w("alarme", "um"), [0.15, 0.48, 0.8], [0.13, 0.48, 0.7], [0, 0.48, 0.05], 34, 32),
    look: DIA,
    scene: (t) => {
      const g = prog(t, w("alarme", "grito") - 0.15, w("alarme", "grito") + 0.1);
      return (
        <>
          {serra(t)}
          <Mac t={t} grito={g * (0.8 + 0.2 * Math.sin(t * 4))} sobrancelha={-0.5} cabeca={[0, mix(0.1, -0.15, g)]} position={M0} />
          {g > 0.01 ? <Ondinhas t={t} intensidade={g} position={[0, LAJE_TOPO + 0.38, 0.14]} alcance={0.4} /> : null}
        </>
      );
    },
  }),
  // um avisa e o bando inteiro fica sabendo: o grito PASSA de macaco em macaco (o anel de um chega ao próximo, que vira e grita)
  P(w("alarme", "um"), w("alarme", "esse"), {
    keys: dolly(w("alarme", "um"), w("alarme", "esse"), [0.0, 1.15, 3.1], [0.0, 1.1, 2.85], [0, 0.35, 0], 46),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        {BANDO_FILA.map((m, i) => {
          const ti = i === 0 ? w("alarme", "avisa") : w("alarme", "e") + (i - 1) * 0.28;
          const g = prog(t, ti, ti + 0.15);
          const olha = i === 0 ? 0 : prog(t, ti - 0.25, ti) * (1 - g);
          return (
            <group key={i}>
              <Mac t={t + i * 0.37} femea={m.fem} grito={g * (0.8 + 0.2 * Math.sin(t * 5 + i))} sobrancelha={mix(0, -0.5, g)} cabeca={[mix(-m.rot, 0.9, olha), mix(0.1, -0.1, g)]} position={m.p} rotation={[0, m.rot, 0]} />
              {g > 0.01 ? <Ondinhas t={t + i * 0.2} intensidade={g} position={add(m.p, [Math.sin(m.rot) * 0.12, 0.42, Math.cos(m.rot) * 0.12])} alcance={0.42} /> : null}
            </group>
          );
        })}
      </>
    ),
  }),
  // esse é seu grupo da família: o bando junto, balões "!" sobre cada um
  P(w("alarme", "esse"), S("virada"), {
    keys: dolly(w("alarme", "esse"), S("virada"), [0.0, 1.0, 3.0], [0.0, 0.98, 2.8], [0, 0.4, 0], 44),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        {BANDO_FILA.map((m, i) => (
          <group key={i}>
            <Mac t={t + i * 0.37} femea={m.fem} grito={0.35 + 0.15 * Math.sin(t * 3 + i)} sobrancelha={0.4} cabeca={[-m.rot * 0.5, 0.0]} position={m.p} rotation={[0, m.rot * 0.5, 0]} />
            <BalaoAviso aparecer={prog(t, w("alarme", "grupo") + i * 0.08, w("alarme", "grupo") + i * 0.08 + 0.25)} position={add(m.p, [0.06, 0.95, 0])} scale={1.3} />
          </group>
        ))}
      </>
    ),
  }),
  // ======== VIRADA ========
  // suas lascas: o macaco INTEIRO atrás, as duas lascas na frente
  P(S("virada"), w("virada", "com"), {
    keys: dolly(S("virada"), w("virada", "com"), [0.0, 0.42, 1.95], [0.0, 0.4, 1.78], [0, 0.3, 0.15], 40),
    look: DIA,
    scene: (t) => duasLascas(t, true),
  }),
  // com as dos primeiros humanos: só as lascas (sem macaco no quadro com "humanos" escrito)
  P(w("virada", "com"), w("virada", "da"), {
    keys: dolly(w("virada", "com"), w("virada", "da"), [0.0, LAJE_TOPO + 0.22, 0.72], [0.0, LAJE_TOPO + 0.21, 0.68], [0, LAJE_TOPO + 0.04, 0.36], 30),
    look: DIA,
    scene: (t) => duasLascas(t, false),
  }),
  // dá pra confundir: resposta do quiz — rótulo embaixo de cada lasca
  P(w("virada", "da"), w("virada", "pedra"), {
    keys: dolly(w("virada", "da"), w("virada", "pedra"), [0.0, LAJE_TOPO + 0.21, 0.68], [0.0, LAJE_TOPO + 0.205, 0.66], [0, LAJE_TOPO + 0.04, 0.36], 30),
    look: DIA,
    scene: (t) => duasLascas(t, false),
  }),
  // pedra lascada era coisa só de gente: vitrine "FERRAMENTA HUMANA", câmera PARADA (texto nítido, sem tremer)
  P(w("virada", "pedra"), w("virada", "voce"), {
    keys: fixa(w("virada", "pedra"), w("virada", "voce"), [0.04, VITRINE_M_TOPO[1] + 0.42, 1.35], [0.02, VITRINE_M_TOPO[1] + 0.08, 0.12], 40),
    look: MUSEU,
    drift: 0,
    scene: () => (
      <VitrineMuseu>
        <Lasca seed={5} cor="#A99F90" position={[-0.06, VITRINE_M_TOPO[1] + 0.1, 0.05]} rotation={[0.15, 0.35, 0.3]} scale={1.9} />
      </VitrineMuseu>
    ),
  }),
  // você bagunçou essa certeza: o macaco INTEIRO sobe no pedestal, põe a lasca dele ao lado e derruba a placa com a mão
  P(w("virada", "voce"), S("final"), {
    keys: fixa(w("virada", "voce"), S("final"), [0.1, VITRINE_M_TOPO[1] + 0.62, 2.15], [0.12, VITRINE_M_TOPO[1] + 0.3, 0.05], 42),
    look: MUSEU,
    drift: 0,
    scene: (t) => baguncou(t),
  }),
  // ======== FINAL (recapitulação em flashes) ========
  P(S("final"), w("final", "pesca"), {
    keys: dolly(S("final"), w("final", "pesca"), [1.45, 0.55, 0.75], [1.3, 0.5, 0.7], [0, 0.38, 0.25], 36, 34),
    look: DIA,
    scene: (t) => (
      <>
        {serra(t)}
        <Batendo t={t} t0={t0Para(w("final", "coco") + 0.05)} racha={w("final", "coco") + 0.05} />
      </>
    ),
  }),
  P(w("final", "pesca"), w("final", "paquera"), {
    keys: dolly(w("final", "pesca"), w("final", "paquera"), [1.6, 0.72, -0.6], [1.5, 0.7, -0.55], [0.27, 0.38, 0.1], 38, 37),
    look: DIA,
    scene: (t) => gravetoNoBuraco(t, 0.6 + prog(t, w("final", "pesca"), w("final", "graveto")) * 0.4, true, prog(t, w("final", "graveto") - 0.1, w("final", "graveto") + 0.5)),
  }),
  P(w("final", "paquera"), w("final", "come"), { keys: PEDRADA_KEYS(w("final", "paquera"), w("final", "come")), look: DIA, scene: (t) => pedrada(t, w("final", "paquera") + 0.05, 0.85) }),
  P(w("final", "come"), w("final", "e"), {
    keys: dolly(w("final", "come"), w("final", "e"), [0.62, 0.55, 1.25], [0.58, 0.54, 1.18], [0.03, 0.36, 0.15], 34, 33),
    look: DIA,
    scene: (t) => comeCobra(t, w("final", "come") - 0.4),
  }),
  // flash das lascas saltando (o fato principal)
  P(w("final", "e"), w("final", "ha"), {
    keys: dolly(w("final", "e"), w("final", "ha"), [1.1, 0.75, 1.35], [1.02, 0.71, 1.27], [0, 0.32, 0.3], 36, 34),
    look: DIA,
    scene: (t) => lascasSaltam(t, w("final", "e") + 0.25),
  }),
  P(w("final", "ha"), w("final", "voce", 1), {
    keys: dolly(w("final", "ha"), w("final", "voce", 1), [0.2, -0.45, 4.2], [0.15, -0.42, 3.9], [0, -0.75, 0], 46),
    look: DIA,
    scene: (t) => estrato(t, prog(t, w("final", "ha"), w("final", "mil")), w("final", "ha")),
  }),
  // você é um macaco: volta para o quadro de abertura (último quadro = primeiro)
  P(w("final", "voce", 1), FIM + 1 / FPS, {
    keys: [
      { t: w("final", "voce", 1), pos: [2.1, 0.5, 2.9], look: [0.05, 0.55, 0.05], fov: 40 },
      { ...ABRE_KEYS(0)[0], t: FIM },
    ],
    look: DIA,
    drift: 0,
    scene: (t) => <Abertura u={t - FIM} />,
  }),
];

// ---------- cenas reutilizadas ----------
function lascasSaltam(t: number, ti = LASCA_G2) {
  const t0 = t0Para(ti, 1.6);
  const m = martelo(t, t0, 1.6, 0.45, BATE_PEDRA, 0.014);
  return (
    <>
      {serra(t)}
      <Batendo t={t} t0={t0} periodo={1.6} alto={0.45} pedraEmPedra olhar={[0.3, 0.3]} extra={<><Faiscas k={m.impacto} position={[ALVO_C[0], ALVO_TOPO, ALVO_C[2]]} /><Poeira t={t} ti={ti} /><LascasVoo t={t} ti={ti} /></>} />
    </>
  );
}
// as duas lascas lado a lado na laje: esquerda = a do macaco (cinza), direita = a dos primeiros humanos (bege)
function duasLascas(t: number, comMacaco: boolean) {
  const y = LAJE_TOPO + 0.006;
  return (
    <>
      {serra(t)}
      <group position={[-0.07, y + 0.04, 0.36]} rotation={[-0.35, t * 0.5, 0]}>
        <Lasca seed={2} rotation={[0, 0, 0.2]} scale={1.25} brilho={0.12} />
      </group>
      <group position={[0.07, y + 0.04, 0.36]} rotation={[-0.35, t * 0.5 + 1, 0]}>
        <Lasca seed={5} cor="#A99F90" rotation={[0, 0, -0.2]} scale={1.25} brilho={0.12} />
      </group>
      {comMacaco ? (
        <Mac t={t} cabeca={[0, 0.35]} sobrancelha={0.3} convencido={0.4} position={[0, LAJE_TOPO, -0.12]}>
          <Bigorna position={[0.42, 0, 0.1]} rotation={[0, 0.6, 0]} scale={0.7} cascas={3} />
        </Mac>
      ) : null}
    </>
  );
}
// corte do terreno + macaco de hoje martelando em cima
function estrato(t: number, acender: number, t0: number) {
  const m = martelo(t, t0, 1.2, 0.62, BATE_ABERTO);
  return (
    <>
      {serra(t)}
      <CorteEstrato acender={acender} position={[0, -0.02, 0]} />
      <Mac t={t} {...pegaDupla(m.c, PEDRA_R * 0.95, 0.85)} cabeca={[0, 0.35]} inclinar={0.2} position={[0.2, 0, -0.6]} scale={1.2}>
        <Bigorna position={BIG} />
        <Pedra position={m.c} rotation={MARTELO_ROT} />
        <Coquinho quebrar={1} position={NOZ} />
      </Mac>
    </>
  );
}
// cobra-cipó comida (sem sangue): o corpo pendurado das mãos, a cabeça na boca
function comeCobra(t: number, t0: number) {
  const mast = Math.max(0, Math.sin((t - t0) * 9));
  return (
    <>
      {serra(t)}
      <Mac t={t} maoD={{ alvo: [-0.06, 0.33, 0.24], palma: [1, 0, 0.3], fechar: 0.9 }} maoE={{ alvo: [0.07, 0.3, 0.25], palma: [-1, 0, 0.3], fechar: 0.9 }} boca={0.25 + 0.3 * mast} cabeca={[0, 0.25]} convencido={0.6} position={M0}>
        <Cobra t={t} tipo="verde" raio={0.011} lingua={0} esconderCabeca corpo={cipoNaMao(t)} />
      </Mac>
    </>
  );
}
// galho quebrado na tela: duas metades unidas que dobram em V e partem; a grossa cai na laje
function quebraGalho(t: number) {
  const tq = w("graveto", "quebra") + 0.2;
  const dobra = prog(t, w("graveto", "quebra") - 0.2, tq);
  const solto = clamp01((t - tq) / 0.6);
  const c: V3 = [0.02, 0.3, 0.26];
  const ang = t < tq ? dobra * 0.5 : 0;
  const queda = 0.5 * 7.5 * Math.pow(solto * 0.6, 2);
  const PAU = (
    <mesh scale={[0.008, 0.14, 0.008]} castShadow>
      <cylinderGeometry args={[1, 1, 1, 8]} />
      <meshStandardMaterial color="#7A5536" roughness={0.85} />
    </mesh>
  );
  return (
    <>
      {serra(t)}
      <Mac t={t} maoE={{ alvo: [c[0] + 0.1, c[1] + ang * 0.06, c[2]], palma: [0, 0, -1], fechar: 0.9 }} maoD={t < tq ? { alvo: [c[0] - 0.1, c[1] + ang * 0.06, c[2]], palma: [0, 0, -1], fechar: 0.9 } : { alvo: [c[0] - 0.13, c[1] - 0.02, c[2] + 0.02], palma: [0, -1, 0.3], fechar: 0.3 }} cabeca={[0, 0.35]} position={MG}>
        <group position={c} rotation={[0, 0, -ang]}>
          <Graveto folhas={1} rotation={[0, 0, -PI / 2]} />
        </group>
        {t < tq ? (
          <group position={c} rotation={[0, 0, ang]}>
            <group position={[-0.07, 0, 0]} rotation={[0, 0, PI / 2]}>{PAU}</group>
          </group>
        ) : (
          <group position={[c[0] - 0.08, Math.max(-c[1] + 0.016 + c[1] - 0.29, c[1] - queda), c[2] + solto * 0.05]} rotation={[0, 0.3 * solto, PI / 2 + solto * 1.2]}>
            {PAU}
          </group>
        )}
        {t >= tq && t < tq + 0.25 ? <Faiscas k={1 - (t - tq) / 0.25} position={[c[0] - 0.01, c[1], c[2]]} /> : null}
      </Mac>
    </>
  );
}
// arranca as folhas uma a uma: cada folha solta cai do lugar dela
function tiraFolhas(t: number) {
  const a = w("graveto", "arranca") - 0.1, b = w("graveto", "e") - 0.1;
  const k = prog(t, a, b, (x) => x);
  const c: V3 = [0.02, 0.3, 0.26];
  const N = 7;
  const yF = (j: number) => 0.08 + (j / N) * (GRAVETO_L - 0.1);
  // o Graveto mantém as folhas 0..kept-1 (da base para a ponta): a última presa é a próxima a sair
  const tira = (j: number) => a + ((N - 1 - j + 0.5) / N) * (b - a);
  const prox = Math.max(0, Math.min(N - 1, N - 1 - Math.floor(k * N)));
  const mao: V3 = [c[0] - 0.02 + yF(prox), c[1] + 0.02, c[2] + 0.015];
  return (
    <>
      {serra(t)}
      <Mac t={t} maoD={{ alvo: [c[0] - 0.03, c[1], c[2]], palma: [0, 0, -1], fechar: 0.9 }} maoE={{ alvo: mao, palma: [0, -1, 0], fechar: 0.75 }} cabeca={[-0.25, 0.4]} position={MG}>
        <Graveto folhas={1 - k} position={[c[0] - 0.02, c[1], c[2]]} rotation={[0, 0, -PI / 2]} />
        {Array.from({ length: N }).map((_, j) => {
          const dt = t - tira(j);
          if (dt < 0) return null;
          const yy = Math.max(-MG[1] + 0.01, c[1] + 0.03 - 0.5 * 3.5 * dt * dt);
          return (
            <mesh key={j} position={[c[0] - 0.02 + yF(j) + dt * 0.04, yy, c[2] + 0.02 + Math.sin(dt * 7 + j) * 0.015]} rotation={[dt * 4 + j, j, dt * 3]} scale={[0.02, 0.001, 0.03]}>
              <sphereGeometry args={[1, 6, 4]} />
              <meshStandardMaterial color="#7E9B4A" roughness={0.7} />
            </mesh>
          );
        })}
      </Mac>
    </>
  );
}
// macaca com graveto no nariz (cômico): graveto fininho sobe até a narina, entra um pouco e ela espirra
function nariz(t: number) {
  const sobe = prog(t, w("cotonete", "e") + 0.2, w("cotonete", "graveto") + 0.2);
  const entra = prog(t, w("cotonete", "no"), w("cotonete", "nariz") + 0.3);
  const te = w("cotonete", "espirrar") + 0.05;
  const pre = prog(t, w("cotonete", "ate") - 0.1, te - 0.05);
  const atchim = clamp01((t - te) / 0.55);
  const puxa = t > te ? Math.exp(-(t - te) * 5) : 0;
  const narina: V3 = [-0.009, 0.385, 0.215];
  const dir = new THREE.Vector3(0.5, -0.75, 0.45).normalize();
  const L = GRAVETO_L * 0.32;
  const ponta = new THREE.Vector3(...narina).addScaledVector(dir, (1 - entra) * 0.05 + (1 - sobe) * 0.18 - entra * 0.012 + puxa * 0.04);
  const base = ponta.clone().addScaledVector(dir, L);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  return (
    <>
      {serra(t)}
      <Mac t={t} femea scale={FEM_S} maoD={{ alvo: base.toArray() as V3, palma: [0.6, 0.3, 0.4], fechar: 0.9 }} cabeca={[0.15, mix(0.0, -0.25, pre) + puxa * 0.45, 0]} piscar={Math.max(pre * 0.6, t > te ? 1 - atchim * 0.6 : 0)} sobrancelha={mix(0.3, 0.8, pre)} boca={pre * 0.25 + (t > te ? 0.5 * (1 - atchim) : 0)} position={M0}>
        <group position={base.toArray() as V3} quaternion={q}>
          <Graveto folhas={0} scale={0.32} />
        </group>
        <Espirro k={atchim} position={narina} rotation={[0.25, 0.3, 0]} scale={1.6} />
      </Mac>
    </>
  );
}
// virada: vitrine sem vidro; o macaco sobe por trás do pedestal (à direita), pousa a lasca dele ao lado e derruba a placa
function baguncou(t: number) {
  const top = VITRINE_M_TOPO[1];
  const v = w("virada", "voce");
  const sobe = prog(t, v - 0.05, v + 0.4);
  const vai = prog(t, v + 0.35, w("virada", "baguncou") + 0.3);
  const poe = prog(t, w("virada", "baguncou") + 0.1, w("virada", "baguncou") + 0.45);
  const bate = prog(t, w("virada", "essa") - 0.15, w("virada", "essa") + 0.1);
  const cai = prog(t, w("virada", "essa"), w("virada", "certeza") + 0.25);
  const p: V3 = mixV([0.62, top - 0.75, -0.8], [0.62, top + 0.02, -0.48], sobe); // sobe por TRÁS do pedestal
  const pos = mixV(p, [0.36, top + 0.02, 0.02], vai);
  const pousa: V3 = [0.2 - pos[0], top + 0.012 - pos[1], 0.14 - pos[2]];
  const maoLasca: V3 = poe < 1 ? mixV([-0.12, 0.28, 0.24], pousa, poe) : pousa;
  const maoPlaca: V3 = mixV([0.1, 0.25, 0.2], [-0.24, 0.08, 0.27], bate);
  return (
    <VitrineMuseu cair={cai} vidro={false}>
      <Lasca seed={5} cor="#A99F90" position={[-0.06, top + 0.1, 0.05]} rotation={[0.15, 0.35, 0.3]} scale={1.9} />
      <Mac t={t} position={pos} rotation={[0, -0.25, 0]} sentar={mix(0.4, 1, vai)} cabeca={[0.35, 0.2]} sobrancelha={0.2} convencido={cai} maoD={{ alvo: maoLasca, palma: [0, -1, 0.2], fechar: poe < 1 ? 0.75 : 0.3 }} maoE={bate > 0 ? { alvo: maoPlaca, palma: [-0.3, -0.2, 1], fechar: 0.2 } : undefined}>
        <group position={maoLasca}>
          <Lasca seed={2} position={[0, 0.012, 0.0]} rotation={[PI / 2 - 0.2, 0.2, 0]} scale={1.9} brilho={0.1} />
        </group>
      </Mac>
    </VitrineMuseu>
  );
}
// sítio arqueológico ao lado da laje: escavação + arqueólogos; `macaco` = macaco atual martelando na beira (sem humanos)
function sitio(t: number, achados: number, macaco = false) {
  const E: V3 = ESC;
  return (
    <>
      <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }, { x: ESC[0], z: ESC[2], r: 2.2 }]} buraco={[ESC[0] - 1.2, ESC[2] - 0.9, ESC[0] + 1.2, ESC[2] + 0.9]} />
      <Escavacao achados={achados} position={E} />
      {/* regra: humano e macaco nunca dividem o quadro (só o humano translúcido da régua de força) */}
      {/* um arqueólogo DENTRO da cova, ajoelhado junto dos montinhos que o pincel vai baixando */}
      {!macaco ? <Arqueologo t={t} position={add(E, [-0.05, -0.7, -0.55])} rotation={[0, 0.1, 0]} camisa="#C9B28A" pele="#B97F55" scale={0.42} /> : null}
      {!macaco ? <Arqueologo t={t + 1} position={add(E, [1.5, 0, 0.3])} rotation={[0, -1.9, 0]} camisa="#8FA3B8" pele="#D9A27A" scale={0.42} /> : null}
      {macaco ? (
        <group position={[ESC[0] - 1.45, 0, ESC[2] + 1.1]} rotation={[0, 0.9, 0]}>
          <Batendo t={t} t0={t0Para(w("idade", "pedra") + 0.05)} racha={w("idade", "pedra") + 0.05} />
        </group>
      ) : (
        <group position={M0} rotation={[0, 0.5, 0]}>
          <Bigorna position={BIG} />
          <Pedra position={[0.16, BIGORNA_TOPO - pedraExtY(3, 1, [0, 0, 0])[0], 0.3]} />
        </group>
      )}
    </>
  );
}

// legenda: o apelido ("Esse é seu ___") fica todo em amarelo
const WORDS: Word[] = TL.cenas.flatMap((c) => {
  const ws = c.words.map((x) => ({ ...x, s: x.s + OFF, e: x.e + OFF }));
  if (!c.label) return ws;
  const i = ws.findIndex((x, k) => /^ess[ea]$/i.test(x.w) && k > ws.length - 7);
  return ws.map((x, k) => (i >= 0 && k >= i + 3 ? { ...x, kw: true } : x));
});

export const Macaco: React.FC = () => {
  useKitFont();
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#CFE6EF" }}>
        {PLANS.map((p, i) => {
          const L = p.look ?? DIA;
          return (
            <Shot key={i} from={p.from} to={p.to} sun={L.sun} sunPower={L.sunPower} ambient={L.ambient} shadowSize={L.shadowSize} exposure={L.exposure}>
              {(t) => (
                <>
                  <CameraRig keys={p.keys} offset={p.from} drift={p.drift ?? 1} />
                  {p.scene(t)}
                </>
              )}
            </Shot>
          );
        })}
        {/* números e cabeçalhos no topo */}
        <NumeroTopo de={w("gancho", "mais")} ate={S("marreta_num")} numero="+ de 1 kg" sub="de pedra" tamanho={130} />
        <NumeroTopo de={w("marreta_num", "terco")} ate={w("marreta_num", "um", 1)} numero="1/3" sub="do seu peso" />
        <NumeroTopo de={w("marreta_num", "setenta")} ate={w("marreta_num", "vinte")} numero="70 kg" sub="humano" />
        <NumeroTopo de={w("marreta_num", "vinte")} ate={w("marreta_num", "as")} numero="23 kg" sub="de pedra" />
        <NumeroTopo de={w("marreta_num", "mais")} ate={S("marreta")} numero="+ de 35 kg" sub="de pedra" tamanho={130} />
        <NumeroTopo de={w("paquera", "femea")} ate={w("paquera", "nao")} numero="fêmea" tamanho={130} />
        <NumeroTopo de={w("paquera", "tres")} ate={w("paquera", "e", 2)} numero="3 fêmeas" tamanho={130} />
        <NumeroTopo de={w("paquera", "virou")} ate={S("correio")} numero="virou moda" tamanho={120} />
        <NumeroTopo de={w("lascas", "parecidas")} ate={S("idade")} numero="Qual delas" sub="o macaco fez?" tamanho={104} />
        <Rotulos de={w("lascas", "parecidas") + 0.3} ate={S("idade")} itens={[{ x: 330, y: 1120, texto: "ESQUERDA" }, { x: 750, y: 1120, texto: "DIREITA" }]} />
        <NumeroTopo de={w("idade", "piaui")} ate={w("idade", "cavaram")} numero="Piauí" tamanho={130} />
        <NumeroTopo de={w("idade", "mil") - 0.7} ate={w("idade", "essa")} numero={3000} contar sub="anos" />
        <NumeroTopo de={w("gaviao", "venenosa")} ate={w("gaviao", "o")} numero="venenosa" tamanho={120} corNumero="#FF6B5A" />
        <NumeroTopo de={w("gaviao", "cerca")} ate={w("gaviao", "se", 1)} numero="cerca e grita" tamanho={110} />
        <NumeroTopo de={w("gaviao", "nao")} ate={S("alarme")} numero="inofensiva" sub="vira comida" tamanho={110} />
        <NumeroTopo de={w("alarme", "grito")} ate={w("alarme", "um")} numero="alarme" tamanho={130} />
        <NumeroTopo de={w("virada", "confundir") - 0.3} ate={w("virada", "pedra")} numero="Dá pra confundir" tamanho={104} />
        <Rotulos de={w("virada", "confundir") - 0.1} ate={w("virada", "pedra")} itens={[{ x: 330, y: 1120, texto: "MACACO" }, { x: 750, y: 1120, texto: "HUMANO ANTIGO" }]} />
        <NumeroTopo de={w("virada", "coisa")} ate={w("virada", "voce")} numero="Só de gente?" tamanho={110} />
        <NumeroTopo de={w("final", "mil") - 0.7} ate={w("final", "voce", 1)} numero={3000} contar sub="anos" />
        {/* apelidos amarelos */}
        <ApelidoAmarelo de={w("marreta", "marreta")} ate={S("paquera")} texto="Marreta" />
        <ApelidoAmarelo de={w("correio", "correio")} ate={S("graveto")} texto="Correio elegante" tamanho={84} />
        <ApelidoAmarelo de={w("cotonete", "cotonete")} ate={S("lascas")} texto="Cotonete" />
        <ApelidoAmarelo de={w("idade", "idade")} ate={S("gaviao")} texto="Idade da pedra" tamanho={88} />
        <ApelidoAmarelo de={w("alarme", "grupo")} ate={S("virada")} texto="Grupo da família" tamanho={86} />
        <Legenda1Palavra palavras={WORDS} />
        <Sequence from={Math.round(OFF * FPS)} layout="none">
          <Audio src={staticFile("animal_macaco/narracao.wav")} />
          <Audio src={staticFile("animal_macaco/trilha.wav")} volume={0.9} />
        </Sequence>
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
