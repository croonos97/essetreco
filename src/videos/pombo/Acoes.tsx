import * as THREE from 'three';
import {Pombo} from '../../three/animais/pombo/Pombo';
import {Pessoa} from '../../three/animais/pombo/Cidade';
import {clamp01, mix, sm, V3} from '../../three/animais/LagartixaComum';

const PI = Math.PI;
export function Alimentacao({t, crop = 0, mother = 0}: {t: number; crop?: number; mother?: number}) {
  // Both tips meet at (0,.395,.15); baby scale .56 is already applied by the model.
  const pulse = Math.sin(t * 4) * .012;
  return <>
    <Pombo t={t} position={[0, -.035, -.11]} head={[1.05 + pulse, 0, 0]} beak={.6} crop={crop}/>
    <Pombo t={t} baby position={[0, .04, .346]} rotation={[0, PI, 0]} head={[-.6 - pulse, 0, 0]} beak={.8}/>
    {mother > 0 && <Pombo t={t} female position={[mix(1.2, .59, mother), 0, -.39]} rotation={[0, -.7, 0]} walk={mother < 1 ? 1 : 0} crop={crop}/>}</>;
}

export function Crescimento({t, k}: {t: number; k: number}) {
  const p = clamp01(k), feathered = p > .58;
  return <>
    <Pombo t={t} position={[-.31, 0, -.12]} rotation={[0, .2, 0]} head={[.04, -.3, 0]}/>
    <Pombo key={feathered ? 'jovem' : 'filhote'} t={t} baby={!feathered} scale={feathered ? mix(.73, .93, (p - .58) / .42) : mix(.8, 1.3, p / .58)} position={[.23, .04, .17]} rotation={[0, -.4, 0]} head={[-.18, Math.sin(t) * .14, 0]} beak={.15}/>
  </>;
}

export function CortePapo({t, k, detach}: {t: number; k: number; detach: number}) {
  const grow = sm(k), release = sm(detach);
  return <group position={[0, .41, 0]}>
    {/* Open anterior half: the cells belong to the inner lining, not to an external wound. */}
    <mesh rotation={[-PI / 2, 0, 0]} scale={[1, 1.15, 1]}>
      <sphereGeometry args={[.25, 48, 32, 0, PI * 2, 0, PI / 2]}/>
      <meshStandardMaterial color="#c29b6b" side={THREE.DoubleSide} roughness={.78}/>
    </mesh>
    <mesh scale={[1, 1.15, 1]}><torusGeometry args={[.25, .024, 12, 64]}/><meshStandardMaterial color="#dfbb79" roughness={.8}/></mesh>
    {Array.from({length: 60}, (_, i) => {
      const angle = i * 2.39996, radius = .14 + (i % 4) * .023;
      const fall = clamp01((release - (i % 9) * .035) * 1.5);
      const start: V3 = [Math.cos(angle) * radius, Math.sin(angle) * radius * 1.15, -.07 + (i % 3) * .025];
      const end: V3 = [Math.cos(i * 3) * .105, -.15 + Math.sin(i * 2) * .035, .025 + (i % 4) * .009];
      const s = .012 + grow * .016;
      return <group key={i} position={[mix(start[0], end[0], fall), mix(start[1], end[1], fall), mix(start[2], end[2], fall)]} rotation={[0, 0, angle]}>
        <mesh scale={[s * 1.3, s, s * .7]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color={fall > .2 ? '#f5e4b4' : i % 3 ? '#e3b957' : '#efce7c'} roughness={.7}/></mesh>
        {fall < .6 && <mesh position={[0, 0, s * .58]} scale={[s * .27, s * .3, s * .2]}><sphereGeometry args={[1, 8, 6]}/><meshStandardMaterial color="#a57a36"/></mesh>}
      </group>;
    })}
    <mesh position={[0, -.17, .025]} scale={[.13 * release, .035 * release, .07 * release]}><sphereGeometry args={[1, 24, 14]}/><meshStandardMaterial color="#f2e5be" roughness={.86}/></mesh>
  </group>;
}

export function Reconhecimento({t, stage, k}: {t: number; stage: 'shoo'|'neutral'|'change'|'avoid'; k: number}) {
  const chase = stage === 'shoo', avoid = stage === 'avoid';
  const changed = stage === 'avoid' || stage === 'change' && k >= .48;
  const away = chase ? sm(k) : avoid ? sm(k) : 0;
  return <>
    <Pessoa t={t} position={[-.55, 0, -1.05 + (chase ? k * .25 : 0)]} rotation={[0, .2, 0]} coat={changed ? '#397bac' : '#be4037'} action={chase ? 'shoo' : 'idle'} scale={.58}/>
    <Pessoa t={t} position={[1.05, 0, -1.1]} rotation={[0, -.4, 0]} coat="#8b7050" action="feed" scale={.58}/>
    <Pombo t={t} scale={.93} position={[mix(-.12, .93, away), Math.sin(away * PI) * .17, mix(.25, .78, away)]} rotation={[0, mix(-.4, 1.7, away), -.1 * Math.sin(away * PI)]} walk={chase || avoid ? 1 : .1} flap={away > .05 && away < .8 ? .55 : 0}/>
    {stage === 'change' && <group position={[-.55, .6 - k * .34, -.8 + Math.sin(k * PI) * .25]} rotation={[.8 + k * 2, 0, k * 1.4]} scale={[1 - sm(clamp01((k - .65) / .35)), 1, 1]}>
      <mesh scale={[.27, .3, .055]}><sphereGeometry args={[1, 20, 12]}/><meshStandardMaterial color="#be4037" roughness={1}/></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .26, -.04, 0]} rotation={[0, 0, s * .3]}><capsuleGeometry args={[.06, .3, 4, 8]}/><meshStandardMaterial color="#be4037"/></mesh>)}
    </group>}
  </>;
}

