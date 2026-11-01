import { AbsoluteFill, Audio, staticFile } from "remotion";
import * as THREE from "three";
import { dropGeo } from "../three/animais/comum";
import { plainMat, rockGeo } from "../three/animais/vegetacao";
const PEDRA_MAT = plainMat("#9A958A", { flatShading: true });
const GEO_SPH = new THREE.SphereGeometry(1, 20, 14);
import { CameraRig, Key } from "../engine/Camera";
import { Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import timelineJson from "../../public/ornitorrinco/timeline.json";
import {
  ApelidoAmarelo,
  Bacalhau,
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
  Ornitorrinco as Orni,
  Ovos,
  Respingos,
  Riacho,
  riachoAltura,
  rioZ,
  SalaUV,
  Seringa,
  TintaAgua,
  Toca,
  TOCA_CAMARA,
  useKitFont,
  Vitrine,
  VITRINE_TAMPO,
} from "../three/animais";

// =====================================================================
// "Você é um ornitorrinco" — formato @vocessaoanimais, montado com o KIT ANIMAIS.
// Cada plano é cravado numa palavra da narração (wordAt). O último quadro é igual ao primeiro
// (o plano final roda a mesma cena da abertura com tempo u = t − FIM, que vale 0 no último quadro).
// =====================================================================
const TL = timelineJson as Timeline;
const FPS = 30;
export const ornitorrincoDuration = (fps: number) => Math.ceil((TL.duration + 0.4) * fps);
const FIM = (ornitorrincoDuration(FPS) - 1) / FPS; // tempo do último quadro
const w = (c: string, word: string, n = 0) => wordAt(TL, c, word, n);
const S = (c: string) => cena(TL, c).start;
// atenção: wordAt ignora acento ("é" = "e", "dá" = "da"); por isso alguns cortes usam a palavra seguinte
const EMESMO = wordAt(TL, "gancho", "mesmo") - 0.1; // "E mesmo assim acha comida"
const ECHOCA = wordAt(TL, "ovo", "choca") - 0.04; // "e choca enrolada"
const VOCE_NAO = wordAt(TL, "final", "voce", 1); // "Você não é pegadinha"
const VOCE_FIM = wordAt(TL, "final", "voce", 2); // "Você é um ornitorrinco"
const NUM_HUMANO = wordAt(TL, "veneno", "num", 1);

type V3 = [number, number, number];
type Look = { sun?: V3; sunPower?: number; ambient?: number; shadowSize?: number; exposure?: number };
type Plan = { from: number; to: number; keys: Key[]; scene: (t: number) => React.ReactNode; look?: Look; agua?: boolean; drift?: number };

// ---------- lugares ----------
const PI = Math.PI;
const RZ = rioZ(0);
const swimY = -0.12;
const at = (x: number, z: number): V3 => [x, riachoAltura(x, z), z];
const BANK = at(0.6, RZ - 6.4);
const HUM = at(-1.2, RZ - 8.5);
const ENT = at(3, RZ - 5.2);
const F = (x: number, z: number, dy: number): V3 => [x, fundoAltura(x, z) + dy, z];
const TC = TOCA_CAMARA;
const COME = F(-0.25, 0, 0.06); // onde ele enche as bochechas no fundo
const add = (p: V3, d: V3): V3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];

const DAY: Look = { sun: [6, 10, RZ + 4], sunPower: 2.5, ambient: 1.05, shadowSize: 6 };
const WIDE: Look = { ...DAY, shadowSize: 12 };
const UNDER: Look = { sun: [2, 12, 3], sunPower: 1.6, ambient: 1.2, shadowSize: 5 };
const TOCA: Look = { sun: [3, 9, 8], sunPower: 2.3, ambient: 1.0, shadowSize: 7 };
const NIGHT: Look = { sun: [-3, 6, 4], sunPower: 0.2, ambient: 0.28, shadowSize: 6 };
const MODERN: Look = { sun: [2, 8, 4], sunPower: 1.2, ambient: 0.9, shadowSize: 3 };

const riacho = (t: number, livre: { x: number; z: number; r: number }[] = []) => <Riacho t={t} livre={livre} />;

// ---------- abertura (= final) em função de u ----------
// bicho inteiro de pé na beira d'água, de 3/4, virando a cabeça para a câmera (que está sobre a água)
// pedra chata na beira d'água (o barranco é íngreme): o bicho fica em cima, a água na frente
const PEDRA: V3 = [-0.9, -0.07, RZ - 4.42];
const ABRE: V3 = [PEDRA[0], 0.115, PEDRA[2]];
const ABRE_CAM: V3 = add(ABRE, [2.25, 0.26, 0.8]);
const ABRE_YAW = Math.atan2(ABRE_CAM[0] - ABRE[0], ABRE_CAM[2] - ABRE[2]) - 0.95; // de 3/4: bico à esquerda, rabo de castor à direita
const ABRE_KEYS = (t0: number): Key[] => [
  { t: t0, pos: ABRE_CAM, look: add(ABRE, [0.02, 0.24, 0.02]), fov: 36 },
  { t: t0 + 1.68, pos: add(ABRE, [1.95, 0.24, 0.7]), look: add(ABRE, [0.02, 0.22, 0.02]), fov: 34 },
];
const Abertura: React.FC<{ u: number }> = ({ u }) => (
  <>
    {riacho(u, [{ x: ABRE[0], z: ABRE[2], r: 1.0 }, { x: ABRE[0] + 1.6, z: ABRE[2] + 0.6, r: 1.2 }])}
    <mesh geometry={rockGeo()} material={PEDRA_MAT} position={PEDRA} scale={[0.62, 0.32, 0.5]} rotation={[0, 0.4, 0]} castShadow receiveShadow />
    <Orni t={u} cabeca={[0.55 + Math.sin(u * 1.7) * 0.08, -0.08 + Math.sin(u * 2.3) * 0.04]} position={ABRE} rotation={[0, ABRE_YAW, 0]} />
  </>
);

