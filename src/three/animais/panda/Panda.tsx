import {useMemo} from "react";
import * as THREE from "three";
import {Furry, furTexture, makeFur, FurMat, KIT} from "../comum";

export type V3 = [number, number, number];
export type PandaProps = {
  t:number; position?:V3; rotation?:V3; scale?:number;
  pose?:"eat"|"sit"|"walk"|"rest"; chew?:number; grip?:number;
  bamboo?:boolean; mouthOpen?:number; reach?:number; peel?:number;
};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
const point=(a:V3,b:V3,u:number):V3=>a.map((v,i)=>lerp(v,b[i],u)) as V3;
const rnd=(i:number)=>{const n=Math.sin(i*127.1+37.4)*43758.5453;return n-Math.floor(n);};

function eyePatch(side:number) {
  const positions:number[]=[],indices:number[]=[],uv:number[]=[];
  for(let j=0;j<=12;j++)for(let i=0;i<=40;i++) {
    const radius=j/12, a=i/40*Math.PI*2;
    const u=Math.cos(a)*.080*radius,v=Math.sin(a)*.120*radius;
    const angle=side*-.30;
    const x=side*.137+u*Math.cos(angle)-v*Math.sin(angle),y=.011+u*Math.sin(angle)+v*Math.cos(angle);
    const z=.246*Math.sqrt(Math.max(.025,1-(x/.294)**2-(y/.283)**2))+.020;
    positions.push(x,y,z);uv.push((Math.cos(a)*radius+1)/2,(Math.sin(a)*radius+1)/2);
    if(j<12&&i<40){const k=j*41+i;indices.push(k,k+41,k+1,k+1,k+41,k+42);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function usePandaKit() {
  return useMemo(()=>{
    const sphere=new THREE.SphereGeometry(1,40,28);
    const std=(color:string,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness});
    const white=makeFur({map:furTexture("#e9e6da","#efede4",41,12000),len:.018,dens:210,rootDark:.12,tip:.1,clump:.42,flow:[0,-.6,.1]});
    const black=makeFur({map:furTexture("#202329","#292c30",52,10000),len:.015,dens:235,rootDark:.16,tip:.16,clump:.43,flow:[0,-.6,.15]});
    const shape=new THREE.Shape();shape.moveTo(-.060,.020);shape.quadraticCurveTo(0,.040,.060,.020);shape.quadraticCurveTo(.061,-.014,0,-.038);shape.quadraticCurveTo(-.062,-.014,-.060,.020);
    return {sphere,patches:[eyePatch(-1),eyePatch(1)],noseGeo:new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.008,bevelThickness:.008}),white,black,
      skin:std("#202126",.7),nose:std("#17191b",.3),eye:std("#17110c",.12),iris:std("#71502c",.34),spark:new THREE.MeshBasicMaterial({color:"#fff5df"}),mouth:std("#331f24",.8),tongue:std("#c07d82",.7),tooth:std("#e4d5b7",.45),bone:std("#ded4bb",.68),sesamoid:std("#e7b34d",.5),muscle:std("#9a4c45",.72),bamboo:std("#697b39",.74),node:std("#8a9753",.8),inner:std("#e3cf8c",.88),bark:std("#b2a264",.9),ghost:new THREE.MeshStandardMaterial({color:"#a6b8bc",transparent:true,opacity:.18,depthWrite:false,roughness:.75,side:THREE.DoubleSide})};
  },[]);
}
type Kit=ReturnType<typeof usePandaKit>;
function Oval({p,s,m,g,r=[0,0,0]}:{p:V3;s:V3;m:THREE.Material;g:THREE.BufferGeometry;r?:V3}) {
  return <mesh geometry={g} position={p} scale={s} rotation={r} material={m} castShadow receiveShadow/>;
}
function FurOval({p,s,fur,g,r=[0,0,0],shells=7}:{p:V3;s:V3;fur:FurMat;g:THREE.BufferGeometry;r?:V3;shells?:number}) {
  return <Furry geo={g} fur={fur} position={p} scale={s} rotation={r} shells={Math.round(shells*KIT.peloMult)}/>;
}
function Segment({a,b,r1,r2,m}:{a:V3;b:V3;r1:number;r2?:number;m:THREE.Material}) {
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
  return <mesh material={m} position={p.add(q).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize())} castShadow receiveShadow><cylinderGeometry args={[r2??r1,r1,d.length(),12]}/></mesh>;
}
function FurLimb({a,b,width,kit}:{a:V3;b:V3;width:number;kit:Kit}) {
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
  return <group position={p.add(q).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize())}><FurOval p={[0,0,0]} s={[width,d.length()*.5+width*.35,width*.92]} fur={kit.black} g={kit.sphere}/></group>;
}
function BambooStem({a,b,kit,peeled=0}:{a:V3;b:V3;kit:Kit;peeled?:number}) {
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),len=d.length();
  return <group position={a} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize())}>
    <mesh position={[0,len*.5,0]} material={kit.bamboo} castShadow><cylinderGeometry args={[.024,.030,len,18]}/></mesh>
    {[.10,.35,.60,.83].map(u=><mesh key={u} material={kit.node} position={[0,len*u,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[lerp(.030,.024,u),.003,6,20]}/></mesh>)}
    <mesh position={[0,len+.001,0]} rotation={[-Math.PI/2,0,0]} material={kit.inner}><circleGeometry args={[.024,20]}/></mesh>
    {peeled>0&&<mesh position={[.002,len-.052, .0235]} scale={[.018,.068,.005]} material={kit.inner} geometry={kit.sphere}/>} 
    {Array.from({length:7},(_,i)=><mesh key={i} position={[Math.cos(i*.9)*.024,len-.023,Math.sin(i*.9)*.024]} material={kit.inner}><cylinderGeometry args={[.0008,.0012,.046+rnd(i)*.025,4]}/></mesh>)}
  </group>;
}

