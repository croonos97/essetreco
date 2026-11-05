import { AbsoluteFill } from "remotion";
import type { Key } from "../engine/Camera";
import { Cam, Shot } from "../engine/Shot";
import { prog } from "../engine/timeline";
import type { Word } from "../engine/timeline";
import {
  ApelidoAmarelo,
  Cachorro,
  Camarao,
  CelularComentarios,
  Cientista1799,
  EntradaToca,
  FundoDoRio,
  fundoAltura,
  HumanoTranslucido,
  Larva,
  Legenda1Palavra,
  Marmitas,
  Minhoca,
  MUSEU_MESA,
  Museu1799,
  NumeroTopo,
  Ondinhas,
  Ornitorrinco,
  PontoDeVista,
  Respingos,
  Riacho,
  riachoAltura,
  rioZ,
  Seringa,
  TintaAgua,
  Toca,
  TOCA_CAMARA,
  useKitFont,
  Vitrine,
  VITRINE_TAMPO,
} from "../three/animais";

// =====================================================================
// AnimaisKitTest — vitrine de planos do KIT ANIMAIS (sem narração ainda).
// Cada plano mostra um traço do roteiro do ornitorrinco com o cenário e a câmera do formato.
// =====================================================================
type V3 = [number, number, number];
type Plan = { from: number; to: number; keys: Key[]; scene: (t: number) => React.ReactNode; shot?: { sun?: V3; sunPower?: number; ambient?: number; shadowSize?: number; exposure?: number } };

const RZ = rioZ(0);
const BANK: V3 = [0.6, 0, RZ - 6.4];
BANK[1] = riachoAltura(BANK[0], BANK[2]);
const HUM: V3 = [-1.2, 0, RZ - 8.5];
HUM[1] = riachoAltura(HUM[0], HUM[2]);
const ENT: V3 = [3, 0, RZ - 5.2]; // entrada da toca na margem
ENT[1] = riachoAltura(ENT[0], ENT[2]);
const W = (y: number) => y; // água em y = 0
const swimY = -0.16;
const PI = Math.PI;
const riacho = (t: number, livre: { x: number; z: number; r: number }[] = []) => <Riacho t={t} livre={livre} />;
const SUN_DAY: V3 = [6, 10, RZ + 4];
const F = (x: number, z: number, dy: number): V3 => [x, fundoAltura(x, z) + dy, z]; // ponto acima do fundo do rio

let T = 0;
const P = (dur: number, p: Omit<Plan, "from" | "to">): Plan => {
  const r = { from: T, to: T + dur, ...p };
  T += dur;
  return r;
};