// ---------- cenas reaproveitadas (gancho e recapitulação final) ----------
const caçaDeOlhoFechado = (t: number, sweep: number) => (
  <>
    <FundoDoRio t={t} livre={[{ x: 0, z: 0.4, r: 1.6 }]} />
    <Orni t={t} nadar={0.35} balancar={sweep} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={1} brilhoBico={0.3} position={F(0, 0, 0.12)} rotation={[0, 0.5, 0]} />
    <Camarao t={t} scale={2} position={F(0.55, 0.75, 0.1)} rotation={[0, 2.4, 0]} />
    <Ondinhas t={t} position={F(0.55, 0.75, 0.12)} alcance={0.45} />
  </>
);
const bochechasNaSuperficie = (t: number, mastigar: number) => (
  <>
    {riacho(t)}
    <Orni t={t} boiar={1} bochechas={1} mastigar={mastigar} position={[0, swimY + 0.03, RZ]} rotation={[0, PI / 2 - 0.4, 0]} />
  </>
);
const esporaoClose = (t: number, glow: number) => (
  <>
    {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }])}
    <Orni t={t} macho veneno={1} brilhoEsporao={glow} position={BANK} />
  </>
);
const ESP_KEYS = (a: number, b: number): Key[] => [
  { t: a, pos: add(BANK, [0.85, 0.22, -0.85]), look: add(BANK, [0.22, 0.06, -0.3]), fov: 30 },
  { t: b, pos: add(BANK, [0.7, 0.18, -0.72]), look: add(BANK, [0.22, 0.05, -0.3]), fov: 28 },
];
// mãe deitada de lado com a barriga para a câmera. MAE = centro do corpo.
// Grupos aninhados: Rx(−90°) põe a barriga para +z (nariz para cima); Rz(+90°) deita (nariz para −x).
// A origem do bicho fica 0,18 à frente do centro do corpo (altura do corpo de pé).
// Deitada, a seção do corpo no plano y–z é uma elipse: meia-altura 0,232 (largura do corpo) e barriga 0,115.
const MAE: V3 = [TC[0] + 0.05, TC[1] + 0.2, -0.2];
const BARRIGA = (dx: number, dy: number, sobre = 0.016): V3 => {
  const k = Math.max(0, 1 - Math.pow(dy / 0.232, 2));
  return [MAE[0] + dx, MAE[1] + dy, MAE[2] + 0.115 * Math.pow(k, 0.5) + sobre];
};
const MANCHAS = [-0.075, 0.075]; // onde o leite brota (ao longo do corpo, em x)
const FILHOTE = (i: number): V3 => [MAE[0] + MANCHAS[i] + (i ? 0.03 : -0.03), TC[1], BARRIGA(0, -0.12)[2] + 0.075];
const milkMat = new THREE.MeshStandardMaterial({ color: "#FFFDF4", roughness: 0.1 });
const manchaMat = new THREE.MeshStandardMaterial({ color: "#B89070", roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false });
const Leite: React.FC<{ t: number; leite: number }> = ({ t, leite }) => (
  <>
    {MANCHAS.map((dx, i) => (
      <group key={i}>
        {/* mancha sutil na barriga */}
        <mesh geometry={GEO_SPH} material={manchaMat} position={BARRIGA(dx, 0.0, 0.014)} scale={[0.022, 0.018, 0.004]} />
        {/* gotinhas: nascem na mancha, crescem e escorrem pelo pelo para baixo */}
        {[0, 1, 2].map((j) => {
          const ph = (t * 0.55 + j / 3 + i * 0.17) % 1;
          const grow = Math.min(1, ph / 0.35) * leite;
          const desce = Math.max(0, (ph - 0.35) / 0.65);
          if (grow <= 0.02) return null;
          const p = BARRIGA(dx + (j - 1) * 0.012, 0.0 - desce * 0.1, 0.02);
          return <mesh key={j} geometry={dropGeo()} material={milkMat} position={p} rotation={[Math.PI, 0, 0]} scale={[0.0065 * grow, 0.0065 * grow * (1 + desce * 0.8), 0.0065 * grow]} />;
        })}
      </group>
    ))}
  </>
);
const maeEFilhotes = (t: number, leite: number) => (
  <>
    <Toca t={t} tampoes={1} />
    <group position={[MAE[0], MAE[1], MAE[2] + 0.18]} rotation={[0, 0, PI / 2]}>
      <Orni t={t} mae deitada={1} cabeca={[0, -0.15]} rotation={[-PI / 2, 0, 0]} pelo={10} />
    </group>
    {leite > 0 ? <Leite t={t} leite={leite} /> : null}
    {[0, 1].map((i) => (
      <Orni key={i} t={t + i} filhote={1} cabeca={[0, -0.35 + 0.12 * Math.sin(t * 7 + i * 2)]} position={FILHOTE(i)} rotation={[0, PI + (i ? -0.3 : 0.3), 0]} scale={0.25} />
    ))}
  </>
);
const ovosClose = (t: number, pop: number) => (
  <>
    <Toca t={t} />
    <Ovos t={t} balancar={0.3} position={[TC[0], TC[1], TC[2] + 0.05]} scale={1.15 * Math.max(0.001, pop)} />
  </>
);
const OVOS_KEYS = (a: number, b: number): Key[] => [
  { t: a, pos: [TC[0] + 0.12, TC[1] + 0.2, TC[2] + 0.55], look: [TC[0], TC[1] + 0.04, TC[2] + 0.05], fov: 30 },
  { t: b, pos: [TC[0] + 0.05, TC[1] + 0.16, TC[2] + 0.42], look: [TC[0], TC[1] + 0.04, TC[2] + 0.05], fov: 28 },
];

// ---------- veneno: o cachorro abocanha o traseiro e leva a espetada (sem sangue, sem morte) ----------
// Cachorro escala 0,7, de frente para −x; inclina o corpo 0,4 rad no bote para o focinho encostar no flanco de trás
// (≈ 0,27 de altura, logo acima da pata com o esporão). Focinho ≈ 0,70 à frente da origem dele nessa pose.
const ESPETA = w("veneno", "espetada");
const cachorroEspetado = (t: number) => {
  const chega = prog(t, w("veneno", "cachorro") - 0.3, w("veneno", "morde") - 0.05);
  const bote = prog(t, w("veneno", "morde") - 0.15, w("veneno", "morde") + 0.1) * (1 - prog(t, ESPETA + 0.32, ESPETA + 0.45));
  const pica = prog(t, ESPETA - 0.12, ESPETA + 0.02);
  const recua = prog(t, ESPETA + 0.36, NUM_HUMANO + 0.4);
  const foge = prog(t, ESPETA + 0.25, NUM_HUMANO + 0.6);
  const chute = prog(t, ESPETA - 0.15, ESPETA) * (1 - prog(t, ESPETA + 0.35, ESPETA + 0.55));
  const dx = 0.88 + (1 - chega) * 1.5 + recua * 0.42;
  const pp = add(BANK, [0, 0, foge * 0.45]);
  pp[1] = riachoAltura(pp[0], pp[2]);
  return (
    <>
      {riacho(t, [{ x: BANK[0] + 1, z: BANK[2], r: 2.2 }, { x: BANK[0] + 0.9, z: BANK[2] + 2.4, r: 1.2 }])}
      <Orni t={t} macho andar={foge} chutar={chute} chutarLado="d" veneno={pica} brilhoEsporao={pica * (1 - recua * 0.5)} position={pp} rotation={[0, 0.2 * foge, 0]} />
      <group position={add(BANK, [dx, 0, -0.2 - recua * 0.15])} rotation={[0, -PI / 2 + recua * 0.6, 0]}>
        <group rotation={[0.4 * bote, 0, 0]}>
          <Cachorro t={t} andar={chega < 1 ? 1 : recua * 0.6} farejar={1 - recua} morder={bote * (1 - pica * 0.5)} dor={Math.max(pica, recua)} scale={0.7} />
        </group>
      </group>
    </>
  );
};
const humanoDor = (t: number) => (
  <>
    {riacho(t, [{ x: HUM[0], z: HUM[2], r: 2.5 }, { x: HUM[0], z: HUM[2] + 3.4, r: 1.5 }])}
    <HumanoTranslucido t={t} position={HUM} segurarMao={1} maoDor={prog(t, w("veneno", "dor"), w("veneno", "dor") + 0.4)} olhar={[0, 0.35]} />
    {t > w("veneno", "nem") - 0.3 ? (
      <Seringa empurrar={prog(t, w("veneno", "morfina"), w("veneno", "resolve"))} position={add(HUM, [0.5, 2.45, 0.95])} rotation={[0.3, 0, 1.25]} scale={0.45 * prog(t, w("veneno", "nem") - 0.3, w("veneno", "nem"))} />
    ) : null}
  </>
);

// ---------- luz negra: o pelo brilha verde-azulado ----------
const UV_ON = w("uv", "luz");
const salaUV = (t: number, flash = 0, rot = 0.5) => {
  const luz = flash || 0.22 + 0.78 * prog(t, UV_ON - 0.1, UV_ON + 0.3); // nunca preto total: silhueta roxa antes de acender
  return (
    <>
      <SalaUV t={t} luz={luz} pulso={flash ? 0 : prog(t, w("uv", "esse") - 0.2, w("uv", "esse"))} />
      <Orni t={t} brilhoUV={luz} cabeca={[Math.sin(t * 1.3) * 0.15, -0.05]} position={[0, 0, 0]} rotation={[0, rot, 0]} />
    </>
  );
};

// direção da descida no "cego e surdo" (o bacalhau segue o mesmo caminho, atrás)
const DIVE = (() => {
  const l = Math.hypot(1.2, 1.3);
  return [1.2 / l, -1.3 / l] as const;
})();
const DIVE_PITCH = Math.atan2(1.3, 1.2);

