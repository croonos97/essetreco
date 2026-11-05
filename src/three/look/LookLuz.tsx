import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { LookCena, LookPlano, V3 } from "./presets";

// =====================================================================
// RECEITA DE LUZ (4 fontes + IBL):
//  1. KEY  — sol baixo e quente (direcional, ÚNICA luz com sombra; mapa FIXO por plano: foco/raio não mudam no plano)
//  2. FILL — céu frio (direcional fraca do lado oposto ao sol, sem sombra) + IBL do céu (LookAmbiente)
//  3. RIM  — contraluz: spot ATRÁS do bicho, no lado oposto à câmera, mirando o alvo → recorta a silhueta/penas
//            (posição calculada por quadro a partir da câmera; determinístico; decay 0 + cone fechado = só pega o bicho)
//  4. BOUNCE — rebatido quente do concreto/calçada (direcional de baixo para cima, sem sombra)
// Sombras: PCF (o PCFSoft foi removido no three 0.18x) com raio pequeno; o ruído do filtro é por pixel de tela (IGN),
// fixo no tempo → não pisca. Câmera de sombra parada no plano (foco/raio constantes) → sem "shimmer".
// =====================================================================
export type LookLuzProps = { cena: LookCena; plano: LookPlano; foco: V3; raio: number; alvo?: V3; rim?: boolean };
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();

export const LookLuz: React.FC<LookLuzProps> = ({ cena, plano, foco, raio, alvo, rim = true }) => {
  const { camera } = useThree();
  const sol = useMemo(() => new THREE.Vector3(...cena.solDir).normalize(), [cena.solDir]);
  const objs = useMemo(() => {
    const t = new THREE.Object3D();
    const tr = new THREE.Object3D();
    return { t, tr };
  }, []);
  objs.t.position.set(...foco);
  objs.t.updateMatrixWorld();
  const dist = raio * 3;
  const pos: V3 = [foco[0] + sol.x * dist, foco[1] + sol.y * dist, foco[2] + sol.z * dist];
  const alvoRim: V3 = alvo ?? foco;
  const spot = useMemo(() => {
    const s = new THREE.SpotLight(cena.rimCor, 1, 0, plano.rimAbertura, 1, 0);
    s.castShadow = false;
    return s;
  }, [cena.rimCor, plano.rimAbertura]);
  // posição do contraluz: atrás do alvo, oposto à câmera, elevado (roda antes do compositor: prioridade 0.5)
  useFrame(() => {
    if (!rim) return;
    _a.set(...alvoRim);
    _v.copy(_a).sub(camera.position);
    const d = Math.max(_v.length(), 1);
    _v.y = 0;
    if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
    _v.normalize();
    // gira para trás-e-de-lado (do lado oposto ao sol, visto da câmera): o contraluz pega a borda que a câmera vê
    const lado = Math.sign(_v.x * sol.z - _v.z * sol.x) || 1;
    const ang = plano.rimLado * lado;
    const cx = _v.x * Math.cos(ang) - _v.z * Math.sin(ang), cz = _v.x * Math.sin(ang) + _v.z * Math.cos(ang);
    _v.set(cx, 0, cz);
    const r = d * 1.2;
    spot.position.set(_a.x + _v.x * r * Math.cos(plano.rimAltura), _a.y + r * Math.sin(plano.rimAltura), _a.z + _v.z * r * Math.cos(plano.rimAltura));
    objs.tr.position.copy(_a);
    objs.tr.updateMatrixWorld();
    spot.target = objs.tr;
    spot.intensity = plano.rimIntensidade;
    spot.updateMatrixWorld();
  }, 0.5);
  const ceuPos: V3 = [foco[0] - sol.x * 200, foco[1] + 120, foco[2] - sol.z * 200];
  return (
    <>
      <primitive object={objs.t} />
      <primitive object={objs.tr} />
      <directionalLight
        position={pos}
        target={objs.t}
        intensity={cena.solIntensidade}
        color={cena.solCor}
        castShadow
        shadow-mapSize-width={plano.sombraMapa}
        shadow-mapSize-height={plano.sombraMapa}
        shadow-camera-left={-raio}
        shadow-camera-right={raio}
        shadow-camera-top={raio}
        shadow-camera-bottom={-raio}
        shadow-camera-near={raio * 0.5}
        shadow-camera-far={raio * 6}
        shadow-bias={-0.0003}
        shadow-normalBias={raio * 0.001}
        shadow-radius={plano.sombraRaio}
      />
      <directionalLight position={ceuPos} intensity={cena.ceuIntensidade} color={cena.ceuCor} />
      <directionalLight position={[foco[0] + sol.x * 30, foco[1] - 200, foco[2] + sol.z * 30]} target={objs.t} intensity={cena.rebateIntensidade} color={cena.rebateCor} />
      {rim ? <primitive object={spot} /> : null}
    </>
  );
};