// Five short digits curl over the stem; the radial sesamoid stays attached to the wrist.
function Paw({kit,grip=1,xray=0,bamboo=false}:{kit:Kit;grip?:number;xray?:number;bamboo?:boolean}) {
  const g=clamp(grip),x=clamp(xray);
  const skin=x>.05?kit.ghost:kit.skin;
  return <group>
    {x<.05?<FurOval p={[0,-.024,-.020]} s={[.105,.130,.064]} fur={kit.black} g={kit.sphere} shells={5}/>:<Oval p={[0,-.024,-.020]} s={[.105,.130,.064]} m={skin} g={kit.sphere}/>}
    <Oval p={[0,-.025,.042]} s={[.075,.085,.015]} m={skin} g={kit.sphere}/>
    {[-2,-1,0,1,2].map((n,i)=>{
      const root:V3=[n*.036,.055-Math.abs(n)*.007,.004];
      const mid:V3=[n*.035,root[1]+.060-g*.014,.012+g*.062];
      const tip:V3=[n*.032,root[1]+.090-g*.041,.015+g*.098];
      return <group key={n}>
        <Segment a={root} b={mid} r1={.021} r2={.019} m={skin}/><Oval p={mid} s={[.021,.023,.021]} m={skin} g={kit.sphere}/><Segment a={mid} b={tip} r1={.018} r2={.014} m={skin}/>
        <Segment a={tip} b={[tip[0],tip[1]-.009,tip[2]+.014]} r1={.007} r2={.002} m={kit.nose}/>
        {x>0&&<><Segment a={[n*.020,-.060,-.007]} b={root} r1={.009} m={kit.bone}/><Segment a={root} b={mid} r1={.007} m={kit.bone}/><Segment a={mid} b={tip} r1={.0055} m={kit.bone}/></>}
      </group>;
    })}
    <Oval p={[-.101,-.063,.031]} s={[.038,.059,.034]} m={skin} g={kit.sphere} r={[0,0,-.40]}/>
    {x>0&&<><Oval p={[-.096,-.067,.030]} s={[.018,.043,.017]} m={kit.sesamoid} g={kit.sphere} r={[0,0,-.40]}/>{Array.from({length:7},(_,i)=><Oval key={i} p={[(i%3-1)*.026,-.078-Math.floor(i/3)*.023,-.005]} s={[.020,.014,.015]} m={kit.bone} g={kit.sphere}/>)}</>}
    {bamboo&&<BambooStem a={[0,-.25,.084]} b={[0,.29,.084]} kit={kit}/>}
  </group>;
}
export function PataPanda({t,grip=1,xray=0,bamboo=true}:{t:number;grip?:number;xray?:number|boolean;bamboo?:boolean}) {
  const kit=usePandaKit();
  return <group><Paw kit={kit} grip={grip} xray={typeof xray==="boolean"?Number(xray):xray} bamboo={bamboo}/></group>;
}

