import { useMemo } from "react";
import * as THREE from "three";
import { HumanoTranslucido } from "../animais/HumanoTranslucido";
import { HumanoAzul } from "../animais/LagartixaHumano";
import { Caixa, Casa, CasaProps, CASA, comRep, FURO_MUNDO, GAL_BAT, batParaMundo } from "./Casa";
import { Cupim } from "./Cupim";
import { clamp01, HUMANO, rnd, seg01, sm, texCanvas, V3 } from "./CupimComum";
import { FilaFormigas, Trilha } from "./Formiga";
import { MontinhoGraos } from "./Graos";
import { GAL_VAZIA, Galerias, gerarGalerias, mesclarGalerias, PecaMadeira, PecaProps, texVerniz } from "./Madeira";

// =====================================================================
// QUARTO BRASILEIRO (cenário único do vídeo). Unidade: cm. Base = Casa (piso, paredes, vão com batente e soleira).
// Acrescenta: forro de lambri (y = 262) com uma VIGA de madeira aparente, lâmpada pendente, GUARDA-ROUPA
// (lado direito = peça com cupim, furinho e montinho embaixo), PORTA (folha com 20 colônias), fila de formigas
// saindo do rodapé e subindo o batente até o furinho do porteiro, família azul, móvel usado.
// IDADE das galerias é um estado global: idadeGalerias(t) — todas as cenas leem a mesma.
// =====================================================================
export const PE_DIREITO = 262;
// ---------- estado global ----------
// g de todas as peças no instante t (s do vídeo). Por padrão, colônias maduras (1). O vídeo pode passar a sua curva.
export const idadeGalerias = (t: number, curva?: [number, number][]) => {
  if (!curva || !curva.length) return 1;
  if (t <= curva[0][0]) return curva[0][1];
  for (let i = 1; i < curva.length; i++) if (t <= curva[i][0]) return curva[i - 1][1] + (curva[i][1] - curva[i - 1][1]) * sm((t - curva[i - 1][0]) / (curva[i][0] - curva[i - 1][0]));
  return curva[curva.length - 1][1];
};

// ---------- guarda-roupa (x −132…−22, z 1…57, pés de 8 cm, altura 200) ----------
export const GR = { x0: -132, x1: -22, z0: 1.2, z1: 57, pe: 8, h: 200, esp: 1.8 };
const GR_L = GR.h - GR.pe; // lateral direita: comprimento (vertical)
export const GAL_GR: Galerias = gerarGalerias(11, 18, 80, (GR.z1 - GR.z0) / 2, { ramos: 22 });
// lateral direita: local x → +y, local y (face vista) → +x, local z → −z
const ROT_LAT = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1))).toArray().slice(0, 3) as V3;
const POS_LAT: V3 = [GR.x1 - GR.esp / 2, GR.pe, (GR.z0 + GR.z1) / 2];
export const grParaMundo = (p: V3): V3 => {
  const v = new THREE.Vector3(...p).applyEuler(new THREE.Euler(...ROT_LAT));
  return [v.x + POS_LAT[0], v.y + POS_LAT[1], v.z + POS_LAT[2]];
};
export const FURO_GR = (): V3 => grParaMundo([GAL_GR.furo.x, GR.esp / 2, GAL_GR.furo.z]);
export const MONTE_GR = (): V3 => {
  const f = FURO_GR();
  return [f[0] + 1.7, 0.002, f[2]];
};

// ---------- viga do forro (ao longo de x, em z = 150) ----------
export const VIGA = { z: 150, W: 12, D: 14, x0: -140, L: 470 };
export const GAL_VIGA: Galerias = gerarGalerias(5, 120, 175, VIGA.W / 2, { ramos: 22 });
const ROT_VIGA = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1))).toArray().slice(0, 3) as V3;
const POS_VIGA: V3 = [VIGA.x0, PE_DIREITO - VIGA.D / 2 - 0.05, VIGA.z];
export const vigaParaMundo = (p: V3): V3 => {
  const v = new THREE.Vector3(...p).applyEuler(new THREE.Euler(...ROT_VIGA));
  return [v.x + POS_VIGA[0], v.y + POS_VIGA[1], v.z + POS_VIGA[2]];
};

