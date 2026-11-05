import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { DepthOfFieldEffect, ToneMappingMode } from "postprocessing";
import { GradeEffect } from "./GradeEffect";
import { LookCena, LookPlano, V3 } from "./presets";

// =====================================================================
// CADEIA DE PÓS (ordem): RenderPass (HDR linear, half-float, MSAA)
//   → N8AO (AO de tela; accumulate=false → sem acúmulo temporal; ruído azul FIXO na tela + denoise)
//   → Profundidade de campo (CoC por profundidade; foco = distância câmera→alvo, recalculada por quadro; sem jitter)
//   → Bloom (mipmap blur, limiar ≥ 1 em HDR linear: só realces estouram; sem adaptação de luminância)
//   → Grading de cena + perspectiva aérea (GradeEffect) → Vinheta → Tone mapping (ACES/AgX/Neutral) por ÚLTIMO.
// Nenhum efeito usa tempo, delta ou acúmulo: o quadro N sai igual em qualquer ordem/bloco de render.
// =====================================================================
const _cam = new THREE.Vector3();
const COR_AO = new THREE.Color("#1d1a26"); // AO levemente azul-arroxeado (sombra de céu), não preto
const TONE: Record<string, ToneMappingMode> = { aces: ToneMappingMode.ACES_FILMIC, agx: ToneMappingMode.AGX, neutral: ToneMappingMode.NEUTRAL };

export type LookPosProps = { cena: LookCena; plano: LookPlano; alvo?: V3; msaa?: number };
export const LookPos: React.FC<LookPosProps> = ({ cena, plano, alvo, msaa = 4 }) => {
  const grade = useMemo(
    () =>
      new GradeEffect({
        exposicao: plano.exposicao,
        contraste: plano.contraste,
        saturacao: plano.saturacao,
        temperatura: plano.temperatura,
        tinta: plano.tinta,
        splitForca: plano.splitForca,
        sombra: cena.fundoFrio,
        alta: cena.altasQuentes,
        nevoa: cena.nevoaCor,
        nevoaPerto: plano.nevoa ? plano.nevoa.perto : 1e9,
        nevoaLonge: plano.nevoa ? plano.nevoa.longe : 2e9,
        nevoaQuanto: plano.nevoa ? plano.nevoa.quanto : 0,
        nevoaDessatura: plano.nevoa ? plano.nevoa.dessatura : 0,
      }),
    [cena, plano],
  );
  useEffect(() => () => grade.dispose(), [grade]);
  const alvoV = useMemo(() => (alvo ? new THREE.Vector3(...alvo) : undefined), [alvo]);
  // foco do DOF: distância câmera→alvo calculada NESTE quadro (antes do compositor, prioridade 0.5).
  // (o `target` do wrapper não chegava ao efeito e o foco ficava no padrão de 3 un → tudo desfocado)
  const dofRef = useRef<DepthOfFieldEffect>(null);
  useFrame(({ camera }) => {
    const e = dofRef.current;
    if (!e || !alvoV) return;
    e.target = null;
    e.cocMaterial.focusDistance = camera.getWorldPosition(_cam).distanceTo(alvoV);
  }, 0.5);
  const fx: React.ReactElement[] = [];
  if (plano.ao) fx.push(<N8AO key="ao" aoRadius={plano.ao.raio} intensity={plano.ao.intensidade} distanceFalloff={plano.ao.queda} aoSamples={16} denoiseSamples={8} denoiseRadius={12} halfRes={plano.ao.halfRes} color={COR_AO} />);
  if (plano.dof && alvoV) fx.push(<DepthOfField key="dof" ref={dofRef} worldFocusRange={plano.dof.faixa} bokehScale={plano.dof.bokeh} resolutionScale={plano.dof.resolucao} />);
  if (plano.bloom) fx.push(<Bloom key="bloom" mipmapBlur luminanceThreshold={plano.bloom.limiar} luminanceSmoothing={plano.bloom.suave} intensity={plano.bloom.intensidade} radius={plano.bloom.raio} />);
  fx.push(<primitive key="grade" object={grade} />);
  fx.push(<Vignette key="vin" offset={plano.vinheta.offset} darkness={plano.vinheta.escuro} />);
  fx.push(<ToneMapping key="tone" mode={TONE[plano.tone]} />);
  return (
    <EffectComposer multisampling={msaa} frameBufferType={THREE.HalfFloatType}>
      {fx}
    </EffectComposer>
  );
};
