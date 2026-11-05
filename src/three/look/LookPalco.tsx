import * as THREE from "three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { LookAmbiente } from "./LookAmbiente";
import { LookLuz } from "./LookLuz";
import { LookPos } from "./LookPos";
import { CENAS, LookCena, LookPlano, NomeCena, PLANOS, TipoPlano, V3 } from "./presets";

// =====================================================================
// <LookPalco> — substitui o "PalcoDia + LuzDia" de um vídeo: canvas + IBL + receita de luz + pós.
// Uso:
//   <LookPalco cena="marquise_dia" plano="close" foco={[x,y,z]} raio={30} alvo={[x,y,z]}>
//     <PomboCam … />            // a câmera do vídeo (qualquer componente que posicione a câmera em useLayoutEffect)
//     <LookAve><Pombo …/></LookAve>
//     <LookConcreto><Quarteirao/></LookConcreto>
//   </LookPalco>
// Props:
//   cena   nome do preset de cena (CENAS) ou objeto LookCena          — paleta, sol, céu, névoa
//   plano  "close" | "medio" | "aberto" ou objeto LookPlano            — AO, DOF, bloom, contraluz, grading
//   ajuste Partial<LookPlano> por cima do plano (ex.: { exposicao: 1.1 }) — para acertar um plano sem criar preset
//   foco/raio  recorte FIXO do mapa de sombra do sol (centro, meia-largura) — igual ao LuzDia do kit
//   alvo   ponto em foco (DOF) e alvo do contraluz; sem alvo → sem DOF e contraluz mira o foco
//   pos    false desliga toda a pós (só luz + IBL, tone map do renderer) — p/ prévia rápida
//   msaa   amostras do MSAA do RenderPass (4 padrão; 0 = sem AA)
// =====================================================================
export type LookPalcoProps = {
  children: React.ReactNode;
  cena?: NomeCena | LookCena;
  plano?: TipoPlano | LookPlano;
  ajuste?: Partial<LookPlano>;
  foco?: V3;
  raio?: number;
  alvo?: V3;
  pos?: boolean;
  msaa?: number;
  rim?: boolean;
  hdri?: string | null; // arquivo em public/look/hdri/ (padrão = o da cena); null = céu procedural
};
export const resolverLook = (cena: NomeCena | LookCena = "marquise_dia", plano: TipoPlano | LookPlano = "medio", ajuste?: Partial<LookPlano>) => {
  const C = typeof cena === "string" ? CENAS[cena] : cena;
  const P0 = typeof plano === "string" ? PLANOS[plano] : plano;
  return { C, P: ajuste ? { ...P0, ...ajuste } : P0 };
};
const cacheLook = new Map<string, { C: LookCena; P: LookPlano }>();
export const LookPalco: React.FC<LookPalcoProps> = ({ children, cena, plano, ajuste, foco = [0, 15, 20], raio = 60, alvo, pos = true, msaa = 4, rim = true, hdri }) => {
  const { width, height } = useVideoConfig();
  // objetos estáveis (os efeitos de pós dependem da identidade do preset)
  const k = JSON.stringify([cena, plano, ajuste]);
  if (!cacheLook.has(k)) cacheLook.set(k, resolverLook(cena, plano, ajuste));
  const { C, P } = cacheLook.get(k)!;
  return (
    <AbsoluteFill style={{ background: C.fundo }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: !pos, alpha: false, toneMapping: pos ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, toneMappingExposure: P.exposicao, preserveDrawingBuffer: true, localClippingEnabled: true, stencil: false } as never}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.localClippingEnabled = true;
        }}
        camera={{ fov: 38, position: [0, 60, 120] }}
      >
        <color attach="background" args={[C.fundo]} />
        <LookAmbiente cena={C} hdri={hdri} />
        <LookLuz cena={C} plano={P} foco={foco} raio={raio} alvo={alvo} rim={rim} />
        {children}
        {pos ? <LookPos cena={C} plano={P} alvo={alvo} msaa={msaa} /> : null}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