// ---------- lâmpada pendente ----------
export const LAMPADA: V3 = [-20, 236, 112];

// ---------- porta (folha) com 20 colônias ----------
export const PORTA = { x0: 3.6, x1: 78.4, y0: CASA.soleira + 0.1, y1: 208.3, D: 3.5, zc: -13.2 }; // folha rente ao lado de lá do vão: a face do batente fica à mostra do quarto (z −11,4…0)
const PORTA_L = PORTA.y1 - PORTA.y0, PORTA_W = PORTA.x1 - PORTA.x0;
// 4 colunas × 5 linhas, cada colônia ocupa ~34 cm de altura e ~15 cm de largura
const COLS = [-27, -9, 9, 27], LINS = [8, 49, 90, 131, 172];
const _col: Galerias[] = [];
LINS.forEach((x0, li) => COLS.forEach((zc, ci) => _col.push(gerarGalerias(100 + li * 4 + ci, x0 + (ci % 2) * 4, x0 + 30 + (ci % 2) * 4, 7.4, { ramos: 7, z0: zc, wBase: 0.3, rBase: 0.22 }))));
export const GAL_PORTA: Galerias = mesclarGalerias(_col);
// porta: local x → +y, local y → +z (face para o quarto), local z → +x
const ROT_PORTA = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0))).toArray().slice(0, 3) as V3;
// centro de cada colônia no mundo (porta fechada) — para marcar "20 FAMÍLIAS"
export const CENTROS_PORTA: V3[] = _col.map((G) => {
  const R = G.ramos[0].pts[0];
  return [(PORTA.x0 + PORTA.x1) / 2 + R.z, PORTA.y0 + R.x, PORTA.zc + PORTA.D / 2];
});