// ---------- planos ----------
const P = (from: number, to: number, p: Omit<Plan, "from" | "to">): Plan => ({ from, to, ...p });
const PLANS: Plan[] = [
  // ======== GANCHO ========
  // 1. abertura no riacho, câmera já voando
  P(0, w("gancho", "mergulha"), { keys: ABRE_KEYS(0), look: DAY, drift: 0, scene: (t) => <Abertura u={t} /> }),
  // 2. close extremo do rosto: fecha olhos, ouvidos e narinas, e mergulha
  P(w("gancho", "mergulha"), w("gancho", "fica"), {
    keys: [
      { t: w("gancho", "mergulha"), pos: [1.3, 0.24, RZ + 0.4], look: [0.3, 0.1, RZ], fov: 30 },
      { t: w("gancho", "fica"), pos: [1.0, 0.17, RZ + 0.26], look: [0.3, 0.05, RZ], fov: 26 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t)}
        <Orni
          t={t}
          boiar={0.6}
          fecharOlhos={prog(t, w("gancho", "olhos"), w("gancho", "olhos") + 0.4)}
          fecharOuvidos={prog(t, w("gancho", "ouvidos"), w("gancho", "ouvidos") + 0.4)}
          fecharNarinas={prog(t, w("gancho", "nariz"), w("gancho", "nariz") + 0.35)}
          mergulhar={prog(t, w("gancho", "nariz") + 0.3, w("gancho", "fica"))}
          position={[0, swimY - prog(t, w("gancho", "nariz") + 0.3, w("gancho", "fica")) * 0.12, RZ]}
          rotation={[0, PI / 2, 0]}
        />
      </>
    ),
  }),
  // 3. descendo no escuro: fica cego e surdo
  P(w("gancho", "fica"), EMESMO, {
    agua: true,
    keys: [
      { t: w("gancho", "fica"), pos: [-1.1 + 0.2, 2.5 + 0.1, 3.4], look: [-1.1, 2.5, -0.1], fov: 46 },
      { t: EMESMO, pos: [0.08 + 0.2, 1.2 + 0.1, 3.3], look: [0.08, 1.2, -0.1], fov: 46 },
    ],
    look: { ...UNDER, sunPower: 0.8, ambient: 0.7 },
    scene: (t) => {
      const k = prog(t, w("gancho", "fica"), EMESMO);
      return (
        <>
          <FundoDoRio t={t} luz={0.6} />
          <Orni t={t} nadar={1} mergulhar={1} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} position={[-0.8 + k * 1.2, 2.1 - k * 1.3, 0]} rotation={[0, PI / 2, 0]} />
          {/* bacalhau-do-murray ~2,5× o bicho, logo atrás e no mesmo nível, seguindo a descida (ele não vê) */}
          <group position={[-0.8 + k * 1.2 - DIVE[0] * (2.25 - k * 0.6), 2.1 - k * 1.3 - DIVE[1] * (2.25 - k * 0.6) + 0.05, -0.25]} rotation={[0, PI / 2, 0]}>
            <group rotation={[DIVE_PITCH, 0, 0]}>
              <Bacalhau t={t} boca={0.2 + 0.7 * prog(t, w("gancho", "surdo") - 0.35, w("gancho", "surdo"))} scale={1.05} />
            </group>
          </group>
        </>
      );
    },
  }),
  // 4. e mesmo assim acha comida: fundo azul-escuro legível, olhos fechados, bico varrendo, presas pulsando amarelo
  P(EMESMO, S("sensores"), {
    agua: true,
    keys: [
      { t: EMESMO, pos: [-1.05, F(0, 0.4, 0.62)[1], 1.55], look: F(0.15, 0.4, 0.18), fov: 38 },
      { t: S("sensores"), pos: [-0.75, F(0, 0.4, 0.55)[1], 1.4], look: F(0.2, 0.4, 0.18), fov: 35 },
    ],
    look: { ...UNDER, sunPower: 1.0, ambient: 0.85 },
    scene: (t) => (
      <>
        <FundoDoRio t={t} luz={0.7} livre={[{ x: 0, z: 0.4, r: 1.6 }]} />
        <Orni t={t} nadar={0.35} balancar={1} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={0.4} brilhoBico={0.25} position={F(0, 0, 0.12)} rotation={[0, 0.5, 0]} />
        <Camarao t={t} scale={2} position={F(0.55, 0.75, 0.1)} rotation={[0, 2.4, 0]} />
        <Ondinhas t={t} intensidade={prog(t, w("gancho", "acha") - 0.1, w("gancho", "acha") + 0.15)} position={F(0.55, 0.75, 0.12)} alcance={0.45} />
        <Larva t={t} scale={2} position={F(-0.35, 0.85, 0.03)} rotation={[0, 0.6, 0]} />
        <Ondinhas t={t + 0.5} intensidade={prog(t, w("gancho", "comida") - 0.1, w("gancho", "comida") + 0.15)} position={F(-0.35, 0.85, 0.05)} alcance={0.35} />
      </>
    ),
  }),
  // ======== SENSORES ========
  // 5. 40 mil sensores acendendo no bico
  P(S("sensores"), w("sensores", "um"), {
    agua: true,
    keys: [
      { t: S("sensores"), pos: [0.75, F(0, 0.4, 0.8)[1], 1.75], look: F(0, 0.4, 0.3), fov: 36 },
      { t: w("sensores", "um"), pos: [0.42, F(0, 0.4, 0.66)[1], 1.3], look: F(0, 0.42, 0.28), fov: 30 },
    ],
    look: UNDER,
    scene: (t) => (
      <>
        <FundoDoRio t={t} livre={[{ x: 0, z: 0.5, r: 1.5 }]} />
        <Orni t={t} nadar={0.35} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={prog(t, w("sensores", "quarenta"), w("sensores", "eletricidade") + 0.4)} position={F(0, 0, 0.12)} />
      </>
    ),
  }),
  // 6. humano translúcido: zero
  P(w("sensores", "um"), S("detector"), {
    keys: [
      { t: w("sensores", "um"), pos: add(HUM, [0.4, 2.4, 6.2]), look: add(HUM, [0, 1.9, 0]), fov: 42 },
      { t: S("detector"), pos: add(HUM, [0.1, 2.2, 5.0]), look: add(HUM, [0, 1.9, 0]), fov: 42 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: HUM[0], z: HUM[2], r: 2.5 }, { x: HUM[0], z: HUM[2] + 5.5, r: 2 }])}
        <HumanoTranslucido t={t} position={HUM} rotation={[0, 0.15, 0]} olhar={[0.2, 0]} vermelho={prog(t, w("sensores", "zero") - 0.1, w("sensores", "zero") + 0.25)} />
      </>
    ),
  }),
  // ======== DETECTOR ========
  // 7. fundo do rio: bichos se mexem e soltam ondinhas amarelas
  P(S("detector"), w("detector", "e"), {
    agua: true,
    keys: [
      { t: S("detector"), pos: [0.75, F(0.6, 0.3, 0.42)[1], 1.45], look: F(0.6, 0.3, 0.1), fov: 34 },
      { t: w("detector", "e"), pos: [0.6, F(0.6, 0.3, 0.34)[1], 1.15], look: F(0.6, 0.3, 0.08), fov: 32 },
    ],
    look: UNDER,
    scene: (t) => {
      const on = prog(t, w("detector", "sinalzinho") - 0.05, w("detector", "sinalzinho") + 0.12);
      return (
        <>
          <FundoDoRio t={t} livre={[{ x: 0.3, z: 0.2, r: 1.6 }]} />
          <Camarao t={t} scale={2.2} position={F(0.75, 0.1, 0.1)} rotation={[0, -2.2, 0]} />
          <Ondinhas t={t} intensidade={on} position={F(0.75, 0.1, 0.12)} alcance={0.32} />
          <Larva t={t} scale={2.2} position={F(0.25, 0.45, 0.03)} rotation={[0, 0.8, 0]} />
          <Ondinhas t={t + 0.4} intensidade={on} position={F(0.25, 0.45, 0.05)} alcance={0.26} />
          <Minhoca t={t} scale={2} position={F(0.9, 0.6, 0.02)} rotation={[0, 1.2, 0]} />
          <Ondinhas t={t + 0.7} intensidade={on} position={F(0.9, 0.6, 0.04)} alcance={0.22} />
        </>
      );
    },
  }),
  // 8. e você sente: ondinhas chegam no bico e os sensores piscam
  P(w("detector", "e"), w("detector", "por"), {
    agua: true,
    keys: [
      { t: w("detector", "e"), pos: [0.25, F(0.2, 0, 0.32)[1], 1.15], look: F(0.25, 0, 0.12), fov: 36 },
      { t: w("detector", "por"), pos: [0.2, F(0.2, 0, 0.28)[1], 0.95], look: F(0.25, 0, 0.12), fov: 34 },
    ],
    look: UNDER,
    scene: (t) => (
      <>
        <FundoDoRio t={t} livre={[{ x: 0, z: 0, r: 1.4 }]} />
        <Orni t={t} nadar={0.3} fecharOlhos={1} fecharOuvidos={1} fecharNarinas={1} sensores={1} brilhoBico={0.5 + 0.5 * Math.sin(t * 12)} position={F(-0.45, 0, 0.1)} rotation={[0, PI / 2, 0]} />
        <Camarao t={t} scale={2} position={F(0.65, 0.05, 0.08)} rotation={[0, -1.4, 0]} />
        <Ondinhas t={t} position={F(0.65, 0.05, 0.1)} alcance={0.85} periodo={0.8} />
      </>
    ),
  }),
  // 9. de cima: caça balançando a cabeça, varrendo o cascalho
  P(w("detector", "por"), w("detector", "esse"), {
    agua: true,
    keys: [
      { t: w("detector", "por"), pos: [0.1, F(0, 0, 2.3)[1], 0.05], look: F(0.1, 0, 0), fov: 40 },
      { t: w("detector", "esse"), pos: [0.2, F(0, 0, 1.7)[1], 0.05], look: F(0.2, 0, 0), fov: 40 },
    ],
    look: UNDER,
    scene: (t) => (
      <>
        <FundoDoRio t={t} />
        <Orni t={t} nadar={0.4} balancar={prog(t, w("detector", "balancando") - 0.2, w("detector", "balancando") + 0.2)} fecharOlhos={1} sensores={1} position={F(-0.25 + (t - w("detector", "por")) * 0.12, 0, 0.02)} rotation={[0, PI / 2, 0]} />
      </>
    ),
  }),
  // 10. herói: esse é seu detector de metais
  P(w("detector", "esse"), S("dente"), {
    agua: true,
    keys: [
      { t: w("detector", "esse"), pos: [1.35, F(0, 0.4, 0.55)[1], 1.75], look: F(0.2, 0.4, 0.22), fov: 36 },
      { t: S("dente"), pos: [0.35, F(0, 0.4, 0.5)[1], 2.0], look: F(0.2, 0.4, 0.22), fov: 34 },
    ],
    look: UNDER,
    scene: (t) => caçaDeOlhoFechado(t, 0.6),
  }),
  // ======== DENTE ========
  // 11. raio-x: boca sem dente (só placas)
  P(S("dente"), w("dente", "e"), {
    keys: [
      { t: S("dente"), pos: add(BANK, [0.95, 0.38, 0.8]), look: add(BANK, [0.15, 0.2, 0.4]), fov: 32 },
      { t: w("dente", "e"), pos: add(BANK, [0.75, 0.3, 0.85]), look: add(BANK, [0.1, 0.2, 0.45]), fov: 29 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }])}
        <Orni t={t} raiox={prog(t, S("dente") + 0.05, S("dente") + 0.3)} boca={prog(t, w("dente", "dente"), w("dente", "dente") + 0.3) * 0.6} position={BANK} />
      </>
    ),
  }),
  // 12. corpo enchendo 1/5 de amarelo
  P(w("dente", "e"), w("dente", "uma"), {
    keys: [
      { t: w("dente", "e"), pos: add(BANK, [1.9, 0.55, 0.1]), look: add(BANK, [0, 0.18, 0]), fov: 34 },
      { t: w("dente", "uma"), pos: add(BANK, [1.55, 0.48, 0.45]), look: add(BANK, [0, 0.18, 0]), fov: 34 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }, { x: BANK[0] + 1.8, z: BANK[2], r: 1 }])}
        <Orni t={t} raiox={1} encher={prog(t, w("dente", "quinto") - 0.2, w("dente", "peso") + 0.3) * 0.2} position={BANK} />
      </>
    ),
  }),
  // 13. pessoa de 70 kg diante de 14 kg de marmitas
  P(w("dente", "uma"), S("marmita"), {
    keys: [
      { t: w("dente", "uma"), pos: add(HUM, [3.2, 2.6, 6.5]), look: add(HUM, [1.2, 1.4, 0]), fov: 44 },
      { t: S("marmita"), pos: add(HUM, [2.4, 2.2, 5.4]), look: add(HUM, [1.2, 1.3, 0]), fov: 44 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: HUM[0] + 1, z: HUM[2], r: 3 }, { x: HUM[0] + 2.5, z: HUM[2] + 6, r: 2 }])}
        <HumanoTranslucido t={t} position={HUM} rotation={[0, 0.5, 0]} estomago={1} encher={prog(t, w("dente", "comendo"), w("dente", "catorze") + 0.6)} olhar={[0.5, 0.25]} />
        <Marmitas aparecer={prog(t, w("dente", "comendo") - 0.2, w("dente", "catorze") + 0.5)} position={add(HUM, [2.2, 0, 0.2])} rotation={[0, -0.3, 0]} />
      </>
    ),
  }),
  // ======== MARMITA ========
  // 14. no fundo: enche as bochechas de bicho
  P(S("marmita"), w("marmita", "mastiga"), {
    agua: true,
    keys: [
      { t: S("marmita"), pos: add(COME, [1.15, 0.32, 1.55]), look: add(COME, [0.35, 0.16, 0]), fov: 34 },
      { t: w("marmita", "mastiga"), pos: add(COME, [1.0, 0.28, 1.35]), look: add(COME, [0.38, 0.16, 0]), fov: 32 },
    ],
    look: UNDER,
    scene: (t) => {
      const eat = prog(t, w("marmita", "bochechas") - 0.2, w("marmita", "bicho") + 0.2);
      return (
        <>
          <FundoDoRio t={t} livre={[{ x: 0, z: 0, r: 1.4 }]} />
          <Orni t={t} nadar={0.3} fecharOlhos={1} bochechas={eat} boca={0.3 * (1 - eat)} position={COME} rotation={[0, PI / 2, 0]} />
          {eat < 0.95 ? <Larva t={t} scale={2 * (1 - eat)} position={F(0.55 - eat * 0.1, 0.02, 0.03)} rotation={[0, 1.6, 0]} /> : null}
          {eat < 0.95 ? <Camarao t={t} scale={2 * (1 - eat)} position={F(0.62 - eat * 0.1, -0.08, 0.08)} rotation={[0, -1.3, 0]} /> : null}
        </>
      );
    },
  }),
  // 15. boiando, mastigando na superfície
  P(w("marmita", "mastiga"), w("marmita", "com"), {
    keys: [
      { t: w("marmita", "mastiga"), pos: [0.95, 0.42, RZ + 0.95], look: [0.3, 0.1, RZ], fov: 34 },
      { t: w("marmita", "com"), pos: [0.75, 0.35, RZ + 0.75], look: [0.3, 0.1, RZ], fov: 32 },
    ],
    look: DAY,
    scene: (t) => bochechasNaSuperficie(t, 1),
  }),
  // 16. raio-x do bicho inteiro, de perfil na margem: no lugar dos dentes, placas duras (claras) mastigando
  P(w("marmita", "com"), w("marmita", "essa"), {
    keys: [
      { t: w("marmita", "com"), pos: add(BANK, [1.55, 0.55, 1.3]), look: add(BANK, [-0.08, 0.15, 0.22]), fov: 38 },
      { t: w("marmita", "essa"), pos: add(BANK, [1.35, 0.48, 1.25]), look: add(BANK, [-0.08, 0.15, 0.24]), fov: 36 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }, { x: BANK[0] + 1.6, z: BANK[2] + 0.8, r: 1 }])}
        <Orni t={t} raiox={1} mastigar={1} bochechas={0.5} position={BANK} rotation={[0, -0.31, 0]} />
      </>
    ),
  }),
  // 17. herói: essa é sua marmita
  P(w("marmita", "essa"), S("veneno"), {
    keys: [
      { t: w("marmita", "essa"), pos: [0.2, 0.5, RZ + 1.3], look: [0.25, 0.1, RZ], fov: 36 },
      { t: S("veneno"), pos: [1.1, 0.45, RZ + 1.0], look: [0.25, 0.1, RZ], fov: 34 },
    ],
    look: DAY,
    scene: (t) => bochechasNaSuperficie(t, 0.4),
  }),
  // ======== VENENO ========
  // 18. macho na margem → close do esporão com a gotinha
  P(S("veneno"), w("veneno", "cachorro"), {
    keys: [
      { t: S("veneno"), pos: add(BANK, [1.4, 0.55, 0.9]), look: add(BANK, [0, 0.18, 0]), fov: 38 },
      { t: w("veneno", "esporao") - 0.2, pos: add(BANK, [1.1, 0.32, -0.45]), look: add(BANK, [0.18, 0.08, -0.28]), fov: 32 },
      { t: w("veneno", "cachorro"), pos: add(BANK, [0.72, 0.18, -0.72]), look: add(BANK, [0.22, 0.05, -0.3]), fov: 28 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.5 }])}
        <Orni t={t} macho veneno={prog(t, w("veneno", "veneno"), w("veneno", "esporao") + 0.6)} brilhoEsporao={prog(t, w("veneno", "esporao"), w("veneno", "esporao") + 0.3)} position={BANK} />
      </>
    ),
  }),
  // 19. cachorro (vira-lata de coleira) chega e abocanha o traseiro dele...
  P(w("veneno", "cachorro"), w("veneno", "leva"), {
    keys: [
      { t: w("veneno", "cachorro"), pos: add(BANK, [2.3, 0.75, 1.85]), look: add(BANK, [0.55, 0.24, -0.2]), fov: 42 },
      { t: w("veneno", "leva"), pos: add(BANK, [1.75, 0.55, 1.45]), look: add(BANK, [0.4, 0.22, -0.2]), fov: 40 },
    ],
    look: DAY,
    scene: (t) => cachorroEspetado(t),
  }),
  P(w("veneno", "leva"), ESPETA - 0.02, {
    keys: [
      { t: w("veneno", "leva"), pos: add(BANK, [1.4, 0.45, 1.1]), look: add(BANK, [0.3, 0.2, -0.22]), fov: 36 },
      { t: ESPETA, pos: add(BANK, [1.25, 0.42, 0.98]), look: add(BANK, [0.3, 0.2, -0.22]), fov: 34 },
    ],
    look: DAY,
    scene: (t) => cachorroEspetado(t),
  }),
  // insert de 0,4 s: a pata de trás crava o esporão no focinho
  P(ESPETA - 0.02, ESPETA + 0.38, {
    keys: [
      { t: ESPETA - 0.02, pos: add(BANK, [0.85, 0.26, 0.42]), look: add(BANK, [0.25, 0.18, -0.22]), fov: 30 },
      { t: ESPETA + 0.38, pos: add(BANK, [0.8, 0.26, 0.38]), look: add(BANK, [0.25, 0.18, -0.22]), fov: 28 },
    ],
    look: DAY,
    drift: 0,
    scene: (t) => cachorroEspetado(t),
  }),
  // ...e o plano aberto com os dois: o cachorro recua ganindo, o ornitorrinco vai para a água
  P(ESPETA + 0.38, NUM_HUMANO, {
    keys: [
      { t: ESPETA + 0.38, pos: add(BANK, [2.3, 0.7, 1.95]), look: add(BANK, [0.6, 0.24, 0.0]), fov: 42 },
      { t: NUM_HUMANO, pos: add(BANK, [2.45, 0.75, 2.1]), look: add(BANK, [0.65, 0.24, 0.05]), fov: 43 },
    ],
    look: DAY,
    scene: (t) => cachorroEspetado(t),
  }),
  // 20. num humano: mão vermelha pulsando...
  P(NUM_HUMANO, w("veneno", "nem"), {
    keys: [
      { t: NUM_HUMANO, pos: add(HUM, [0.7, 2.7, 5.6]), look: add(HUM, [0, 2.2, 0.3]), fov: 42 },
      { t: w("veneno", "nem"), pos: add(HUM, [0.5, 2.7, 5.0]), look: add(HUM, [0, 2.25, 0.3]), fov: 42 },
    ],
    look: DAY,
    scene: (t) => humanoDor(t),
  }),
  // ...e nem morfina resolve (close na seringa e na mão)
  P(w("veneno", "nem"), S("canivete"), {
    keys: [
      { t: w("veneno", "nem"), pos: add(HUM, [1.3, 2.6, 2.6]), look: add(HUM, [0.2, 2.35, 0.6]), fov: 36 },
      { t: S("canivete"), pos: add(HUM, [1.0, 2.55, 2.2]), look: add(HUM, [0.2, 2.35, 0.6]), fov: 34 },
    ],
    look: DAY,
    scene: (t) => humanoDor(t),
  }),
  // ======== CANIVETE ========
  // 21. no namoro: dois machos se aproximam na água
  P(S("canivete"), w("canivete", "voce"), {
    keys: [
      { t: S("canivete"), pos: [0, 2.0, RZ + 3.6], look: [0, 0, RZ], fov: 40 },
      { t: w("canivete", "voce"), pos: [0.15, 1.4, RZ + 3.0], look: [0, 0, RZ], fov: 40 },
    ],
    look: WIDE,
    scene: (t) => {
      const k = prog(t, S("canivete"), w("canivete", "voce") + 0.3);
      return (
        <>
          {riacho(t)}
          <Orni t={t} macho nadar={1} position={[-0.8 + k * 0.35, swimY, RZ + 0.05]} rotation={[0, 2.0, 0]} />
          <Orni t={t + 0.3} macho nadar={1} position={[0.8 - k * 0.35, swimY, RZ - 0.05]} rotation={[0, -1.15, 0]} />
        </>
      );
    },
  }),
  // 22. briga a chute com respingos
  P(w("canivete", "voce"), w("canivete", "esse"), {
    keys: [
      { t: w("canivete", "voce"), pos: [0.2, 0.8, RZ + 2.4], look: [0, 0, RZ], fov: 38 },
      { t: w("canivete", "esse"), pos: [-0.5, 0.55, RZ + 1.8], look: [0, 0, RZ], fov: 36 },
    ],
    look: DAY,
    scene: (t) => {
      const big = 1 + prog(t, w("canivete", "chute") - 0.1, w("canivete", "chute") + 0.2) * 0.5;
      const k = 0.5 + 0.5 * Math.sin(t * 9 * big);
      return (
        <>
          {riacho(t)}
          <Orni t={t} macho nadar={0.6} chutar={k} chutarLado="d" position={[-0.45, swimY, RZ + 0.05]} rotation={[0, 2.0, 0.2]} />
          <Orni t={t + 0.3} macho nadar={0.6} chutar={1 - k} chutarLado="e" position={[0.45, swimY, RZ - 0.05]} rotation={[0, -1.15, -0.2]} />
          <Respingos t={t} forca={big - 0.3} raio={0.6} position={[0, 0, RZ]} />
        </>
      );
    },
  }),
  // 23. herói: esse é seu canivete
  P(w("canivete", "esse"), S("ovo"), { keys: ESP_KEYS(w("canivete", "esse"), S("ovo")), look: DAY, scene: (t) => esporaoClose(t, 0.5 + 0.5 * Math.sin(t * 6)) }),
  // ======== OVO ========
  // 24. fêmea, mamífera: andando pela margem rumo à toca
  P(S("ovo"), w("ovo", "mas"), {
    keys: [
      { t: S("ovo"), pos: add(ENT, [-1.5, 0.5, 1.5]), look: add(ENT, [-1.4, 0.15, -0.4]), fov: 36 },
      { t: w("ovo", "mas"), pos: add(ENT, [-0.7, 0.45, 1.35]), look: add(ENT, [-0.75, 0.15, -0.4]), fov: 36 },
    ],
    look: DAY,
    scene: (t) => {
      const k = prog(t, S("ovo"), w("ovo", "mas") + 0.3);
      const p = add(ENT, [-1.75 + k * 0.9, 0, -0.45]); // pela margem seca, rumo à entrada
      p[1] = riachoAltura(p[0], p[2]);
      return (
        <>
          {riacho(t, [{ x: ENT[0] - 0.8, z: ENT[2] - 0.4, r: 1.4 }, { x: ENT[0] - 0.7, z: ENT[2] + 1.4, r: 1.0 }])}
          <EntradaToca position={add(ENT, [0, 0.12, 0.35])} rotation={[0.25, 0, 0]} scale={1.1} />
          <Orni t={t} andar={1} position={p} rotation={[0, PI / 2 - 0.15, 0]} />
        </>
      );
    },
  }),
  // 25. mas bota ovo: dois ovinhos
  P(w("ovo", "mas"), ECHOCA, { keys: OVOS_KEYS(w("ovo", "mas"), ECHOCA), look: TOCA, scene: (t) => ovosClose(t, prog(t, w("ovo", "ovo") - 0.15, w("ovo", "ovo") + 0.2)) }),
  // 26. corte do barranco: a toca, e ela choca enrolada entre o rabo e a barriga
  P(ECHOCA, S("leite"), {
    keys: [
      { t: ECHOCA, pos: [2.0, 1.1, 7.2], look: [2.3, 0.35, 0], fov: 44 },
      { t: w("ovo", "rabo"), pos: [TC[0] - 0.3, TC[1] + 0.6, 3.4], look: [TC[0], TC[1] + 0.2, -0.2], fov: 36 },
      { t: S("leite"), pos: [TC[0] - 0.1, TC[1] + 0.45, 2.6], look: [TC[0], TC[1] + 0.15, -0.2], fov: 34 },
    ],
    look: TOCA,
    scene: (t) => (
      <>
        <Toca t={t} tampoes={1} />
        <Orni t={t} enrolar={prog(t, w("ovo", "enrolada") - 0.2, w("ovo", "rabo"))} ovos={2} position={TC} rotation={[0, -0.6, 0]} pelo={10} />
      </>
    ),
  }),
  // ======== LEITE ========
  // 27. mãe inteira deitada na toca, de 3/4 pelo lado da cabeça: bico na cara... nenhum no peito
  P(S("leite"), w("leite", "o"), {
    keys: [
      { t: S("leite"), pos: add(MAE, [-1.15, 0.85, 2.05]), look: add(MAE, [-0.5, -0.03, 0.05]), fov: 38 },
      { t: w("leite", "nenhum"), pos: add(MAE, [-0.6, 0.58, 1.5]), look: add(MAE, [-0.2, -0.05, 0.08]), fov: 35 },
      { t: w("leite", "o"), pos: add(MAE, [-0.2, 0.5, 1.35]), look: add(MAE, [0.0, -0.06, 0.1]), fov: 34 },
    ],
    look: TOCA,
    scene: (t) => maeEFilhotes(t, 0),
  }),
  // 28. close da barriga: o leite brota das manchas, escorre pelo pelo, e o filhote lambe
  P(w("leite", "o"), w("leite", "essa"), {
    keys: [
      { t: w("leite", "o"), pos: add(MAE, [0.5, 0.55, 1.15]), look: add(MAE, [0.0, -0.05, 0.1]), fov: 30 },
      { t: w("leite", "essa"), pos: add(MAE, [0.42, 0.5, 1.02]), look: add(MAE, [0.0, -0.05, 0.1]), fov: 29 },
    ],
    look: TOCA,
    scene: (t) => maeEFilhotes(t, prog(t, w("leite", "leite"), w("leite", "pele") + 0.3)),
  }),
  // 29. herói: essa é sua mamadeira sem bico. A câmera recua da mãe pelo túnel, passa pelos tampões de terra
  // e sai na boca da toca, onde o mesmo cachorro fareja o buraco tapado e desiste (2ª ameaça)
  P(w("leite", "essa"), S("uv"), {
    keys: [
      { t: w("leite", "essa"), pos: add(MAE, [-0.45, 0.75, 1.75]), look: add(MAE, [-0.12, -0.06, 0.1]), fov: 38 },
      { t: w("leite", "essa") + 0.6, pos: [1.2, 0.95, 2.6], look: [0.6, 0.45, -0.2], fov: 42 },
      { t: w("leite", "essa") + 1.2, pos: [-3.4, 0.9, 2.7], look: [-4.4, 0.35, -0.25], fov: 42 },
      { t: S("uv"), pos: [-4.35, 0.8, 2.5], look: [-5.25, 0.3, -0.3], fov: 40 },
    ],
    look: TOCA,
    scene: (t) => {
      const a = w("leite", "essa") + 1.0;
      const desiste = prog(t, a + 0.6, S("uv") - 0.1);
      return (
        <>
          {maeEFilhotes(t, 1)}
          <group position={[-5.3 - desiste * 0.3, -0.16, -0.25]} rotation={[0, PI / 2 + desiste * 2.2, 0]}>
            <Cachorro t={t} farejar={1 - desiste} andar={desiste} dor={0} scale={0.7} />
          </group>
        </>
      );
    },
  }),
  // ======== UV (MODO BALADA) ========
  // debaixo de luz negra: sala escura, o tubo roxo acende
  P(S("uv"), w("uv", "seu"), {
    keys: [
      { t: S("uv"), pos: [1.3, 0.95, 2.9], look: [0, 0.45, -0.7], fov: 42 },
      { t: w("uv", "seu"), pos: [1.0, 0.75, 2.4], look: [0, 0.35, -0.5], fov: 40 },
    ],
    look: { sun: [2, 6, 3], sunPower: 0.05, ambient: 0.12 },
    scene: (t) => salaUV(t),
  }),
  // seu pelo brilha verde-azulado (câmera baixa: a barriga clara brilha mais)
  P(w("uv", "seu"), w("uv", "e"), {
    keys: [
      { t: w("uv", "seu"), pos: [1.4, 0.09, -0.25], look: [0.2, 0.15, 0.36], fov: 40 },
      { t: w("uv", "e"), pos: [1.28, 0.08, -0.2], look: [0.2, 0.15, 0.36], fov: 38 },
    ],
    look: { sun: [2, 6, 3], sunPower: 0.05, ambient: 0.12 },
    scene: (t) => salaUV(t),
  }),
  // e a ciência ainda não sabe por quê: humano translúcido de boca aberta olhando o bicho brilhando
  P(w("uv", "e"), w("uv", "esse"), {
    keys: [
      { t: w("uv", "e"), pos: [0.55, 1.3, 3.8], look: [-0.38, 1.3, -0.6], fov: 52 },
      { t: w("uv", "esse"), pos: [0.45, 1.28, 3.5], look: [-0.38, 1.3, -0.6], fov: 52 },
    ],
    look: { sun: [2, 6, 3], sunPower: 0.05, ambient: 0.12 },
    scene: (t) => (
      <>
        {salaUV(t, 0, -0.75)}
        <HumanoTranslucido t={t} position={[-1.0, 0, -0.9]} rotation={[0, 0.6, 0]} olhar={[0.15, 0.6]} boca={prog(t, w("uv", "e"), w("uv", "ciencia"))} />
      </>
    ),
  }),
  // herói: esse é seu modo balada (câmera girando, a luz pulsa)
  P(w("uv", "esse"), S("londres"), {
    keys: [
      { t: w("uv", "esse"), pos: [-0.95, 0.42, 1.45], look: [0.02, 0.2, 0.0], fov: 38 },
      { t: S("londres"), pos: [0.35, 0.4, 1.65], look: [0.02, 0.2, 0.0], fov: 38 },
    ],
    look: { sun: [2, 6, 3], sunPower: 0.05, ambient: 0.12 },
    scene: (t) => salaUV(t),
  }),
  // ======== LONDRES ========
  // 30. há mais de duzentos anos: gabinete de 1799 à luz de vela
  P(S("londres"), w("londres", "londres"), {
    keys: [
      { t: S("londres"), pos: [3.6, 4.2, 5.4], look: [0, 2.0, 0], fov: 46 },
      { t: w("londres", "londres"), pos: [2.4, 3.3, 3.8], look: [0, 1.9, 0], fov: 42 },
    ],
    look: NIGHT,
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Orni t={t} pelo={10} position={[0, MUSEU_MESA[1], 0.05]} rotation={[0, 0.4, 0]} scale={1.1} />
        <Cientista1799 t={t} inclinar={0.3} olhar={[0, 0.3]} position={[0.2, 0, -1.35]} />
      </>
    ),
  }),
  // 31. achou que você era pegadinha: lupa e espanto
  P(w("londres", "londres"), w("londres", "bico"), {
    keys: [
      { t: w("londres", "londres"), pos: [1.75, 2.8, 2.9], look: [0.05, 2.1, -0.45], fov: 42 },
      { t: w("londres", "bico"), pos: [1.5, 2.75, 2.6], look: [0.05, 2.1, -0.45], fov: 41 },
    ],
    look: NIGHT,
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Orni t={t} pelo={10} position={[0, MUSEU_MESA[1], 0.05]} rotation={[0, 0.4, 0]} scale={1.1} />
        <Cientista1799 t={t} lupa={0.22 * prog(t, w("londres", "achou") - 0.2, w("londres", "achou") + 0.4)} espanto={prog(t, w("londres", "pegadinha"), w("londres", "pegadinha") + 0.3)} inclinar={0.8} olhar={[0, 0.45]} position={[0.2, 0, -1.25]} />
      </>
    ),
  }),
  // 32. montagem: o bico solto na mesa, à frente do bicho de pelo; desliza, encaixa e a costura vermelha aparece
  P(w("londres", "bico"), S("tesoura"), {
    keys: [
      { t: w("londres", "bico"), pos: [0.45, MUSEU_MESA[1] + 1.1, 1.95], look: [0.02, MUSEU_MESA[1] + 0.08, 0.32], fov: 36 },
      { t: S("tesoura"), pos: [0.38, MUSEU_MESA[1] + 0.9, 1.6], look: [0.02, MUSEU_MESA[1] + 0.12, 0.25], fov: 34 },
    ],
    look: { ...NIGHT, sunPower: 0.3, ambient: 0.36 },
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Orni t={t} pelo={10} bicoLado={1 - prog(t, w("londres", "pato") - 0.1, w("londres", "costurado") + 0.1)} costura={prog(t, w("londres", "costurado"), w("londres", "pelo"))} position={[0, MUSEU_MESA[1], -0.05]} rotation={[0, 0.2, 0]} />
      </>
    ),
  }),
  // ======== TESOURA ========
  // 33. cortou sua pele procurando a costura
  P(S("tesoura"), w("tesoura", "nao"), {
    keys: [
      { t: S("tesoura"), pos: [1.6, 2.85, 2.6], look: [0.05, 2.0, -0.4], fov: 42 },
      { t: w("tesoura", "nao"), pos: [1.35, 2.75, 2.25], look: [0.05, 2.0, -0.4], fov: 40 },
    ],
    look: NIGHT,
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Orni t={t} pelo={10} cortes={prog(t, w("tesoura", "cortou"), w("tesoura", "costura") + 0.3)} position={[0, MUSEU_MESA[1], 0.05]} rotation={[0, 0.4, 0]} scale={1.1} />
        <Cientista1799 t={t} cortar={1} inclinar={0.9} olhar={[0, 0.5]} position={[0.2, 0, -1.2]} />
      </>
    ),
  }),
  // 34. não achou
  P(w("tesoura", "nao"), w("tesoura", "as"), {
    keys: [
      { t: w("tesoura", "nao"), pos: [1.5, 3.0, 2.4], look: [0.15, 2.45, -0.8], fov: 40 },
      { t: w("tesoura", "as"), pos: [1.3, 2.95, 2.15], look: [0.15, 2.45, -0.8], fov: 38 },
    ],
    look: NIGHT,
    scene: (t) => (
      <>
        <Museu1799 t={t} />
        <Orni t={t} pelo={10} cortes={1} position={[0, MUSEU_MESA[1], 0.05]} rotation={[0, 0.4, 0]} scale={1.1} />
        <Cientista1799 t={t} espanto={1} lupa={0.2} inclinar={0.3} olhar={[Math.sin(t * 5) * 0.25, 0.15]} position={[0.2, 0, -1.25]} />
      </>
    ),
  }),
  // 35. as marcas do corte: close em volta da base do bico, no espécime da vitrine (câmera dentro do vidro)
  P(w("tesoura", "as"), w("tesoura", "ate"), {
    keys: [
      { t: w("tesoura", "as"), pos: add(VITRINE_TAMPO, [0.82, 0.4, 0.6]), look: add(VITRINE_TAMPO, [0.3, 0.24, 0.36]), fov: 36 },
      { t: w("tesoura", "ate"), pos: add(VITRINE_TAMPO, [0.72, 0.37, 0.58]), look: add(VITRINE_TAMPO, [0.3, 0.24, 0.36]), fov: 33 },
    ],
    look: MODERN,
    scene: (t) => (
      <>
        <Vitrine t={t} />
        <Orni t={t} pelo={10} cortes={1} position={VITRINE_TAMPO} rotation={[0, 0.7, 0]} />
      </>
    ),
  }),
  // até hoje: a vitrine com a plaquinha de 1799
  P(w("tesoura", "ate"), S("ia"), {
    keys: [
      { t: w("tesoura", "ate"), pos: [1.6, 3.2, 3.6], look: [0, VITRINE_TAMPO[1] + 0.2, 0], fov: 38 },
      { t: S("ia"), pos: [1.1, 2.9, 2.9], look: [0, VITRINE_TAMPO[1] + 0.15, 0], fov: 36 },
    ],
    look: MODERN,
    scene: (t) => (
      <>
        <Vitrine t={t} />
        <Orni t={t} pelo={10} cortes={1} position={VITRINE_TAMPO} rotation={[0, 0.7, 0]} />
      </>
    ),
  }),
  // ======== IA ========
  // 36. celular com o vídeo e comentários "é IA"
  P(S("ia"), S("final"), {
    keys: [
      { t: S("ia"), pos: [0.4, 1.7, 6.4], look: [0, 1.5, 0], fov: 40 },
      { t: S("final"), pos: [0.15, 1.6, 5.5], look: [0, 1.5, 0], fov: 40 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t)}
        <CelularComentarios t={t} abrir={prog(t, w("ia", "iam") - 0.1, w("ia", "dizer") + 0.3)} mostrar={prog(t, w("ia", "dizer"), S("final") - 0.1) * 6} position={[0, 1.5, 0]} rotation={[-0.05, 0.12, 0.03]} />
      </>
    ),
  }),
  // ======== FINAL (recapitulação rápida) ========
  P(S("final"), w("final", "come"), {
    agua: true,
    keys: [
      { t: S("final"), pos: [0.2, F(0, 0.4, 0.5)[1], 1.9], look: F(0.2, 0.4, 0.22), fov: 34 },
      { t: w("final", "come"), pos: [1.2, F(0, 0.4, 0.55)[1], 1.7], look: F(0.2, 0.4, 0.22), fov: 36 },
    ],
    look: UNDER,
    scene: (t) => caçaDeOlhoFechado(t, 1),
  }),
  P(w("final", "come"), w("final", "tem"), {
    keys: [
      { t: w("final", "come"), pos: [1.1, 0.45, RZ + 1.0], look: [0.25, 0.1, RZ], fov: 34 },
      { t: w("final", "tem"), pos: [0.85, 0.4, RZ + 0.8], look: [0.25, 0.1, RZ], fov: 32 },
    ],
    look: DAY,
    scene: (t) => bochechasNaSuperficie(t, 1),
  }),
  P(w("final", "tem"), w("final", "bota"), {
    keys: [
      { t: w("final", "tem"), pos: add(BANK, [2.3, 0.7, 1.95]), look: add(BANK, [0.6, 0.24, 0.0]), fov: 42 },
      { t: w("final", "bota"), pos: add(BANK, [2.45, 0.75, 2.1]), look: add(BANK, [0.65, 0.24, 0.05]), fov: 43 },
    ],
    look: DAY,
    scene: (t) => cachorroEspetado(ESPETA + 0.3 + (t - w("final", "tem"))),
  }),
  P(w("final", "bota"), w("final", "da"), { keys: OVOS_KEYS(w("final", "bota"), w("final", "da")), look: TOCA, scene: (t) => ovosClose(t, 1) }),
  P(w("final", "da"), w("final", "brilha"), {
    keys: [
      { t: w("final", "da"), pos: add(MAE, [0.5, 0.55, 1.15]), look: add(MAE, [0.0, -0.05, 0.1]), fov: 30 },
      { t: w("final", "brilha"), pos: add(MAE, [0.42, 0.5, 1.05]), look: add(MAE, [0.0, -0.05, 0.1]), fov: 29 },
    ],
    look: TOCA,
    scene: (t) => maeEFilhotes(t, 1),
  }),
  // ...e brilha na luz negra: flash do pelo fluorescente
  P(w("final", "brilha"), VOCE_NAO, {
    keys: [
      { t: w("final", "brilha"), pos: [1.4, 0.09, -0.25], look: [0.2, 0.15, 0.36], fov: 40 },
      { t: VOCE_NAO, pos: [1.28, 0.08, -0.2], look: [0.2, 0.15, 0.36], fov: 38 },
    ],
    look: { sun: [2, 6, 3], sunPower: 0.05, ambient: 0.12 },
    scene: (t) => salaUV(t, 1),
  }),
  // você não é pegadinha: retrato de frente na margem
  P(VOCE_NAO, VOCE_FIM, {
    keys: [
      { t: VOCE_NAO, pos: add(BANK, [0.35, 0.42, 1.75]), look: add(BANK, [0, 0.22, 0.25]), fov: 34 },
      { t: VOCE_FIM, pos: add(BANK, [0.2, 0.38, 1.5]), look: add(BANK, [0, 0.22, 0.25]), fov: 32 },
    ],
    look: DAY,
    scene: (t) => (
      <>
        {riacho(t, [{ x: BANK[0], z: BANK[2], r: 1.4 }, { x: BANK[0], z: BANK[2] + 1, r: 0.8 }])}
        <Orni t={t} macho cabeca={[Math.sin(t * 1.5) * 0.1, -0.05]} position={BANK} />
      </>
    ),
  }),
  // você é um ornitorrinco: volta para o quadro de abertura (último quadro = primeiro)
  P(VOCE_FIM, FIM + 1 / FPS, {
    keys: [
      { t: VOCE_FIM, pos: add(ABRE, [4.2, 1.1, 2.2]), look: add(ABRE, [0, 0.25, 0]), fov: 40 },
      { ...ABRE_KEYS(0)[0], t: FIM },
    ],
    look: DAY,
    drift: 0,
    scene: (t) => <Abertura u={t - FIM} />,
  }),
];