const PLANS: Plan[] = [
  // 1. abertura no riacho (câmera já voando)
  P(2.4, {
    keys: [
      { t: 0, pos: [-4.5, 2.6, RZ + 5.0], look: [-0.2, 0, RZ], fov: 44 },
      { t: 2.4, pos: [-1.6, 0.75, RZ + 1.9], look: [0.4, 0.05, RZ], fov: 40 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: -3, z: RZ + 3.5, r: 3 }])}
        <Ornitorrinco t={t} nadar={1} position={[-1 + t * 0.35, swimY, RZ + Math.sin(t) * 0.1]} rotation={[0, PI / 2, 0]} />
        <Respingos t={t} forca={0.25} raio={0.3} position={[-0.6 + t * 0.35, 0, RZ]} />
      </>
    ),
  }),
  // 2. mergulho: fecha olhos, ouvidos e narinas
  P(2.2, {
    keys: [
      { t: 2.4, pos: [1.65, 0.3, RZ + 0.42], look: [0.3, 0.08, RZ], fov: 30 },
      { t: 4.6, pos: [1.45, 0.24, RZ + 0.3], look: [0.3, 0.04, RZ], fov: 28 },
    ],
    scene: (t) => (
      <>
        {riacho(t)}
        <Ornitorrinco
          t={t}
          boiar={0.6}
          fecharOlhos={prog(t, 2.9, 3.3)}
          fecharOuvidos={prog(t, 3.3, 3.7)}
          fecharNarinas={prog(t, 3.7, 4.1)}
          mergulhar={prog(t, 4.1, 4.6)}
          position={[0, swimY - prog(t, 4.1, 4.6) * 0.15, RZ]}
          rotation={[0, PI / 2, 0]}
        />
      </>
    ),
  }),
  // 3. ponto de vista escuro com pontinho
  P(1.6, {
    keys: [
      { t: 4.6, pos: [0, 0.35, 1.2], look: [0, 0.1, -1], fov: 50 },
      { t: 6.2, pos: [0, 0.3, 0.8], look: [0.2, 0.1, -1], fov: 48 },
    ],
    scene: (t) => <FundoDoRio t={t} luz={0.4} />,
  }),
  // 4. 40 mil sensores acendendo
  P(2.2, {
    keys: [
      { t: 6.2, pos: [0.6, F(0, 0.4, 0.75)[1], 1.6], look: F(0, 0.4, 0.3), fov: 34 },
      { t: 8.4, pos: [0.45, F(0, 0.4, 0.68)[1], 1.4], look: F(0, 0.42, 0.28), fov: 32 },
    ],
    scene: (t) => (
      <>
        <FundoDoRio t={t} livre={[{ x: 0, z: 0.5, r: 1.5 }]} />
        <Ornitorrinco t={t} nadar={0.35} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={prog(t, 6.4, 7.8)} position={F(0, 0, 0.12)} />
      </>
    ),
  }),
  // 5. humano translúcido: zero
  P(1.6, {
    keys: [
      { t: 8.4, pos: [HUM[0] + 0.4, HUM[1] + 2.4, HUM[2] + 6.2], look: [HUM[0], HUM[1] + 1.9, HUM[2]], fov: 42 },
      { t: 10, pos: [HUM[0] + 0.1, HUM[1] + 2.2, HUM[2] + 5.2], look: [HUM[0], HUM[1] + 1.9, HUM[2]], fov: 42 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: HUM[0], z: HUM[2], r: 2.5 }, { x: HUM[0], z: HUM[2] + 5.5, r: 2 }])}
        <HumanoTranslucido t={t} position={HUM} rotation={[0, 0.15, 0]} olhar={[0.2, 0]} />
      </>
    ),
  }),
  // 6. fundo do rio: presas soltando ondinhas amarelas
  P(2.0, {
    keys: [
      { t: 10, pos: [1.7, F(0.3, 0.2, 0.45)[1], 1.5], look: F(0.2, 0.2, 0.12), fov: 40 },
      { t: 12, pos: [1.3, F(0.3, 0.2, 0.38)[1], 1.15], look: F(0.3, 0.2, 0.1), fov: 38 },
    ],
    scene: (t) => (
      <>
        <FundoDoRio t={t} livre={[{ x: 0.3, z: 0, r: 1.6 }]} />
        <Camarao t={t} scale={2.2} position={F(0.75, 0.1, 0.1)} rotation={[0, -2.2, 0]} />
        <Ondinhas t={t} position={F(0.75, 0.1, 0.12)} alcance={0.32} />
        <Larva t={t} scale={2.2} position={F(0.25, 0.45, 0.03)} rotation={[0, 0.8, 0]} />
        <Ondinhas t={t + 0.4} position={F(0.25, 0.45, 0.05)} alcance={0.26} />
        <Minhoca t={t} scale={2} position={F(0.9, 0.6, 0.02)} rotation={[0, 1.2, 0]} />
        <Ornitorrinco t={t} nadar={0.5} balancar={1} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={1} position={F(-0.9, 0, 0.08)} rotation={[0, PI / 2, 0]} />
      </>
    ),
  }),
  // 7. vista de cima: cabeça varrendo o cascalho
  P(1.6, {
    keys: [
      { t: 12, pos: [0.1, F(0, 0, 2.3)[1], 0.05], look: F(0.1, 0, 0), fov: 40 },
      { t: 13.6, pos: [0.15, F(0, 0, 1.8)[1], 0.05], look: F(0.15, 0, 0), fov: 40 },
    ],
    scene: (t) => (
      <>
        <FundoDoRio t={t} />
        <Ornitorrinco t={t} nadar={0.4} balancar={1} fecharOlhos={1} position={F(-0.2 + (t - 12) * 0.1, 0, 0.02)} rotation={[0, PI / 2, 0]} />
      </>
    ),
  }),
  // 8. raio-x: boca sem dente (placas)
  P(1.6, {
    keys: [
      { t: 13.6, pos: [BANK[0] + 0.9, BANK[1] + 0.35, BANK[2] + 0.75], look: [BANK[0] + 0.15, BANK[1] + 0.2, BANK[2] + 0.4], fov: 32 },
      { t: 15.2, pos: [BANK[0] + 0.75, BANK[1] + 0.3, BANK[2] + 0.85], look: [BANK[0] + 0.1, BANK[1] + 0.2, BANK[2] + 0.45], fov: 30 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }])}
        <Ornitorrinco t={t} raiox={prog(t, 13.6, 14.1)} boca={0.4} position={BANK} />
      </>
    ),
  }),
  // 9. corpo enchendo 1/5 de amarelo
  P(1.8, {
    keys: [
      { t: 15.2, pos: [BANK[0] + 1.9, BANK[1] + 0.55, BANK[2] + 0.1], look: [BANK[0], BANK[1] + 0.18, BANK[2]], fov: 34 },
      { t: 17, pos: [BANK[0] + 1.6, BANK[1] + 0.5, BANK[2] + 0.4], look: [BANK[0], BANK[1] + 0.18, BANK[2]], fov: 34 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }, { x: BANK[0] + 1.8, z: BANK[2], r: 1 }])}
        <Ornitorrinco t={t} raiox={1} encher={prog(t, 15.5, 16.6) * 0.2} position={BANK} />
      </>
    ),
  }),
  // 10. humano e a pilha de marmitas
  P(1.8, {
    keys: [
      { t: 17, pos: [HUM[0] + 3.2, HUM[1] + 2.6, HUM[2] + 6.5], look: [HUM[0] + 1.2, HUM[1] + 1.4, HUM[2]], fov: 44 },
      { t: 18.8, pos: [HUM[0] + 2.4, HUM[1] + 2.2, HUM[2] + 5.6], look: [HUM[0] + 1.2, HUM[1] + 1.3, HUM[2]], fov: 44 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: HUM[0] + 1, z: HUM[2], r: 3 }, { x: HUM[0] + 2.5, z: HUM[2] + 6, r: 2 }])}
        <HumanoTranslucido t={t} position={HUM} rotation={[0, 0.5, 0]} estomago={1} encher={prog(t, 17.3, 18.6)} olhar={[0.5, 0.25]} />
        <Marmitas aparecer={prog(t, 17.1, 18.5)} position={[HUM[0] + 2.2, HUM[1], HUM[2] + 0.2]} rotation={[0, -0.3, 0]} />
      </>
    ),
  }),
  // 11. bochechas cheias, boiando e mastigando
  P(1.8, {
    keys: [
      { t: 18.8, pos: [0.95, 0.42, RZ + 0.95], look: [0.3, 0.1, RZ], fov: 34 },
      { t: 20.6, pos: [0.75, 0.35, RZ + 0.75], look: [0.3, 0.1, RZ], fov: 32 },
    ],
    scene: (t) => (
      <>
        {riacho(t)}
        <Ornitorrinco t={t} boiar={1} bochechas={1} mastigar={1} position={[0, swimY + 0.03, RZ]} rotation={[0, PI / 2 - 0.4, 0]} />
      </>
    ),
  }),
  // 12. esporão com gotinha de veneno
  P(1.6, {
    keys: [
      { t: 20.6, pos: [BANK[0] + 0.55, BANK[1] + 0.16, BANK[2] - 0.55], look: [BANK[0] + 0.2, BANK[1] + 0.07, BANK[2] - 0.28], fov: 28 },
      { t: 22.2, pos: [BANK[0] + 0.48, BANK[1] + 0.14, BANK[2] - 0.5], look: [BANK[0] + 0.2, BANK[1] + 0.06, BANK[2] - 0.28], fov: 26 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }])}
        <Ornitorrinco t={t} macho veneno={prog(t, 20.8, 21.8)} position={BANK} />
      </>
    ),
  }),
  // 13. cachorro fareja a toca e sai cambaleando
  P(2.0, {
    keys: [
      { t: 22.2, pos: [ENT[0] + 2.2, ENT[1] + 0.75, ENT[2] + 2.0], look: [ENT[0] + 0.2, ENT[1] + 0.35, ENT[2] + 0.8], fov: 38 },
      { t: 24.2, pos: [ENT[0] + 2.6, ENT[1] + 0.85, ENT[2] + 2.5], look: [ENT[0] + 0.9, ENT[1] + 0.35, ENT[2] + 1.2], fov: 40 },
    ],
    scene: (t) => {
      const go = prog(t, 23.0, 24.2);
      return (
        <>
          {riacho(t, [{ x: ENT[0], z: ENT[2], r: 2 }, { x: ENT[0] + 2.5, z: ENT[2] + 2.4, r: 1.5 }])}
          <EntradaToca position={[ENT[0], ENT[1] + 0.12, ENT[2] + 0.35]} rotation={[0.25, 0, 0]} scale={1.1} />
          <Cachorro t={t} farejar={1 - go} dor={go} cambalear={go} andar={go} position={[ENT[0] + 0.15 + go * 1.4, ENT[1], ENT[2] + 1.2 + go * 0.6]} rotation={[0, PI - 0.2 - go * 2.0, 0]} />
        </>
      );
    },
  }),
  // 14. humano: mão vermelha pulsando, morfina sem efeito
  P(1.8, {
    keys: [
      { t: 24.2, pos: [HUM[0] + 0.3, HUM[1] + 2.6, HUM[2] + 3.6], look: [HUM[0], HUM[1] + 2.3, HUM[2]], fov: 40 },
      { t: 26, pos: [HUM[0] + 0.1, HUM[1] + 2.5, HUM[2] + 3.0], look: [HUM[0], HUM[1] + 2.3, HUM[2]], fov: 40 },
    ],
    scene: (t) => (
      <>
        {riacho(t, [{ x: HUM[0], z: HUM[2], r: 2.5 }, { x: HUM[0], z: HUM[2] + 3.4, r: 1.5 }])}
        <HumanoTranslucido t={t} position={HUM} segurarMao={1} maoDor={1} olhar={[0, 0.35]} />
        <Seringa empurrar={prog(t, 24.8, 25.6)} position={[HUM[0] + 0.55, HUM[1] + 2.6, HUM[2] + 0.75]} rotation={[0.3, 0, 0.9]} scale={0.7} />
      </>
    ),
  }),
  // 15. dois machos brigando a chute na água
  P(1.8, {
    keys: [
      { t: 26, pos: [0.2, 0.8, RZ + 2.4], look: [0, 0, RZ], fov: 38 },
      { t: 27.8, pos: [-0.4, 0.6, RZ + 2.0], look: [0, 0, RZ], fov: 36 },
    ],
    scene: (t) => {
      const k = 0.5 + 0.5 * Math.sin(t * 9);
      return (
        <>
          {riacho(t)}
          <Ornitorrinco t={t} macho nadar={0.6} chutar={k} chutarLado="d" position={[-0.45, swimY, RZ + 0.05]} rotation={[0, 2.0, 0.2]} />
          <Ornitorrinco t={t + 0.3} macho nadar={0.6} chutar={1 - k} chutarLado="e" position={[0.45, swimY, RZ - 0.05]} rotation={[0, -1.15, -0.2]} />
          <Respingos t={t} forca={1} raio={0.6} position={[0, 0, RZ]} />
        </>
      );
    },
  }),
  // 16. corte do barranco: toca com a fêmea enrolada e os ovos
  P(2.0, {
    keys: [
      { t: 27.8, pos: [0, 1.2, 9], look: [0.5, 0.4, 0], fov: 46 },
      { t: 29.8, pos: [TOCA_CAMARA[0] - 0.3, TOCA_CAMARA[1] + 0.6, 3.4], look: [TOCA_CAMARA[0], TOCA_CAMARA[1] + 0.2, -0.2], fov: 36 },
    ],
    scene: (t) => (
      <>
        <Toca t={t} />
        <Ornitorrinco t={t} enrolar={1} ovos={2} position={TOCA_CAMARA} rotation={[0, -0.6, 0]} pelo={10} />
      </>
    ),
  }),
  // 17. leite brotando da pele e 2 filhotes lambendo
  P(1.8, {
    keys: [
      { t: 29.8, pos: [TOCA_CAMARA[0] + 0.1, TOCA_CAMARA[1] + 0.3, 1.5], look: [TOCA_CAMARA[0], TOCA_CAMARA[1] + 0.15, -0.2], fov: 32 },
      { t: 31.6, pos: [TOCA_CAMARA[0] - 0.1, TOCA_CAMARA[1] + 0.25, 1.25], look: [TOCA_CAMARA[0], TOCA_CAMARA[1] + 0.14, -0.2], fov: 30 },
    ],
    scene: (t) => (
      <>
        <Toca t={t} />
        <Ornitorrinco t={t} leite={prog(t, 30, 31)} position={[TOCA_CAMARA[0] - 0.1, TOCA_CAMARA[1] + 0.18, TOCA_CAMARA[2] - 0.1]} rotation={[0, 0.0, 1.5]} pelo={10} />
        {[0, 1].map((i) => (
          <Ornitorrinco key={i} t={t + i} filhote={1} cabeca={[0, 0.25 + 0.2 * Math.sin(t * 8 + i * 2)]} position={[TOCA_CAMARA[0] - 0.05 + i * 0.22, TOCA_CAMARA[1], TOCA_CAMARA[2] + 0.22]} rotation={[0, PI - 0.3 + i * 0.6, 0]} scale={0.32} />
        ))}
      </>
    ),
  }),
  // 18. 1799: cientista de peruca com lupa e tesoura, à luz de vela
  P(2.0, {
    keys: [
      { t: 31.6, pos: [2.6, 3.4, 4.2], look: [0, 2.0, 0], fov: 42 },
      { t: 33.6, pos: [1.6, 2.9, 3.0], look: [0, 1.9, 0], fov: 40 },
    ],
    shot: { ambient: 0.28, sunPower: 0.2, sun: [-3, 6, 4], shadowSize: 6 },
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Ornitorrinco t={t} pele={1} pelo={10} position={[0, MUSEU_MESA[1], 0.05]} rotation={[0, 0.4, 0]} scale={1.1} />
        <Cientista1799 t={t} lupa={prog(t, 32, 32.8)} cortar={prog(t, 32.6, 33.2)} inclinar={0.5} olhar={[0, 0.35]} position={[0.2, 0, -1.35]} />
      </>
    ),
  }),
  // 19. montagem: bico de pato + corpo peludo, costura tracejada vermelha
  P(1.8, {
    keys: [
      { t: 33.6, pos: [0.9, MUSEU_MESA[1] + 0.9, 1.6], look: [0, MUSEU_MESA[1] + 0.15, 0.2], fov: 36 },
      { t: 35.4, pos: [0.7, MUSEU_MESA[1] + 0.75, 1.3], look: [0, MUSEU_MESA[1] + 0.12, 0.25], fov: 34 },
    ],
    shot: { ambient: 0.32, sunPower: 0.25, sun: [-3, 6, 4], shadowSize: 4 },
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Ornitorrinco t={t} pele={1} pelo={10} bicoSolto={1 - prog(t, 33.8, 34.5)} costura={prog(t, 34.5, 35.3)} position={[0, MUSEU_MESA[1], 0]} rotation={[0, 0.5, 0]} />
      </>
    ),
  }),
  // 20. vitrine moderna: a pele com os cortinhos de tesoura
  P(1.8, {
    keys: [
      { t: 35.4, pos: [1.6, 3.2, 3.6], look: [0, VITRINE_TAMPO[1] + 0.2, 0], fov: 38 },
      { t: 37.2, pos: [0.6, 2.6, 1.9], look: [0, VITRINE_TAMPO[1] + 0.1, 0], fov: 34 },
    ],
    shot: { ambient: 0.9, sunPower: 1.2, sun: [2, 8, 4], shadowSize: 3 },
    scene: (t) => (
      <>
        <Vitrine t={t} />
        <Ornitorrinco t={t} pele={1} pelo={10} cortes={1} position={VITRINE_TAMPO} rotation={[0, 0.7, 0]} />
      </>
    ),
  }),
  // 21. celular com o vídeo e comentários "é IA"
  P(2.0, {
    keys: [
      { t: 37.2, pos: [0.3, 1.6, 4.6], look: [0, 1.5, 0], fov: 40 },
      { t: 39.2, pos: [0.1, 1.55, 3.9], look: [0, 1.5, 0], fov: 40 },
    ],
    scene: (t) => (
      <>
        {riacho(t)}
        <CelularComentarios t={t} abrir={prog(t, 37.4, 37.9)} mostrar={prog(t, 37.8, 39.0) * 6} position={[0, 1.5, 0]} rotation={[-0.05, 0.12, 0.03]} />
      </>
    ),
  }),
  // 22. final igual à abertura (órbita ampla)
  P(2.4, {
    keys: [
      { t: 39.2, pos: [3, 1.4, RZ + 4.5], look: [0.5, 0, RZ], fov: 44 },
      { t: 41.6, pos: [-5, 3.6, RZ + 7], look: [0.5, 0, RZ], fov: 48 },
    ],
    scene: (t) => (
      <>
        {riacho(t)}
        <Ornitorrinco t={t} nadar={1} position={[(t - 39.2) * 0.3, swimY, RZ]} rotation={[0, PI / 2, 0]} />
      </>
    ),
  }),
];
export const animaisKitTestDuration = (fps: number) => Math.ceil(T * fps);