export function Pipoca({t, from}: {t: number; from: number}) {
  const elapsed = Math.max(0, t - from);
  return <>
    <Pessoa t={t} position={[-.65, 0, -.8]} rotation={[0, .4, 0]} coat="#71866a" action="feed" scale={.58}/>
    <Pombo t={t} position={[.13, 0, .24]} rotation={[0, -.7, 0]} head={[Math.max(0, Math.sin(elapsed * 5)) * .9, 0, 0]} walk={.1}/>
    {Array.from({length: 15}, (_, i) => {
      const age = clamp01((elapsed - i * .055) / .85);
      return <mesh key={i} position={[mix(-.38, .1 + Math.sin(i * 4) * .5, age), Math.max(.018, .95 * (1 - age) + Math.sin(age * PI) * .36), mix(-.1, .3 + Math.cos(i * 3) * .45, age)]} rotation={[age * i, i, age * 3]} scale={[.028, .023, .026]} castShadow><dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial color={i % 3 ? '#f5e8bf' : '#e3c78a'} roughness={1}/></mesh>;
    })}
  </>;
}

export function Transporte({t, k}: {t: number; k: number}) {
  return <>
    <Pessoa t={t} position={[-.6 + k * .3, 0, -.5]} rotation={[0, .2, 0]} scale={.6} action="walk" coat="#8f7654"/>
    <group position={[.3 + k * .24, .025, -.05]}>
      <Pombo t={t} position={[0, 0, -.04]} scale={.8} rotation={[0, -.5, 0]}/>
      <mesh position={[0, -.01, 0]} castShadow><boxGeometry args={[.9, .07, .7]}/><meshStandardMaterial color="#876342"/></mesh>
      {[0, .55].map(y => <mesh key={y} position={[0, y, -.35]}><boxGeometry args={[.9, .055, .05]}/><meshStandardMaterial color="#b29364"/></mesh>)}
      {[-1, 1].map(side => <group key={side}>
        {[0, .55].map(y => <mesh key={y} position={[side * .45, y, 0]}><boxGeometry args={[.05, .055, .7]}/><meshStandardMaterial color="#b29364"/></mesh>)}
        {Array.from({length: 6}, (_, i) => <mesh key={i} position={[side * .45, .28, -.3 + i * .12]}><boxGeometry args={[.035, .54, .035]}/><meshStandardMaterial color="#9a7d50"/></mesh>)}
      </group>)}
      {Array.from({length: 8}, (_, i) => <mesh key={i} position={[-.4 + i * .115, .28, .35]}><boxGeometry args={[.026, .55, .035]}/><meshStandardMaterial color="#ab8a5c"/></mesh>)}
    </group>
  </>;
}

export function Rato({t}: {t: number}) {
  const x = -.55 + Math.sin(t * .6) * .1;
  return <group position={[x, .06, .35]} rotation={[0, -.6, 0]}>
    <mesh scale={[.095, .08, .19]} castShadow><sphereGeometry args={[1, 20, 12]}/><meshStandardMaterial color="#8e7c6c"/></mesh>
    <mesh position={[0, .03, .18]} scale={[.06, .055, .09]}><sphereGeometry args={[1, 16, 10]}/><meshStandardMaterial color="#8e7c6c"/></mesh>
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * .05, .086, .15]} rotation={[.2, 0, s * .4]} scale={[.035, .044, .015]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#b69287"/></mesh>
      <mesh position={[s * .041, .05, .218]}><sphereGeometry args={[.008, 8, 6]}/><meshStandardMaterial color="#171719"/></mesh>
    </group>)}
    <mesh position={[0, -.035, -.24]} rotation={[PI / 2, .3, 0]}><capsuleGeometry args={[.008, .27, 4, 8]}/><meshStandardMaterial color="#b58e82"/></mesh>
  </group>;
}