function Molar({p,lower,kit}:{p:V3;lower:boolean;kit:Kit}) {
  const direction=lower?1:-1;
  return <group position={p}>
    <Oval p={[0,0,0]} s={[.033,.021,.043]} m={kit.tooth} g={kit.sphere}/>
    {[-1,1].flatMap(x=>[-1,1].map(z=><Oval key={x+":"+z} p={[x*.014,direction*.014,z*.022]} s={[.013,.012,.016]} m={kit.tooth} g={kit.sphere}/>))}
  </group>;
}
export function MandibulaPanda({t,chew=1,cutaway=true}:{t:number;chew?:number;cutaway?:boolean}) {
  const kit=usePandaKit(),gap=.015+clamp(chew)*(.5+.5*Math.sin(t*8.5))*.13;
  return <group>
    <Oval p={[0,.15,-.04]} s={[.205,.135,.245]} m={cutaway?kit.ghost:kit.bone} g={kit.sphere}/>
    {[-1,1].map(side=><group key={side}>
      <Segment a={[side*.147,.11,-.18]} b={[side*.118,.055,.16]} r1={.042} m={kit.bone}/>
      {[0,1,2,3].map(i=><Molar key={i} p={[side*.109,.025,-.125+i*.078]} lower={false} kit={kit}/>)}
    </group>)}
    <group position={[0,0,-.20]} rotation={[gap,0,0]}>
      <group position={[0,0,.20]}>
        {[-1,1].map(side=><group key={side}>
          <Segment a={[side*.15,.055,-.20]} b={[side*.13,-.11,-.12]} r1={.037} m={kit.bone}/>
          <Segment a={[side*.13,-.11,-.12]} b={[side*.10,-.105,.19]} r1={.039} m={kit.bone}/>
          {[0,1,2,3].map(i=><Molar key={i} p={[side*.109,-.031,-.125+i*.078]} lower kit={kit}/>)}
          {cutaway&&<Oval p={[side*.17,.045,-.095]} s={[.035,.142-gap*.08,.081]} m={kit.muscle} g={kit.sphere} r={[.12,0,side*.1]}/>}
        </group>)}
        <Segment a={[-.10,-.10,.19]} b={[.10,-.10,.19]} r1={.034} m={kit.bone}/>
        {Array.from({length:6},(_,i)=><Oval key={i} p={[(i-2.5)*.025,-.050,.205]} s={[.012,.024,.016]} m={kit.tooth} g={kit.sphere}/>)}
      </group>
    </group>
    {Array.from({length:6},(_,i)=><Oval key={i} p={[(i-2.5)*.025,.009,.205]} s={[.012,.019,.016]} m={kit.tooth} g={kit.sphere}/>)}
  </group>;
}