// ---------- texturas ----------
const texLambri = () =>
  texCanvas("cupLambri", 1024, 1024, (g, W, H) => {
    // réguas de 10 cm (10 por textura = 100 cm), tom de pinus envernizado, com frisos
    for (let i = 0; i < 10; i++) {
      const tom = 0.9 + rnd(i, 1) * 0.15;
      g.fillStyle = `rgb(${196 * tom},${142 * tom},${88 * tom})`;
      g.fillRect(0, (i * H) / 10, W, H / 10);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(110,62,30,${0.1 + rnd(i * 50 + k, 2) * 0.15})`;
        g.fillRect(0, (i * H) / 10 + rnd(i * 50 + k, 3) * (H / 10), W, 1 + rnd(k, 4) * 2);
      }
      g.fillStyle = "rgba(60,32,14,0.85)";
      g.fillRect(0, (i * H) / 10, W, 4);
    }
  });

const matVerniz = (tom = "#FFFFFF", rep: [number, number] = [40, 10]) => {
  const t = texVerniz().clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / rep[0], 1 / rep[1]);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, color: tom, roughness: 0.45 });
};

// ---------- componentes ----------
export const Lampada: React.FC<{ acesa?: number }> = ({ acesa = 1 }) => {
  const a = clamp01(acesa);
  const M = useMemo(() => {
    const bocal = new THREE.MeshStandardMaterial({ color: "#EDEAE2", roughness: 0.5 });
    const fio = new THREE.MeshStandardMaterial({ color: "#222", roughness: 0.6 });
    const bulbo = new THREE.MeshStandardMaterial({ color: "#F4F1EA", roughness: 0.2, emissive: new THREE.Color("#FFE9B8"), emissiveIntensity: 0 });
    const halo = new THREE.SpriteMaterial({ map: texCanvas("cupHalo", 256, 256, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, "rgba(255,240,200,0.9)"); gr.addColorStop(0.25, "rgba(255,226,160,0.35)"); gr.addColorStop(1, "rgba(255,220,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, true, false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { bocal, fio, bulbo, halo };
  }, []);
  M.bulbo.emissiveIntensity = 2.2 * a;
  M.halo.opacity = a;
  const [x, y, z] = LAMPADA;
  return (
    <group>
      <mesh material={M.fio} position={[x, (y + PE_DIREITO) / 2 + 3, z]}>
        <cylinderGeometry args={[0.25, 0.25, PE_DIREITO - y - 6, 8]} />
      </mesh>
      <mesh material={M.bocal} position={[x, y + 4.5, z]} castShadow>
        <cylinderGeometry args={[1.9, 2.1, 6, 24]} />
      </mesh>
      <mesh material={M.bulbo} position={[x, y - 1.5, z]} scale={[3, 3.6, 3]}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      {a > 0.01 ? (
        <>
          <sprite material={M.halo} position={[x, y - 1.5, z]} scale={[28, 28, 1]} renderOrder={30} />
          <pointLight position={[x, y - 1.5, z]} intensity={260 * a} distance={0} decay={2} color="#FFE2B0" />
        </>
      ) : null}
    </group>
  );
};

// revoada de aleluias em volta da lâmpada (órbitas lentas, ≤ 0,45 volta/s; nunca passam a menos de 6 cm do bulbo)
export const Revoada: React.FC<{ t: number; n?: number; centro?: V3 }> = ({ t, n = 14, centro = LAMPADA }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const r = 8 + rnd(i, 71) * 14, w = (0.22 + rnd(i, 72) * 0.2) * 2 * Math.PI * (i % 2 ? 1 : -1);
      const a = rnd(i, 73) * 6.28 + t * w;
      const yy = (rnd(i, 74) - 0.5) * 16 + Math.sin(t * 0.7 + i) * 3;
      const p: V3 = [centro[0] + Math.cos(a) * r, centro[1] + yy, centro[2] + Math.sin(a) * r];
      const yaw = Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w)) ;
      return <Cupim key={i} t={t + i * 0.37} casta="alado" voar={1} bater={0.9} position={p} rotation={[0.25, yaw, 0]} escala={1.6} sombra={false} />;
    })}
  </>
);

export const FuroPrego: React.FC<{ position: V3; rotation: V3; r?: number; tampar?: number }> = ({ position, rotation, r = 0.11, tampar = 0 }) => {
  const M = useMemo(
    () => ({
      buraco: new THREE.MeshBasicMaterial({ color: "#140A04", polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      borda: new THREE.MeshStandardMaterial({ color: "#8E6440", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      tampa: new THREE.MeshStandardMaterial({ color: "#6E4A2C", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
    }),
    [],
  );
  const k = clamp01(tampar);
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} material={M.borda}>
        <ringGeometry args={[r, r * 1.6, 28]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} material={M.buraco}>
        <circleGeometry args={[r, 28]} />
      </mesh>
      {k > 0.001 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={M.tampa}>
          <ringGeometry args={[r * (1 - k) * 0.999, r * 1.02, 28]} />
        </mesh>
      ) : null}
    </group>
  );
};

// móvel usado (cômoda velha de 4 gavetas): 80 × 88 × 44, frente para +z
export const Comoda: React.FC<{ position?: V3; rotation?: V3 }> = ({ position, rotation }) => {
  const M = useMemo(() => ({ c: matVerniz("#A8846A", [40, 10]), g: matVerniz("#C59C78", [40, 10]), p: new THREE.MeshStandardMaterial({ color: "#B8A27A", roughness: 0.35, metalness: 0.7 }) }), []);
  return (
    <group position={position} rotation={rotation}>
      <Caixa p0={[-40, 6, -22]} p1={[40, 88, 22]} m={M.c} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <Caixa p0={[-37, 10 + i * 19.5, 22.05]} p1={[37, 27 + i * 19.5, 23.6]} m={M.g} />
          <Caixa p0={[-6, 17.5 + i * 19.5, 23.65]} p1={[6, 19.5 + i * 19.5, 25.2]} m={M.p} />
        </group>
      ))}
      {[[-37, -19], [33, -19], [-37, 15], [33, 15]].map(([x, z], i) => <Caixa key={i} p0={[x, 0.05, z]} p1={[x + 4, 6, z + 4]} m={M.c} />)}
    </group>
  );
};

// família azul: pai, mãe e criança, de frente para +z (origem = centro do grupo no chão)
export const FamiliaAzul: React.FC<{ t: number; position?: V3; rotation?: V3 }> = ({ t, position, rotation }) => (
  <group position={position} rotation={rotation}>
    <HumanoTranslucido t={t} position={[-32, 0, 0]} scale={HUMANO} />
    <HumanoTranslucido t={t} position={[0, 0, 4]} scale={HUMANO * 0.93} cor="#A9D9FF" />
    <HumanoTranslucido t={t} position={[28, 0, 8]} scale={HUMANO * 0.62} />
  </group>
);

// trilha das formigas: sai de uma fresta sob o rodapé (dentro da parede), vai pelo chão até o vão,
// sobe a soleira e o batente até o furinho do porteiro, e volta pela pista ao lado até a fresta.
export const TRILHA_FORMIGAS: Trilha = (() => {
  const F = FURO_MUNDO();
  const ida: V3[] = [
    [-60, 0.02, -0.5], [-60, 0.02, 2.0], [5.5, 0.02, 2.0], [5.5, 0.02, 0.64], [5.5, 1.22, 0.64], [5.5, 1.22, 0.3], [3.54, 1.22, -4.5], [3.54, F[1] - 1.0, F[2] + 0.9], [3.54, F[1] - 0.25, F[2] + 0.15],
  ];
  const volta: V3[] = [
    [3.54, F[1] - 0.25, F[2] - 0.15], [3.54, F[1] - 1.0, F[2] - 0.6], [3.54, 1.22, -6.2], [6.2, 1.22, 0.3], [6.2, 1.22, 0.64], [6.2, 0.02, 0.64], [6.2, 0.02, 2.7], [-60.7, 0.02, 2.7], [-60.7, 0.02, -0.5],
  ];
  const nI: V3[] = [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0], [1, 0, 0], [1, 0, 0]];
  const nV: V3[] = [[1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
  return { p: [...ida, ...volta], n: [...nI, [1, 0, 0], ...nV] };
})();

export type QuartoProps = CasaProps & {
  g?: number; // idade das galerias (todas as peças)
  lampada?: number;
  revoada?: boolean;
  formigas?: boolean | [number, number]; // true = trilha toda; [s0,s1] = só esse trecho (cm de trilha)
  porta?: Partial<PecaProps> & { abre?: number };
  guardaRoupa?: Partial<PecaProps>;
  viga?: Partial<PecaProps>;
  montinhoGR?: number;
  semForro?: boolean;
  familia?: boolean;
};
export const Quarto: React.FC<QuartoProps> = (P) => {
  const g = P.g ?? 1;
  const M = useMemo(() => {
    const lambri = new THREE.MeshStandardMaterial({ map: comRep(texLambri(), 100), roughness: 0.55, side: THREE.FrontSide });
    const gr = matVerniz("#FFFFFF", [40, 10]);
    const grPorta = matVerniz("#E8D2C0", [40, 10]);
    const puxador = new THREE.MeshStandardMaterial({ color: "#C8B486", roughness: 0.35, metalness: 0.75 });
    return { lambri, gr, grPorta, puxador };
  }, []);
  const abre = clamp01(P.porta?.abre ?? 0);
  const { x0, x1, z0, z1, pe, h, esp } = GR;
  return (
    <group>
      <Casa {...P} semMesa batente={{ g, ...P.batente }} />
      {/* forro de lambri (face para baixo) */}
      {P.semForro ? null : (
        <mesh material={M.lambri} position={[95, PE_DIREITO, 200]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[470, 400]} />
        </mesh>
      )}
      {/* viga aparente */}
      <PecaMadeira L={VIGA.L} W={VIGA.W} D={VIGA.D} gal={GAL_VIGA} g={g} position={POS_VIGA} rotation={ROT_VIGA} {...P.viga} />
      <Lampada acesa={P.lampada ?? 0} />
      {P.revoada ? <Revoada t={P.t} /> : null}
      {/* guarda-roupa */}
      <Caixa p0={[x0, pe, z0]} p1={[x0 + esp, h, z1]} m={M.gr} />
      <Caixa p0={[x0 + esp + 0.05, pe, z0]} p1={[x1 - esp - 0.05, pe + esp, z1]} m={M.gr} />
      <Caixa p0={[x0, h, z0]} p1={[x1, h + esp, z1 + 0.6]} m={M.gr} />
      <Caixa p0={[x0 + esp + 0.05, pe, z0]} p1={[x1 - esp - 0.05, h - 0.05, z0 + 1]} m={M.gr} />
      <PecaMadeira L={GR_L} W={z1 - z0} D={esp} gal={GAL_GR} g={g} furo position={POS_LAT} rotation={ROT_LAT} {...P.guardaRoupa} />
      {/* duas portas com almofadas e puxadores */}
      {[0, 1].map((i) => {
        const a = x0 + 0.3 + i * ((x1 - x0) / 2), b = a + (x1 - x0) / 2 - 0.6;
        return (
          <group key={i}>
            <Caixa p0={[a, pe + 2, z1 + 0.05]} p1={[b, h - 1, z1 + 2.0]} m={M.grPorta} />
            <Caixa p0={[a + 6, pe + 12, z1 + 2.05]} p1={[b - 6, pe + 92, z1 + 2.7]} m={M.gr} />
            <Caixa p0={[a + 6, pe + 102, z1 + 2.05]} p1={[b - 6, h - 12, z1 + 2.7]} m={M.gr} />
            <Caixa p0={[i === 0 ? b - 4 : a + 2.5, 100, z1 + 2.05]} p1={[i === 0 ? b - 2.5 : a + 4, 114, z1 + 3.8]} m={M.puxador} />
          </group>
        );
      })}
      {[[x0 + 2, z0 + 2], [x1 - 6, z0 + 2], [x0 + 2, z1 - 6], [x1 - 6, z1 - 6]].map(([x, z], i) => <Caixa key={i} p0={[x, 0.05, z]} p1={[x + 4, pe - 0.05, z + 4]} m={M.gr} />)}
      {(P.montinhoGR ?? 0) > 0.001 ? <MontinhoGraos cresce={P.montinhoGR} raio={1.2} altura={0.6} position={MONTE_GR()} cor="#B58A60" seed={3} /> : null}
      {/* folha da porta (dobradiça no batente direito) */}
      <group position={[PORTA.x1, 0, PORTA.zc + PORTA.D / 2]} rotation={[0, -1.55 * sm(abre), 0]}>
        <PecaMadeira L={PORTA_L} W={PORTA_W} D={PORTA.D} gal={GAL_PORTA} g={g} position={[-PORTA_W / 2, PORTA.y0, -PORTA.D / 2]} rotation={ROT_PORTA} {...P.porta} />
        {/* maçaneta */}
        <mesh position={[-PORTA_W + 6, 98, 2.6]} material={M.puxador}>
          <sphereGeometry args={[2.6, 20, 14]} />
        </mesh>
      </group>
      {P.formigas ? <FilaFormigas t={P.t} trilha={TRILHA_FORMIGAS} trecho={Array.isArray(P.formigas) ? P.formigas : undefined} /> : null}
      {P.familia ? <FamiliaAzul t={P.t} position={[-60, 0, 70]} rotation={[0, 0.3, 0]} /> : null}
    </group>
  );
};
void GAL_VAZIA; void batParaMundo; void GAL_BAT; void seg01; void HumanoAzul;
