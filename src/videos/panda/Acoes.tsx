import {useMemo} from 'react';
import * as THREE from 'three';
import {Panda} from '../../three/animais/panda/Panda';
import {PilhaBambu} from '../../three/animais/panda/Bambuzal';
import {clamp01, mix, sm, V3} from '../../three/animais/LagartixaComum';

export const suave = (t: number, from: number, to: number) => sm(clamp01((t - from) / Math.max(.001, to - from)));
export function Residuos({count = 4}: {count?: number}) {
  return <group>{Array.from({length: count}, (_, i) => <mesh key={i} position={[Math.sin(i * 5.7) * .48, .012 + (i % 2) * .006, .43 + (i % 4) * .12]} rotation={[-Math.PI / 2, 0, i * 2.2]} scale={[.018, .16 + (i % 3) * .025, 1]} receiveShadow>
    <planeGeometry args={[1, 1]}/><meshStandardMaterial color={i % 2 ? '#cdb77b' : '#6d8b43'} side={THREE.DoubleSide} roughness={1}/>
  </mesh>)}</group>;
}

export function Comendo({t, reach = 1, peel = 0, consumed = 0, position = [0, 0, 0], rotation = [0, 0, 0], chew = .85}: {t: number; reach?: number; peel?: number; consumed?: number; position?: V3; rotation?: V3; chew?: number}) {
  return <group position={position} rotation={rotation}>
    <Panda t={t} pose="eat" grip={1} chew={chew} bamboo reach={reach} peel={peel}/>
    <group position={[-.25, 0, .65]}><PilhaBambu t={t} consumed={consumed}/></group>
    <Residuos count={Math.min(30, 3 + consumed * 3 + Math.floor(peel * 5))}/>
  </group>;
}

export function Dejetos({amount = 1, fresh = 0, position = [-.65, 0, -.35]}: {amount?: number; fresh?: number; position?: V3}) {
  return <group position={position}>
    {Array.from({length: amount + (fresh > 0 ? 1 : 0)}, (_, i) => {
      const scale = i === amount ? sm(fresh) : 1;
      return <group key={i} position={[-(i % 3) * .13, .055 * scale, Math.floor(i / 3) * .14]} rotation={[0, i * 1.8, 0]} scale={scale}>
        <mesh scale={[.09, .057, .17]} castShadow><sphereGeometry args={[1, 16, 10]}/><meshStandardMaterial color="#829251" roughness={1}/></mesh>
        {Array.from({length: 7}, (_, j) => <mesh key={j} position={[Math.sin(j * 4) * .058, .035 + Math.cos(j) * .01, Math.cos(j * 3) * .11]} rotation={[.4, j * 1.2, .8]}><capsuleGeometry args={[.004, .04, 3, 5]}/><meshStandardMaterial color="#c0b776" roughness={1}/></mesh>)}
      </group>;
    })}
  </group>;
}

const digestivePoints: V3[] = [[-.12, 1.25, .02], [-.13, 1.05, .02], [-.14, .91, .02], [.01, .81, .03], [.17, .7, .04], [.19, .53, .06], [-.13, .49, .07], [-.2, .37, .08], [.15, .32, .09], [.19, .22, .1], [-.06, .14, .1]];
export function Digestivo({t, absorption = 0}: {t: number; absorption?: number}) {
  const data = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(digestivePoints.map(v => new THREE.Vector3(...v)));
    return {curve, tube: new THREE.TubeGeometry(curve, 110, .035, 12, false)};
  }, []);
  return <group>
    <mesh position={[0, .68, -.11]} scale={[.43, .66, .16]}><sphereGeometry args={[1, 32, 24]}/><meshStandardMaterial color="#d7e4de" transparent opacity={.12} depthWrite={false}/></mesh>
    <mesh position={[.02, .83, .015]} rotation={[0, 0, .45]} scale={[.15, .11, .065]}><sphereGeometry args={[1, 24, 16]}/><meshStandardMaterial color="#d7aa7e" roughness={.8}/></mesh>
    <mesh geometry={data.tube}><meshStandardMaterial color="#c6a077" transparent opacity={.65} roughness={.72}/></mesh>
    {Array.from({length: 16}, (_, i) => {
      const k = (t * .18 + i / 16) % 1, pos = data.curve.getPoint(k);
      const nutrient = i % 3 === 0;
      if (nutrient && absorption > 0 && k > .5) {
        const out = (k - .5) * 2 * absorption;
        pos.x += out * (i % 2 ? .38 : -.38);
      }
      return <mesh key={i} position={pos} scale={nutrient ? [.013, .013, .013] : [.01, .023, .013]} rotation={[0, i, i * .7]}><sphereGeometry args={[1, 8, 6]}/><meshStandardMaterial color={nutrient ? '#f7d169' : '#668a42'} roughness={.8}/></mesh>;
    })}
  </group>;
}

export function Descansando({t, fresh = 0}: {t: number; fresh?: number}) {
  return <group position={[-.9, 0, .8]} rotation={[0, -.3, 0]}>
    <Panda t={t} pose="rest" chew={0} mouthOpen={0} bamboo={false}/>
    <Dejetos amount={2} fresh={fresh} position={[-.55, 0, -.55]}/>
    <Residuos count={12}/>
  </group>;
}

export function Caminhando({t, from, to}: {t: number; from: number; to: number}) {
  const k = suave(t, from, to);
  const turn = sm(clamp01((k - .8) / .2));
  return <Panda t={t} pose="walk" bamboo={false} position={[mix(.1, 2.7, k), 0, mix(.1, -4.8, k)]} rotation={[0, mix(2.65, 0, turn), 0]}/>;
}
