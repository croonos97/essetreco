import {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {Clouds, rnd, SkyDome} from '../../World';

type V3 = [number, number, number];
type Part = {p: V3; s: V3; r?: V3; color: string};
const stone = ['#b3a89b', '#a39788', '#c1b6a6', '#918d85'];
const plaster = ['#d9c7ab', '#e2d7be', '#a9bfc0', '#cda28c', '#b5bba1'];

// Geometry is shared per batch: the detailed city stays inexpensive in wide shots.
function Batch({parts, shape = 'box', texture}: {parts: Part[]; shape?: 'box'|'sphere'|'twig'; texture?: THREE.Texture}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    parts.forEach((p, i) => {
      o.position.set(...p.p); o.rotation.set(...(p.r ?? [0, 0, 0])); o.scale.set(...p.s); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix); mesh.setColorAt(i, new THREE.Color(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  if (!parts.length) return null;
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} castShadow receiveShadow>
    {shape === 'sphere' ? <sphereGeometry args={[1, 12, 8]}/> : shape === 'twig' ? <cylinderGeometry args={[0.65, 1, 1, 5]}/> : <boxGeometry args={[1, 1, 1]}/>}
    <meshStandardMaterial map={texture} roughness={0.93}/>
  </instancedMesh>;
}

function weatheredTexture() {
  const size = 128, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = 212 + rnd(x + y * size, 17) * 38 - (x % 31 < 2 ? 9 : 0) - Math.max(0, y - 90) * .15;
    const k = (y * size + x) * 4;
    bytes[k] = v; bytes[k + 1] = v; bytes[k + 2] = v; bytes[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(bytes, size, size); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  return tex;
}

const add = (out: Part[], p: V3, s: V3, color: string, r?: V3) => out.push({p, s, color, r});

function architecture(high: boolean) {
  const walls: Part[] = [], details: Part[] = [], leaves: Part[] = [];
  const base = high ? -13 : 0;
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (10 + Math.floor(i / 10) * 9), z = -5 - Math.floor(i / 2) * 5.3;
    const h = 6 + rnd(i, 3) * 7, w = 4.6, depth = 4.9;
    add(walls, [x, base + h / 2, z], [w, h, depth], plaster[i % plaster.length]);
    for (const y of [base + .35, base + h - .22, base + h + .02]) add(details, [x, y, z], [w + .22, .16, depth + .2], '#d7d1c2');
    add(details, [x, base + h + .3, z], [w + .35, .32, depth + .4], '#9d6650');
    const front = z + depth / 2 + .035;
    for (let floor = 0; floor < Math.floor(h / 2.1); floor++) for (let col = -1; col <= 1; col++) {
      const wx = x + col * 1.35, wy = base + 1.25 + floor * 2.05;
      add(details, [wx, wy, front], [.89, 1.3, .13], '#d9d4c8');
      add(details, [wx, wy, front + .075], [.7, 1.12, .05], '#34444a');
      for (const dx of [-.19, .19]) add(details, [wx + dx, wy, front + .112], [.3, 1.06, .022], rnd(i * 21 + floor + col, 5) > .55 ? '#9aada9' : '#617d83');
      add(details, [wx, wy, front + .14], [.035, 1.12, .05], '#ded6bc');
      add(details, [wx, wy, front + .14], [.7, .035, .05], '#ded6bc');
      add(details, [wx, wy - .68, front + .13], [1, .12, .34], '#d6c8ae');
      if (floor > 0 && (col + i) % 2 === 0) {
        add(details, [wx, wy - .7, front + .4], [1.12, .11, .75], '#a6a399');
        add(details, [wx, wy - .18, front + .75], [1.12, .045, .045], '#363e3e');
        for (let b = 0; b < 6; b++) add(details, [wx - .5 + b * .2, wy - .42, front + .75], [.025, .52, .025], '#414745');
        add(details, [wx, wy - .54, front + .76], [.65, .19, .18], '#956347');
        for (let f = 0; f < 5; f++) {
          add(leaves, [wx - .27 + f * .13, wy - .4, front + .77], [.1, .13, .12], '#51764a');
          add(leaves, [wx - .27 + f * .13, wy - .29, front + .79], [.048, .048, .048], f % 2 ? '#c55857' : '#e2b45f');
        }
      }
    }
    if (i < 8) {
      add(details, [x, base + .65, front + .1], [1.2, 1.25, .14], '#514735');
      add(details, [x, base + 1.45, front + .3], [1.6, .14, .7], '#737a60');
    }
  }
  // Distant silhouettes are softly coloured; depth of field belongs to the camera.
  for (let i = 0; i < 28; i++) {
    const h = 5 + rnd(i, 8) * 16;
    add(walls, [(i - 14) * 4.7, base + h / 2 - 2, -65 - rnd(i, 9) * 20], [3 + rnd(i, 10) * 2, h, 4], ['#acb8b7', '#b9c4c1', '#9caeb2'][i % 3]);
  }
  return {walls, details, leaves};
}

function street() {
  const boxes: Part[] = [], foliage: Part[] = [], paving: Part[] = [];
  for (let x = -28; x <= 28; x++) for (let z = -26; z <= 17; z++) {
    const i = (x + 28) * 44 + z + 26;
    add(paving, [x * .35 + (z % 2) * .175, -.038 + rnd(i, 5) * .008, z * .29], [.332, .065, .272], stone[Math.floor(rnd(i, 6) * stone.length)]);
  }
  for (const side of [-1, 1]) {
    for (let n = 0; n < 4; n++) {
      const x = side * 5.6, z = 1 - n * 6;
      // Planked park benches, four feet, back rails and iron armrests.
      for (let b = 0; b < 5; b++) add(boxes, [x, .84, z - .33 + b * .16], [2.4, .09, .12], b % 2 ? '#866443' : '#a57b4b');
      for (let b = 0; b < 3; b++) add(boxes, [x, 1.18 + b * .18, z - .45], [2.4, .12, .08], '#926e48');
      for (const dx of [-.92, .92]) {
        for (const dz of [-.3, .3]) add(boxes, [x + dx, .4, z + dz], [.075, .8, .075], '#354442');
        add(boxes, [x + dx, 1.06, z], [.09, .07, .7], '#354442');
        add(boxes, [x + dx, 1.16, z - .45], [.07, .94, .07], '#354442');
      }
      const lx = side * 7.1;
      add(boxes, [lx, 2.5, z - 2], [.1, 5, .1], '#35413e');
      add(boxes, [lx, .15, z - 2], [.38, .3, .38], '#67716a');
      add(boxes, [lx, 5.04, z - 2], [.48, .12, .48], '#293d38');
      add(boxes, [lx, 4.69, z - 2], [.32, .58, .32], '#eadbad');
      for (const dx of [-.18, .18]) for (const dz of [-.18, .18]) add(boxes, [lx + dx, 4.7, z - 2 + dz], [.035, .62, .035], '#34463e');
      const tx = side * 8, tz = z - 4;
      add(boxes, [tx, .25, tz], [1.8, .5, 1.8], '#9d8e76');
      add(boxes, [tx, .51, tz], [1.55, .04, 1.55], '#554839');
      add(boxes, [tx, 2, tz], [.25, 3.4, .25], '#76634c');
      for (let c = 0; c < 6; c++) add(foliage, [tx + Math.cos(c * 2.4) * .7, 3.45 + rnd(c, n) * .8, tz + Math.sin(c * 2.4) * .6], [1.05, .95, 1.1], ['#65835a', '#7c9665', '#54774e'][c % 3]);
    }
  }
  return {boxes, foliage, paving};
}

export function Sementes({count = 45, spread = 1.9, seed = 12}: {count?: number; spread?: number; seed?: number}) {
  const parts = useMemo(() => Array.from({length: Math.max(0, Math.min(1500, Math.floor(count)))}, (_, i): Part => {
    const a = rnd(i, seed) * Math.PI * 2, r = Math.sqrt(rnd(i, seed + 1)) * spread;
    return {p: [Math.cos(a) * r, .012, Math.sin(a) * r], s: [.013 + rnd(i, 7) * .008, .009, .026], r: [0, rnd(i, 8) * 6.28, .1], color: ['#d7b55e', '#b89852', '#e3c886'][i % 3]};
  }), [count, spread, seed]);
  return <Batch parts={parts} shape="sphere"/>;
}

export function Ninho({t: _t, eggs = 0}: {t: number; eggs?: number}) {
  const twigs = useMemo(() => Array.from({length: 120}, (_, i): Part[] => {
    const a = rnd(i, 41) * Math.PI * 2, radius = .35 + rnd(i, 42) * .23;
    const direction = a + Math.PI / 2 + (rnd(i, 46) - .5) * .8;
    const length = i < 80 ? .1 + rnd(i, 45) * .14 : .22 + rnd(i, 45) * .16;
    const thickness = .0035 + rnd(i, 44) * .005;
    const point = (f: number) => new THREE.Vector3(
      Math.cos(a) * radius + Math.cos(direction) * (f - .5) * length + Math.cos(a) * Math.sin(f * Math.PI) * .017,
      .025 + rnd(i, 43) * .075 + Math.sin(f * Math.PI) * .012,
      Math.sin(a) * radius + Math.sin(direction) * (f - .5) * length + Math.sin(a) * Math.sin(f * Math.PI) * .017,
    );
    return Array.from({length: 3}, (_, segment): Part => {
      const start = point(segment / 3), end = point((segment + 1) / 3), d = end.clone().sub(start);
      const r = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
      return {p: start.add(end).multiplyScalar(.5).toArray() as V3, s: [thickness, d.length(), thickness], r: [r.x, r.y, r.z], color: ['#806246', '#a08259', '#62533f', '#b89c70'][i % 4]};
    });
  }).flat(), []);
  return <group>
    <mesh position={[0, .018, 0]} scale={[.47, .026, .47]} receiveShadow><sphereGeometry args={[1, 32, 12]}/><meshStandardMaterial color="#76604b" roughness={1}/></mesh>
    <Batch parts={twigs} shape="twig"/>
    {Array.from({length: Math.max(0, Math.min(4, Math.floor(eggs)))}, (_, i) => <mesh key={i} position={[(i % 2 ? 1 : -1) * .105, .098, Math.floor(i / 2) * .18 - .06]} rotation={[.15, i, .2]} scale={[.08, .109, .078]} castShadow><sphereGeometry args={[1, 24, 16]}/><meshStandardMaterial color="#eee8d7" roughness={.7}/></mesh>)}
  </group>;
}

function Ball({p, s, color}: {p: V3; s: V3; color: string}) {
  return <mesh position={p} scale={s} castShadow><sphereGeometry args={[1, 20, 14]}/><meshStandardMaterial color={color} roughness={.82}/></mesh>;
}
function Limb({length, width, color}: {length: number; width: number; color: string}) {
  return <mesh position={[0, -length / 2, 0]} castShadow><capsuleGeometry args={[width, Math.max(.01, length - width * 2), 6, 12]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;
}

export function Pessoa({t, position, rotation, coat = '#8a513c', action = 'idle', phase = 0, scale = 1}: {t: number; position?: V3; rotation?: V3; coat?: string; action?: 'idle'|'shoo'|'feed'|'walk'; phase?: number; scale?: number}) {
  const walk = action === 'walk', ph = t * 5 + phase, swing = walk ? Math.sin(ph) * .42 : 0;
  const skin = '#bd8c6c', hair = '#42372e';
  return <group position={position} rotation={rotation} scale={scale}>
    <group position={[0, walk ? Math.abs(Math.sin(ph)) * .035 : 0, 0]}>
      <Ball p={[0, 2.34, 0]} s={[.4, .59, .25]} color={coat}/>
      <Ball p={[0, 1.83, 0]} s={[.32, .22, .22]} color="#4b5050"/>
      <Ball p={[0, 2.92, 0]} s={[.105, .17, .1]} color={skin}/>
      <group position={[0, 3.2, .015]} rotation={[action === 'feed' ? .19 : .04, 0, 0]}>
        <Ball p={[0, 0, 0]} s={[.225, .28, .23]} color={skin}/>
        <Ball p={[0, .14, -.045]} s={[.23, .17, .215]} color={hair}/>
        <Ball p={[-.17, .04, -.05]} s={[.07, .14, .18]} color={hair}/>
        <Ball p={[0, -.018, .23]} s={[.046, .07, .062]} color={skin}/>
        <Ball p={[0, -.12, .209]} s={[.065, .015, .016]} color="#715046"/>
        {[-1, 1].map(side => <group key={side}>
          <Ball p={[side * .22, -.02, 0]} s={[.045, .07, .04]} color={skin}/>
          <Ball p={[side * .082, .045, .208]} s={[.043, .027, .021]} color="#eee4cf"/>
          <Ball p={[side * .082, .044, .227]} s={[.017, .02, .008]} color="#3a352f"/>
          <Ball p={[side * .082, .09, .208]} s={[.055, .013, .019]} color={hair}/>
        </group>)}
      </group>
      {[-1, 1].map(side => <group key={side}>
        <group position={[side * .18, 1.82, 0]} rotation={[swing * side, 0, 0]}>
          <Limb length={.86} width={.145} color="#505758"/>
          <group position={[0, -.86, 0]} rotation={[walk ? Math.max(0, -Math.sin(ph) * side) * .65 : .02, 0, 0]}>
            <Limb length={.81} width={.115} color="#505758"/>
            <Ball p={[0, -.86, .12]} s={[.14, .09, .25]} color="#3d3934"/>
          </group>
        </group>
        <group position={[side * .4, 2.69, 0]} rotation={[action === 'shoo' ? -1.35 + Math.sin(t * 11 + side) * .42 : action === 'feed' && side === 1 ? -.7 : -swing * side, 0, side * .12]}>
          <Limb length={.63} width={.12} color={coat}/>
          <group position={[0, -.63, 0]} rotation={[action === 'feed' && side === 1 ? -.65 + Math.sin(t * 3) * .14 : -.18, 0, 0]}>
            <Limb length={.55} width={.095} color={coat}/>
            <Ball p={[0, -.61, .015]} s={[.095, .13, .065]} color={skin}/>
            <Ball p={[-side * .075, -.57, .065]} s={[.035, .075, .035]} color={skin}/>
          </group>
        </group>
      </group>)}
      <mesh position={[0, 2.3, .251]} castShadow><boxGeometry args={[.018, .8, .016]}/><meshStandardMaterial color="#5e4436"/></mesh>
      {[0, 1, 2].map(i => <Ball key={i} p={[.045, 2.55 - i * .24, .256]} s={[.025, .025, .015]} color="#c4ae86"/>)}
    </group>
  </group>;
}

export function Cidade({t, mode = 'praca', seeds = 0, sky = true, nestOnly = false}: {t: number; mode?: 'praca'|'telhado'|'ninho'|'porto'; seeds?: number; sky?: boolean; nestOnly?: boolean}) {
  const high = mode === 'ninho' || mode === 'telhado';
  const arch = useMemo(() => architecture(high), [high]);
  const plaza = useMemo(street, []);
  const tex = useMemo(weatheredTexture, []);
  if (nestOnly) return <Ninho t={t}/>;
  return <group>
    {sky && <><SkyDome top="#6299bc" horizon="#d4dfdb" bottom="#a6b3b6"/><Clouds t={t} n={9} spread={100} height={31} center={[0, -45]}/></>}
    <Batch parts={arch.walls} texture={tex}/><Batch parts={arch.details}/><Batch parts={arch.leaves} shape="sphere"/>
    {high ? <>
      <mesh position={[0, -.45, .1]} receiveShadow castShadow><boxGeometry args={[6.5, .9, 4.7]}/><meshStandardMaterial color="#b2aaa0" map={tex} roughness={.95}/></mesh>
      <mesh position={[0, -.04, 0]} receiveShadow><boxGeometry args={[6.8, .08, 4.9]}/><meshStandardMaterial color="#c8bb9f" map={tex} roughness={.95}/></mesh>
      <mesh position={[0, .07, -2.2]} castShadow><boxGeometry args={[6.6, .14, .38]}/><meshStandardMaterial color="#c9bda6" map={tex}/></mesh>
      <mesh position={[0, .16, -2.2]} castShadow><boxGeometry args={[6.85, .06, .58]}/><meshStandardMaterial color="#e0d2b6"/></mesh>
      <mesh position={[-3.1, .09, 0]} castShadow><boxGeometry args={[.26, .18, 4.3]}/><meshStandardMaterial color="#b4a38c"/></mesh>
      <group position={[0, -13.06, -23]}><mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[100, 90]}/><meshStandardMaterial color="#959b96"/></mesh></group>
      {mode === 'ninho' && <Ninho t={t}/>}
    </> : <>
      <mesh position={[0, -.11, -12]} receiveShadow><boxGeometry args={[24, .14, 60]}/><meshStandardMaterial color="#8b8d80"/></mesh>
      <Batch parts={plaza.paving}/><Batch parts={plaza.boxes}/><Batch parts={plaza.foliage} shape="sphere"/>
      <group position={[0, 0, -9]}>
        <mesh position={[0, .16, 0]} receiveShadow castShadow><cylinderGeometry args={[1.75, 1.85, .32, 48]}/><meshStandardMaterial color="#a59b86"/></mesh>
        <mesh position={[0, .35, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1.65, .12, 10, 48]}/><meshStandardMaterial color="#c5b99c"/></mesh>
        <mesh position={[0, .29, 0]}><cylinderGeometry args={[1.53, 1.53, .03, 48]}/><meshStandardMaterial color="#65969a" roughness={.22} metalness={.15}/></mesh>
        <mesh position={[0, .75, 0]} castShadow><cylinderGeometry args={[.16, .3, 1.2, 20]}/><meshStandardMaterial color="#b5ab92"/></mesh>
        <mesh position={[0, 1.38, 0]}><cylinderGeometry args={[.67, .2, .16, 32]}/><meshStandardMaterial color="#c6bca2"/></mesh>
        <mesh position={[0, 1.45, 0]}><sphereGeometry args={[.13, 16, 12]}/><meshStandardMaterial color="#83c2cc" roughness={.2}/></mesh>
        {Array.from({length: 12}, (_, i) => {const a = i * Math.PI / 6; const drop = (t * .7 + i / 12) % 1; return <mesh key={i} position={[Math.cos(a) * (.4 + drop * .6), 1.4 - drop * drop, Math.sin(a) * (.4 + drop * .6)]} scale={[.025, .1, .025]}><sphereGeometry args={[1, 8, 6]}/><meshStandardMaterial color="#a7d5d8" roughness={.12}/></mesh>;})}
      </group>
      {mode === 'porto' && <group position={[0, -.1, -22]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[18, 25]}/><meshStandardMaterial color="#527d88" roughness={.28}/></mesh>
        <mesh position={[0, .45, -3]} scale={[2.8, .9, 5]}><sphereGeometry args={[1, 24, 12]}/><meshStandardMaterial color="#614c36" roughness={.9}/></mesh>
        <mesh position={[0, 3.6, -3]}><cylinderGeometry args={[.075, .1, 7, 12]}/><meshStandardMaterial color="#796343"/></mesh>
        <mesh position={[1.1, 4.3, -3]}><planeGeometry args={[2.2, 3.7]}/><meshStandardMaterial color="#d4c8a6" side={THREE.DoubleSide}/></mesh>
      </group>}
    </>}
    {seeds > 0 && <Sementes count={seeds}/>}
  </group>;
}
