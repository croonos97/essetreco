import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { ease } from "../theme";

export type Key = { t: number; pos: [number, number, number]; look: [number, number, number]; fov?: number };

const sample = (keys: Key[], sec: number) => {
  if (sec <= keys[0].t) return { ...keys[0], fov: keys[0].fov ?? 38 };
  const last = keys[keys.length - 1];
  if (sec >= last.t) return { ...last, fov: last.fov ?? 38 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < sec) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const p = ease.inOut((sec - a.t) / Math.max(b.t - a.t, 0.001));
  const mix = (x: number[], y: number[]) => x.map((v, k) => v + ((y.at(k) ?? v) - v) * p) as [number, number, number];
  return { t: sec, pos: mix(a.pos, b.pos), look: mix(a.look, b.look), fov: (a.fov ?? 38) + ((b.fov ?? 38) - (a.fov ?? 38)) * p };
};

// Câmera em trilho com respiração leve (nunca parada).
export const CameraRig: React.FC<{ keys: Key[]; offset?: number; shake?: number; drift?: number }> = ({
  keys,
  offset = 0,
  shake = 0,
  drift = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { camera } = useThree();
  const sec = frame / fps + offset;
  useLayoutEffect(() => {
    const k = sample(keys, sec);
    const d = drift * 0.04;
    const sx = shake ? (Math.sin(frame * 2.1) + Math.sin(frame * 3.7)) * shake : 0;
    const sy = shake ? (Math.cos(frame * 2.9) + Math.sin(frame * 1.3)) * shake : 0;
    camera.position.set(
      k.pos[0] + Math.sin(sec * 0.7) * d + sx,
      k.pos[1] + Math.sin(sec * 0.9 + 1) * d * 0.6 + sy,
      k.pos[2] + Math.cos(sec * 0.6) * d,
    );
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = k.fov;
    cam.near = 0.05;
    cam.far = 400;
    cam.lookAt(new THREE.Vector3(...k.look));
    cam.updateProjectionMatrix();
  });
  return null;
};
