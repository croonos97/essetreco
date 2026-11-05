import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { LookCena } from "./presets";
import { carregarHdri, HdriInfo, useRecurso } from "./LookAssets";

// =====================================================================
// IBL OFFLINE: um céu procedural (gradiente zênite→horizonte→chão + disco do sol + "lightformers" de rebatido)
// é renderizado UMA vez num cube map e pré-filtrado com PMREMGenerator → scene.environment.
// Nada é baixado; o resultado é idêntico em todo quadro e em todo bloco paralelo.
// =====================================================================
const ceuMat = (c: LookCena) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZ: { value: new THREE.Color(c.ceuZenite) },
      uH: { value: new THREE.Color(c.ceuHorizonte) },
      uC: { value: new THREE.Color(c.chao) },
      uSol: { value: new THREE.Vector3(...c.solDir).normalize() },
      uSolCor: { value: new THREE.Color(c.solCor) },
    },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZ, uH, uC, uSol, uSolCor; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 ceu = mix(uH, uZ, pow(clamp(y, 0.0, 1.0), 0.55));
        vec3 chao = mix(uH * 0.55, uC, smoothstep(0.0, -0.25, y));
        vec3 c = y >= 0.0 ? ceu : chao;
        // halo do sol (largo e suave: dá o "glow" quente do lado do sol) + disco (realce especular)
        float s = max(dot(d, uSol), 0.0);
        c += uSolCor * (0.6 * pow(s, 8.0) + 25.0 * smoothstep(0.9985, 0.9995, s));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

export const useAmbienteLook = (c: LookCena) => {
  const { gl, scene } = useThree();
  const env = useMemo(() => {
    const cena = new THREE.Scene();
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), ceuMat(c));
    cena.add(ceu);
    // lightformer de rebatido: faixa quente larga perto do horizonte do lado oposto ao sol (fachada iluminada)
    const sol = new THREE.Vector3(...c.solDir).normalize();
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.rebateCor).multiplyScalar(0.8), side: THREE.DoubleSide }));
    lf.position.set(-sol.x * 40, 4, -sol.z * 40);
    lf.lookAt(0, 0, 0);
    cena.add(lf);
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(cena, 0, 0.1, 200);
    pm.dispose();
    ceu.geometry.dispose();
    (ceu.material as THREE.Material).dispose();
    lf.geometry.dispose();
    (lf.material as THREE.Material).dispose();
    return rt;
  }, [gl, c]);
  useLayoutEffect(() => {
    const ant = scene.environment;
    const antI = scene.environmentIntensity;
    scene.environment = env.texture;
    scene.environmentIntensity = c.iblIntensidade;
    return () => {
      scene.environment = ant;
      scene.environmentIntensity = antI;
    };
  }, [scene, env, c.iblIntensidade]);
  useLayoutEffect(() => () => env.dispose(), [env]);
  return env;
};

// ---------- HDRI REAL (Poly Haven, CC0) ----------
// O .hdr vira PMREM UMA vez; a cena é girada (scene.environmentRotation) para o sol do HDRI cair no azimute do
// sol da cena (SOL_DIR) — reflexos e sombra de céu coerentes com a key. O pico do sol é limitado (hdriLimite)
// porque o sol "de verdade" já é a luz direcional com sombra. Fundo visível continua o do cenário (cilindro da cidade).
const LookHdri: React.FC<{ cena: LookCena; arquivo: string }> = ({ cena, arquivo }) => {
  const { gl, scene } = useThree();
  const info = useRecurso<HdriInfo>(`hdri:${arquivo}:${cena.hdriLimite ?? 0}`, () => carregarHdri(arquivo, cena.hdriLimite ?? 0));
  const env = useMemo(() => {
    if (!info) return null;
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromEquirectangular(info.tex);
    pm.dispose();
    return rt;
  }, [gl, info]);
  useLayoutEffect(() => {
    if (!env || !info) return;
    const ant = scene.environment, antI = scene.environmentIntensity, antR = scene.environmentRotation.clone();
    const sol = new THREE.Vector3(...cena.solDir).normalize();
    // R_y(θ)·s = sol (em azimute): θ = az(sol) − az(s), az = atan2(x, z)
    const th = Math.atan2(sol.x, sol.z) - Math.atan2(info.solDir.x, info.solDir.z) + (cena.hdriGiro ?? 0);
    scene.environment = env.texture;
    scene.environmentIntensity = cena.hdriIntensidade ?? cena.iblIntensidade;
    scene.environmentRotation.set(0, th, 0);
    return () => {
      scene.environment = ant;
      scene.environmentIntensity = antI;
      scene.environmentRotation.copy(antR);
    };
  }, [scene, env, info, cena]);
  useLayoutEffect(() => () => env?.dispose(), [env]);
  return null;
};
const LookCeuProcedural: React.FC<{ cena: LookCena }> = ({ cena }) => {
  useAmbienteLook(cena);
  return null;
};
// hdri: nome do arquivo em public/look/hdri/ (padrão: cena.hdri); null/"" = céu procedural (fallback)
export const LookAmbiente: React.FC<{ cena: LookCena; hdri?: string | null }> = ({ cena, hdri }) => {
  const arq = hdri === undefined ? cena.hdri : hdri;
  return arq ? <LookHdri cena={cena} arquivo={arq} /> : <LookCeuProcedural cena={cena} />;
};