export function Panda({t,position=[0,0,0],rotation=[0,0,0],scale=1,pose="eat",chew=1,grip=1,bamboo=true,mouthOpen=0,reach=1,peel}:PandaProps) {
  const kit=usePandaKit(),walking=pose==="walk",rest=pose==="rest",eating=pose==="eat";
  const ch=eating?clamp(chew):0,cycle=.5+.5*Math.sin(t*8.5),jaw=Math.max(clamp(mouthOpen)*.070,ch*(.012+cycle*.040));
  const r=clamp(reach),lift=(1-r)*.52;
  const tip:V3=[.025,.94-lift,.53+(1-r)*.28];
  const stemLength=Math.hypot(.155,.72,.17);
  const stemAxis=new THREE.Vector3(lerp(.88,.155/stemLength,r),lerp(.33,.72/stemLength,r),lerp(.34,-.17/stemLength,r)).normalize();
  const base=tip.map((v,i)=>v-stemAxis.getComponent(i)*stemLength) as V3;
  const holding=bamboo&&!walking&&!rest;
  const c=peel===undefined?ch:clamp(peel);
  const headP:V3=walking?[0,.69,.47]:[0,1.055,.17];
  const bodyP:V3=walking?[0,.50,-.06]:[0,.52,-.03];
  const bellyScale:V3=walking?[.31,.34,.50]:[.405,.485,.335];
  const bodyRotation:V3=rest?[-.47,0,0]:[0,0,0];
  return <group position={position} rotation={rotation} scale={scale}>
    <group rotation={bodyRotation} position={rest?[0,.10,-.14]:[0,0,0]}>
      <FurOval p={bodyP} s={bellyScale} fur={kit.white} g={kit.sphere} r={walking?[.10,0,0]:[-.10,0,0]} shells={9}/>
      <FurOval p={walking?[0,.64,.25]:[0,.80,-.045]} s={walking?[.33,.24,.20]:[.354,.185,.294]} fur={kit.black} g={kit.sphere}/>
      <FurOval p={walking?[0,.47,-.53]:[0,.21,-.33]} s={[.077,.082,.075]} fur={kit.white} g={kit.sphere}/>
      {[-1,1].map(side=>{
        const step=walking?Math.sin(t*5.8+(side<0?Math.PI:0))*.19:0;
        return <group key={side}>
          <FurOval p={walking?[side*.235,.30,-.37]:[side*.32,.23,.015]} s={walking?[.13,.27,.16]:[.205,.237,.23]} fur={kit.black} g={kit.sphere} r={[step,0,side*-.14]}/>
          <FurOval p={walking?[side*.235,.11,-.36+step*.3]:[side*.345,.115,.31]} s={[.137,.115,.229]} fur={kit.black} g={kit.sphere} r={[0,side*.25,0]}/>
          <Oval p={walking?[side*.235,.073,-.145+step*.3]:[side*.345,.09,.50]} s={[.085,.055,.024]} m={kit.skin} g={kit.sphere}/>
          {Array.from({length:5},(_,i)=><Oval key={i} p={walking?[side*.235+(i-2)*.035,.068,-.130+step*.3]:[side*.345+(i-2)*.036,.075,.515-Math.abs(i-2)*.007]} s={[.011,.012,.030]} m={kit.nose} g={kit.sphere} r={[.18,0,0]}/>)}
        </group>;
      })}
      {[-1,1].map(side=>{
        const u=side<0?.60:.78,gp=point(base,tip,u);
        const hand:V3=holding?[gp[0]+side*.047,gp[1]-.037,gp[2]-.075]:walking?[side*.255,.095,.43+Math.sin(t*5.8+(side<0?0:Math.PI))*.11]:[side*.34,.38,.31];
        const shoulder:V3=walking?[side*.25,.64,.30]:[side*.30,.81,.03];
        const elbow:V3=holding?[side*.30,lerp(.52,gp[1]-.10,.6),.33]:walking?[side*.26,.40,.38]:[side*.39,.56,.23];
        return <group key={side}>
          <FurLimb a={shoulder} b={elbow} width={.133} kit={kit}/><FurLimb a={elbow} b={hand} width={.105} kit={kit}/>
          <group position={hand} rotation={walking?[Math.PI*.5,0,0]:[0,0,-side*.22]} scale={[side*.85,.85,.85]}><Paw kit={kit} grip={holding?grip:.3}/></group>
        </group>;
      })}
      <group position={headP} rotation={rest?[-.15,0,.10]:[0,Math.sin(t*.55)*.020,0]}>
        <FurOval p={[0,0,0]} s={[.294,.283,.246]} fur={kit.white} g={kit.sphere} shells={9}/>
        {[-1,1].map((side,i)=><group key={side}>
          <FurOval p={[side*.240,.222,-.035]} s={[.105,.108,.069]} fur={kit.black} g={kit.sphere} r={[.04,side*.18,side*-.18]}/>
          <Oval p={[side*.246,.230,.019]} s={[.071,.071,.011]} m={kit.skin} g={kit.sphere}/>
          <Furry geo={kit.patches[i]} fur={kit.black} shells={Math.round(5*KIT.peloMult)}/>
          <Oval p={[side*.124,.027,.262]} s={[.027,.024,.016]} m={kit.eye} g={kit.sphere}/>
          <Oval p={[side*.121,.028,.276]} s={[.013,.014,.004]} m={kit.iris} g={kit.sphere}/>
          <Oval p={[side*.121,.028,.279]} s={[.008,.010,.003]} m={kit.eye} g={kit.sphere}/>
          <Oval p={[side*.115,.035,.283]} s={[.004,.004,.002]} m={kit.spark} g={kit.sphere}/>
          <FurOval p={[side*.057,-.080,.252]} s={[.110,.072,.086]} fur={kit.white} g={kit.sphere} shells={5}/>
          {Array.from({length:5},(_,j)=><Oval key={j} p={[side*(.045+j%2*.025),-.081-Math.floor(j/2)*.015,.332-j%2*.005]} s={[.0018,.0018,.0018]} m={kit.nose} g={kit.sphere}/>)}
        </group>)}
        <Oval p={[0,-.136,.290]} s={[.125,.016+jaw*.7,.056]} m={kit.mouth} g={kit.sphere}/>
        <group position={[Math.sin(t*8.5)*ch*.006,-jaw,0]}>
          <FurOval p={[0,-.172,.255]} s={[.130,.054,.085]} fur={kit.white} g={kit.sphere} shells={5}/>
          <Oval p={[0,-.144,.300]} s={[.075,.008,.031]} m={kit.tongue} g={kit.sphere}/>
          {[-2,-1,0,1,2].map(i=><Oval key={i} p={[i*.024,-.130,.329]} s={[.010,.010,.013]} m={kit.tooth} g={kit.sphere}/>)}
        </group>
        {[-2,-1,0,1,2].map(i=><Oval key={i} p={[i*.024,-.117,.331]} s={[.009,.009,.012]} m={kit.tooth} g={kit.sphere}/>)}
        <mesh geometry={kit.noseGeo} material={kit.nose} position={[0,-.063,.329]} castShadow/>
        <Segment a={[0,-.095,.342]} b={[0,-.122,.340]} r1={.003} m={kit.nose}/>
      </group>
      {holding&&<BambooStem a={base} b={tip} kit={kit} peeled={c}/>}
      {holding&&c>0&&Array.from({length:5},(_,i)=>{
        const u=((t*.75+i*.19)%1+1)%1,fall=u*u*.78;
        const p:V3=[tip[0]+(rnd(i+1)-.5)*.19*u,tip[1]-.035-fall,tip[2]+.045+u*.15];
        return <mesh key={i} position={p} rotation={[u*3+i,u+i*.7,i*.8]} scale={[.008,c*.07*(.7+rnd(i)),.0025]} material={i%2?kit.bark:kit.inner} castShadow><boxGeometry args={[1,1,1]}/></mesh>;
      })}
    </group>
  </group>;
}
