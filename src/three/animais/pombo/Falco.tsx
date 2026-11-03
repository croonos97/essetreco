import {useMemo} from 'react';
import * as THREE from 'three';

type V3 = [number, number, number];
const slate = '#626b6e', dark = '#333a3c', pale = '#ddd3b7', gold = '#d8ae47';
const bodyGeo = new THREE.SphereGeometry(1, 24, 18);
const materials = Object.fromEntries([slate, dark, pale, gold, '#121a22', '#a9a392', '#efe8d1', '#71808b'].map(color => [color, new THREE.MeshStandardMaterial({color, roughness: .8})]));

function Ellipsoid({p, s, color, r}: {p: V3; s: V3; color: string; r?: V3}) {
  return <mesh geometry={bodyGeo} material={materials[color]} position={p} scale={s} rotation={r} castShadow/>;
}

function Toe({a, b, radius = .013, color = gold}: {a: V3; b: V3; radius?: number; color?: string}) {
  const transform = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    return {p: va.add(vb).multiplyScalar(.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), length: d.length()};
  }, [a.join(), b.join()]);
  return <mesh position={transform.p} quaternion={transform.q} material={materials[color]} castShadow><cylinderGeometry args={[radius * .75, radius, transform.length, 8]}/></mesh>;
}

function wingGeometry() {
  // Swept leading edge, narrow pointed hand: the peregrine silhouette.
  const outline = new THREE.Shape();
  outline.moveTo(0, .09); outline.quadraticCurveTo(.32, .16, .57, .02);
  outline.lineTo(1.09, -.48); outline.quadraticCurveTo(.83, -.45, .63, -.34);
  outline.lineTo(.26, -.23); outline.lineTo(0, -.19); outline.closePath();
  const g = new THREE.ExtrudeGeometry(outline, {depth: .025, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .014, bevelThickness: .01, curveSegments: 8});
  g.rotateX(Math.PI / 2);
  return g;
}

function Wing({side, t, flap}: {side: number; t: number; flap: number}) {
  const geometry = useMemo(wingGeometry, []);
  const beat = Math.sin(t * Math.PI * 2 * 3.4) * .65 * flap;
  return <group position={[side * .12, .46, -.025]} rotation={[0, 0, side * (.08 + beat)]}>
    <group scale={[side, 1, 1]}>
      <mesh geometry={geometry} material={materials[slate]} castShadow/>
      <Ellipsoid p={[.23, -.002, -.075]} s={[.3, .044, .17]} color={slate} r={[0, .16, 0]}/>
      {Array.from({length: 8}, (_, i) => {
        const f = i / 7;
        return <Ellipsoid key={i} p={[.4 + f * .56, -.018, -.16 - f * .22]} s={[.035 - f * .014, .016, .21 - f * .09]} r={[0, -.47 - f * .27, 0]} color={i % 2 ? dark : slate}/>;
      })}
      {Array.from({length: 6}, (_, i) => <Ellipsoid key={i} p={[.12 + i * .065, -.043, -.07 - i * .025]} s={[.047, .012, .13]} color={i % 2 ? '#71808b' : slate} r={[0, -.18, 0]}/>)}
    </group>
  </group>;
}

/** Peregrine, forward +Z, feet at Y=0; span approximately 2.4 units. */
export function Falco({t, position, rotation, scale = 1, flap = 0}: {t: number; position?: V3; rotation?: V3; scale?: number; flap?: number}) {
  const intensity = Math.max(0, Math.min(1, flap));
  return <group position={position} rotation={rotation} scale={scale}>
    <Ellipsoid p={[0, .4, -.035]} s={[.19, .23, .34]} color={slate} r={[-.19, 0, 0]}/>
    <Ellipsoid p={[0, .345, .105]} s={[.16, .2, .245]} color={pale} r={[-.2, 0, 0]}/>
    {/* Individually curved breast bars follow the pale chest rather than a flat decal. */}
    {Array.from({length: 8}, (_, row) => {
      const y = .2 + row * .036;
      const width = .085 + Math.sin(row / 8 * Math.PI) * .047;
      return <group key={row}>
        {[-1, 1].map(side => <Ellipsoid key={side} p={[side * width * .52, y, .294 + Math.sin(row / 8 * Math.PI) * .034]} s={[width * .47, .006, .009]} r={[0, side * .28, side * .12]} color={dark}/>)}
      </group>;
    })}
    <Ellipsoid p={[0, .59, .24]} s={[.133, .16, .15]} color={dark}/>
    <Ellipsoid p={[0, .5, .29]} s={[.105, .085, .105]} color={'#efe8d1'}/>
    {[-1, 1].map(side => <group key={side}>
      <Ellipsoid p={[side * .109, .552, .283]} s={[.029, .062, .045]} color={pale}/>
      <Ellipsoid p={[side * .097, .524, .323]} s={[.028, .082, .032]} color={dark} r={[.16, 0, side * .16]}/>
      <Ellipsoid p={[side * .121, .603, .303]} s={[.012, .024, .026]} color={gold}/>
      <Ellipsoid p={[side * .133, .603, .307]} s={[.009, .018, .02]} color={'#121a22'}/>
      <Ellipsoid p={[side * .139, .61, .314]} s={[.0035, .0045, .004]} color={'#efe8d1'}/>
      <Ellipsoid p={[side * .113, .637, .301]} s={[.026, .019, .052]} color={dark} r={[0, 0, side * -.12]}/>
    </group>)}
    <Ellipsoid p={[0, .571, .379]} s={[.063, .037, .055]} color={gold}/>
    <Ellipsoid p={[0, .554, .425]} s={[.04, .036, .054]} color={'#121a22'} r={[.34, 0, 0]}/>
    <Ellipsoid p={[0, .525, .453]} s={[.023, .042, .019]} color={'#121a22'} r={[-.3, 0, 0]}/>
    {[-1, 1].map(side => <Ellipsoid key={side} p={[side * .031, .583, .41]} s={[.007, .005, .008]} color={dark}/>)}
    {/* Narrow, barred tail; stacked tapered feathers leave a visible rounded fan. */}
    {Array.from({length: 7}, (_, i) => <group key={i} rotation={[0, (i - 3) * .035, 0]}>
      <Ellipsoid p={[(i - 3) * .025, .369, -.452]} s={[.033, .019, .215]} color={i % 2 ? slate : dark} r={[-.09, 0, 0]}/>
      {[0, 1, 2].map(b => <Ellipsoid key={b} p={[(i - 3) * .025, .349 - b * .007, -.35 - b * .105]} s={[.032, .004, .014]} color={'#a9a392'}/>)}
    </group>)}
    <Wing side={-1} t={t} flap={intensity}/><Wing side={1} t={t} flap={intensity}/>
    {[-1, 1].map(side => <group key={side} position={[side * .09, 0, .025]}>
      <Ellipsoid p={[0, .185, 0]} s={[.065, .105, .07]} color={pale}/>
      <Toe a={[0, .15, .01]} b={[0, .035, .035]} radius={.021}/>
      {[-1, 0, 1].map(toe => {
        const x = toe * .048, z = .13 - Math.abs(toe) * .02;
        return <group key={toe}>
          <Toe a={[0, .035, .035]} b={[x, .018, z]}/>
          <Toe a={[x, .018, z]} b={[x, .008, z + .032]} radius={.008} color={'#121a22'}/>
        </group>;
      })}
      <Toe a={[0, .035, .035]} b={[-side * .025, .015, -.055]}/>
      <Toe a={[-side * .025, .015, -.055]} b={[-side * .025, .005, -.08]} radius={.008} color={'#121a22'}/>
    </group>)}
  </group>;
}