// legenda de demonstração (1 palavra por vez, apelidos em amarelo) — trechos do roteiro v3
const DEMO =
  "Você é um ornitorrinco. Quando mergulha, fecha os olhos, os ouvidos e o nariz. E mesmo assim acha comida. Seu bico tem quarenta mil sensores. Um humano tem zero. Esse é seu DETECTOR DE METAIS. Você não tem dente. Come quase um quinto do seu peso. Essa é sua MARMITA. Tem veneno num esporão. Pode matar um cachorro. Nem morfina resolve. Esse é seu CANIVETE. Bota ovo e dá leite sem bico. Em 1799 acharam que você era pegadinha. Iam dizer que é IA. Você é um ornitorrinco.";
const WORDS: Word[] = (() => {
  const ws = DEMO.split(" ");
  const step = (T - 0.6) / ws.length;
  return ws.map((w, i) => ({ w: w.toLowerCase(), s: 0.2 + i * step, e: 0.2 + (i + 1) * step - 0.03, kw: /^[A-ZÁÉÍÓÚÃÕÇ]{3,}/.test(w.replace(/[.,]/g, "")) && w === w.toUpperCase() }));
})();
const at = (i: number) => PLANS[i].from;

export const AnimaisKitTest: React.FC = () => {
  useKitFont();
  return (
    <AbsoluteFill style={{ background: "#CFE6EF" }}>
      {PLANS.map((p, i) => (
        <Shot key={i} from={p.from} to={p.to} sun={p.shot?.sun ?? SUN_DAY} sunPower={p.shot?.sunPower ?? 2.5} ambient={p.shot?.ambient ?? 1.05} shadowSize={p.shot?.shadowSize ?? 6} exposure={p.shot?.exposure}>
          {(t) => (
            <>
              <Cam from={p.from} keys={p.keys} />
              {p.scene(t)}
            </>
          )}
        </Shot>
      ))}
      <TintaAgua de={at(3)} ate={at(8)} />
      <PontoDeVista de={at(2) + 0.05} ate={at(3)} pontos={[{ x: 640, y: 1060, de: at(2) + 0.4 }, { x: 380, y: 760, de: at(2) + 0.9, cor: "#56C8FF" }]} />
      <NumeroTopo de={at(3) + 0.4} ate={at(4)} numero={40000} contar sub="sensores no bico" />
      <NumeroTopo de={at(4) + 0.1} ate={at(5)} numero="0" sub="sensores" />
      <ApelidoAmarelo de={at(6) + 0.4} ate={at(7)} texto="Detector de metais" />
      <NumeroTopo de={at(7) + 0.3} ate={at(8)} numero="0" sub="dentes" />
      <NumeroTopo de={at(8) + 0.2} ate={at(9)} numero="1/5" sub="do peso por dia" />
      <NumeroTopo de={at(9) + 0.2} ate={at(10)} numero="14 kg" sub="por dia" />
      <ApelidoAmarelo de={at(10) + 0.3} ate={at(11)} texto="Marmita" />
      <ApelidoAmarelo de={at(11) + 0.8} ate={at(12)} texto="Canivete" />
      <ApelidoAmarelo de={at(12) + 0.2} ate={at(13)} texto="Mata um cachorro" tamanho={78} />
      <NumeroTopo de={at(13) + 0.2} ate={at(14)} numero="semanas" sub="de dor" tamanho={120} />
      <ApelidoAmarelo de={at(16) + 0.6} ate={at(17)} texto="Mamadeira sem bico" tamanho={80} />
      <NumeroTopo de={at(17) + 0.2} ate={at(18)} numero="1799" sub="Londres" />
      <Legenda1Palavra palavras={WORDS} />
    </AbsoluteFill>
  );
};
