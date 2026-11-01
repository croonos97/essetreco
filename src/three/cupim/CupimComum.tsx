import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";
import { amostraCam, LKey } from "../animais/LagartixaComum";

// =====================================================================
// KIT CUPIM ("Seu pau tá cheio de bicho") — peças comuns.
// UNIDADE DESTE KIT: 1 un = 1 cm (independente do kit de animais).
//   Cupim e grânulos são modelados em MILÍMETROS e o grupo raiz aplica scale = MM (0,1).
//   Humano azul (HumanoTranslucido, 3,5 un) entra com scale = HUMANO (50) → 175 cm.
// Tudo é função pura de props/tempo (sem Math.random / Date).
// =====================================================================
export { clamp01, mix, sm, seg01, rnd, texCanvas, novoTubo, escreveTubo, noPlano, amostraCam } from "../animais/LagartixaComum";
export type { V3, LKey, Amostra } from "../animais/LagartixaComum";
export const MM = 0.1;
export const HUMANO = 50;

// Câmera: mesma lógica do kit da lagartixa, mas em cm. Deriva < 0,2 Hz.
// near/far por plano: macro (cupim) near 0,02; sala inteira near 1.
export const CupimCam: React.FC<{ t: number; keys: LKey[]; deriva?: number; near?: number; far?: number; roll?: number }> = ({ t, keys, deriva = 0, near = 0.02, far = 3000, roll = 0 }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const k = amostraCam(keys, t);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(k.pos[0] + Math.sin(t * 0.7) * deriva, k.pos[1] + Math.sin(t * 0.9 + 1) * deriva * 0.6, k.pos[2] + Math.cos(t * 0.6) * deriva);
    cam.fov = k.fov;
    cam.near = near;
    cam.far = far;
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(new THREE.Vector3(...k.look));
    cam.updateProjectionMatrix();
  });
  return null;
};

// Palco de dia (luz da casa vem de LuzCasa, sempre a mesma). Exposição FIXA em todos os planos.
export const EXPOSICAO = 1.0;
export const PalcoCasa: React.FC<{ children: React.ReactNode; fundo?: string }> = ({ children, fundo = "#E9E2D3" }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: fundo }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: EXPOSICAO, preserveDrawingBuffer: true, localClippingEnabled: true } as never}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ fov: 38, position: [0, 100, 200] }}
      >
        <color attach="background" args={[fundo]} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ---------- LUZ DA CASA: idêntica em todos os planos ----------
// Sol de janela (direcional, ÚNICA luz com sombra, direção fixa) + céu/chão + ambiente.
// Só o enquadramento do mapa de sombra muda por plano (foco/raio), nunca a direção ou a intensidade.
export const SOL_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize(); // do ponto para o sol (janela à esquerda, na frente)
export const LuzCasa: React.FC<{ foco?: [number, number, number]; raio?: number; sombra?: boolean }> = ({ foco = [0, 60, 0], raio = 120, sombra = true }) => {
  const dist = raio * 3;
  const pos: [number, number, number] = [foco[0] + SOL_DIR.x * dist, foco[1] + SOL_DIR.y * dist, foco[2] + SOL_DIR.z * dist];
  const alvo = useMemo(() => new THREE.Object3D(), []);
  alvo.position.set(...foco);
  alvo.updateMatrixWorld();
  return (
    <>
      <primitive object={alvo} />
      <hemisphereLight args={["#F4F1EA", "#A88F70", 0.9]} />
      <ambientLight intensity={0.25} color="#FFF4E6" />
      <directionalLight
        position={pos}
        target={alvo}
        intensity={2.1}
        color="#FFF1DC"
        castShadow={sombra}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-raio}
        shadow-camera-right={raio}
        shadow-camera-top={raio}
        shadow-camera-bottom={-raio}
        shadow-camera-near={raio * 0.5}
        shadow-camera-far={raio * 6}
        shadow-bias={-0.0004}
        shadow-normalBias={raio * 0.0012}
        shadow-radius={3}
      />
      {/* preenchimento frio do lado oposto (sem sombra): nenhuma face fica preta */}
      <directionalLight position={[foco[0] + 200, foco[1] + 80, foco[2] + 150]} intensity={0.35} color="#DCE6FF" />
    </>
  );
};