// legenda: palavras da timeline; o apelido ("Esse é seu ___") fica todo em amarelo
const WORDS: Word[] = TL.cenas.flatMap((c) => {
  if (!c.label) return c.words;
  const i = c.words.findIndex((x, k) => /^ess[ea]$/i.test(x.w) && k > c.words.length - 7);
  return c.words.map((x, k) => (i >= 0 && k >= i + 3 ? { ...x, kw: true } : x));
});

export const Ornitorrinco: React.FC = () => {
  useKitFont();
  const under = PLANS.filter((p) => p.agua);
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#CFE6EF" }}>
        {PLANS.map((p, i) => {
          const L = p.look ?? DAY;
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
        {under.map((p, i) => (
          <TintaAgua key={i} de={p.from} ate={p.to} forca={0.9} />
        ))}
        {/* números no topo */}
        <NumeroTopo de={w("sensores", "quarenta")} ate={w("sensores", "um")} numero="40 mil" sub="sensores" />
        <NumeroTopo de={w("sensores", "tem", 1)} ate={S("detector")} numero="0" sub="humano" />
        <NumeroTopo de={w("dente", "quinto")} ate={w("dente", "uma")} numero="1/5" sub="do peso" />
        <NumeroTopo de={w("dente", "catorze") - 0.15} ate={S("marmita") + 0.5} numero="14 kg" sub="por dia" />
        <NumeroTopo de={w("veneno", "espetada")} ate={NUM_HUMANO} numero="espetada" tamanho={118} />
        <NumeroTopo de={w("veneno", "semanas")} ate={S("canivete")} numero="semanas" sub="de dor" tamanho={118} />
        <NumeroTopo de={w("londres", "duzentos")} ate={w("londres", "achou")} numero="1799" />
        <NumeroTopo de={w("tesoura", "ate")} ate={S("ia")} numero="até hoje" tamanho={118} />
        {/* apelidos amarelos */}
        <ApelidoAmarelo de={w("detector", "detector")} ate={S("dente")} texto="Detector de metais" tamanho={84} />
        <ApelidoAmarelo de={w("marmita", "marmita")} ate={S("veneno")} texto="Marmita" />
        <ApelidoAmarelo de={w("canivete", "canivete")} ate={S("ovo")} texto="Canivete" />
        <ApelidoAmarelo de={w("leite", "mamadeira")} ate={S("uv")} texto="Mamadeira sem bico" tamanho={80} />
        <NumeroTopo de={w("uv", "brilha")} ate={w("uv", "e")} numero="luz UV" sub="o pelo brilha" tamanho={118} />
        <ApelidoAmarelo de={w("uv", "modo")} ate={S("londres")} texto="Modo balada" />
        <NumeroTopo de={S("ia")} ate={S("final")} numero="IA ou real?" tamanho={104} />
        <Legenda1Palavra palavras={WORDS} />
        <Audio src={staticFile("ornitorrinco/narracao.wav")} />
        <Audio src={staticFile("ornitorrinco/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
