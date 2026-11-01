import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C } from "../theme";

// Palco 3D padrão: céu em degradê atrás, luz de fim de manhã, sombras suaves.
export const Stage: React.FC<{
  children: React.ReactNode;
  sky?: [string, string];
  sun?: [number, number, number];
  ambient?: number;
  sunPower?: number;
  shadowSize?: number;
  fog?: [string, number, number];
  exposure?: number;
}> = ({ children, sky = [C.skyTop, C.sky], sun = [8, 14, 6], ambient = 1, sunPower = 2.4, shadowSize = 14, fog, exposure = 1.18 }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 70%)` }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ fov: 38, position: [0, 2, 8] }}
      >
        {fog ? <fog attach="fog" args={fog} /> : null}
        <hemisphereLight args={["#DDEEFF", "#9C8A6E", 0.9 * ambient]} />
        <ambientLight intensity={0.25 * ambient} />
        <directionalLight
          position={sun}
          intensity={sunPower}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={6}
          shadow-camera-left={-shadowSize}
          shadow-camera-right={shadowSize}
          shadow-camera-top={shadowSize}
          shadow-camera-bottom={-shadowSize}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
          color="#FFF4E2"
        />
        <directionalLight position={[-6, 4, -5]} intensity={0.35} color="#BFD9FF" />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
