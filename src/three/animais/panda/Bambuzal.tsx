import {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {Clouds, rnd, SkyDome} from '../../World';

type V3 = [number, number, number];
type Instance = {p: V3; s: V3; color: string; r?: V3};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const green = new THREE.Color('#618c33'), straw = new THREE.Color('#b69a55');
const shade = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t)).getStyle();

function leafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, -.028,.01,.1, -.042,.025,.27, -.018,.01,.46, 0,-.025,.62, .018,.01,.46, .042,.025,.27, .028,.01,.1, 0,.045,.25],3));
  g.setIndex([0,1,8,1,2,8,2,3,8,3,4,8,4,5,8,5,6,8,6,7,8,7,0,8]); g.computeVertexNormals();
  return g;
}

function barkTexture() {
  const n=128, data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const k=(y*n+x)*4;
    const scratch=rnd(Math.floor(x/2),9)>.89 ? 27 : 0;
    const v=217+Math.sin(x*.7)*10+rnd(x+y*n,7)*21-scratch;
    data[k]=v; data[k+1]=v; data[k+2]=v; data[k+3]=255;
  }
  const texture=new THREE.DataTexture(data,n,n); texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.needsUpdate=true;
  return texture;
}

function Instances({parts, shape='cylinder', texture}: {parts: Instance[]; shape?:'cylinder'|'leaf'|'ring'|'rock'|'sphere'; texture?: THREE.Texture}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  const leaf=useMemo(leafGeometry,[]);
  useLayoutEffect(()=>{
    const mesh=ref.current; if(!mesh) return;
    const dummy=new THREE.Object3D();
    parts.forEach((p,i)=>{
      dummy.position.set(...p.p); dummy.scale.set(...p.s); dummy.rotation.set(...(p.r??[0,0,0])); dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix); mesh.setColorAt(i,new THREE.Color(p.color));
    });
    mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true; mesh.computeBoundingSphere();
  },[parts]);
  if(!parts.length) return null;
  return <instancedMesh ref={ref} args={[undefined,undefined,parts.length]} castShadow={shape!=='leaf'} receiveShadow>
    {shape==='leaf'?<primitive object={leaf} attach="geometry"/>:shape==='ring'?<torusGeometry args={[1,.11,5,12]}/>:shape==='rock'?<dodecahedronGeometry args={[1,1]}/>:shape==='sphere'?<sphereGeometry args={[1,10,7]}/>:<cylinderGeometry args={[.96,1,1,10]}/>}
    <meshStandardMaterial map={texture} roughness={shape==='cylinder'?.7:.95} side={shape==='leaf'?THREE.DoubleSide:THREE.FrontSide}/>
  </instancedMesh>;
}

const put=(out:Instance[],p:V3,s:V3,color:string,r?:V3)=>out.push({p,s,color,r});
function segment(out:Instance[],a:V3,b:V3,radius:number,color:string) {
  const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), d=end.clone().sub(start);
  const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
  put(out,start.add(end).multiplyScalar(.5).toArray() as V3,[radius,d.length(),radius],color,[e.x,e.y,e.z]);
}

function bambooData(height:number,radius:number,dry:number,leaves:boolean,seed=0) {
  const stems:Instance[]=[], nodes:Instance[]=[], blades:Instance[]=[], flowers:Instance[]=[];
  const tint=green.clone().lerp(straw,clamp(dry)).getStyle();
  put(stems,[0,height/2,0],[radius,height,radius],tint);
  const steps=Math.max(2,Math.ceil(height/.63));
  for(let j=1;j<steps;j++) {
    const y=j*height/steps, angle=j*2.399+seed;
    put(nodes,[0,y,0],[radius*1.04,radius*1.04,radius*.53],shade('#a1b46c','#b4a071',dry),[Math.PI/2,0,0]);
    if(j<steps*.34 || !leaves) continue;
    const length=.38+rnd(j,seed+1)*.47;
    const end:V3=[Math.cos(angle)*length,y+.18,Math.sin(angle)*length];
    segment(stems,[0,y,0],end,.009,tint);
    for(let k=0;k<9;k++) {
      // Leaf shedding is local to the flowering stand, not the whole forest.
      if(dry>.65 && rnd(k+j*11,seed+2)<(dry-.65)*1.5) continue;
      const f=.23+k/12;
      const p:V3=[end[0]*f,y+.18*f,end[2]*f];
      const a=angle+(k%2?1:-1)*(.45+rnd(k,seed)*.9);
      put(blades,p,[.6+rnd(k,3)*.35,1,.75+rnd(k,4)*.55],shade(['#668c38','#407041','#83a34b'][k%3],'#bb9e58',dry),[.1+rnd(k,5)*.5,a,(rnd(k,6)-.5)*.3]);
    }
    if(dry>.08) for(let k=0;k<5;k++) {
      const f=k/5;
      put(flowers,[end[0]*(.7+f*.4),end[1]+.07+f*.12,end[2]*(.7+f*.4)],[.018,.035+f*.01,.018],shade('#b3b86d','#aa8851',dry));
    }
  }
  return {stems,nodes,blades,flowers};
}

export function ColmoBambu({height=2,radius=.045,dry=0,leaves=true}: {height?:number;radius?:number;dry?:number;leaves?:boolean}) {
  const data=useMemo(()=>bambooData(Math.max(.1,height),Math.max(.005,radius),clamp(dry),leaves),[height,radius,dry,leaves]);
  const texture=useMemo(barkTexture,[]);
  return <group><Instances parts={data.stems} texture={texture}/><Instances parts={data.nodes} shape="ring"/><Instances parts={data.blades} shape="leaf"/><Instances parts={data.flowers} shape="sphere"/></group>;
}

const trailX=(z:number)=>Math.max(0,-z)*.54+Math.sin(z*.45)*.28;
function groundY(x:number,z:number) {
  const distance=Math.hypot(x,z);
  const hills=Math.max(0,Math.min(1,(distance-4)/12));
  const streamZ=-10+Math.sin(x*.26)*1.3;
  const bed=Math.exp(-Math.pow((z-streamZ)/1.12,4));
  return hills*(.25+Math.sin(x*.3+z*.11)*.3+Math.cos(z*.29)*.16)-bed*.52;
}

function groundGeometry() {
  const g=new THREE.PlaneGeometry(62,66,105,110); g.rotateX(-Math.PI/2); g.translate(0,0,-12);
  const p=g.attributes.position, colors=new Float32Array(p.count*3);
  const dirt=new THREE.Color('#86714b'), moss=new THREE.Color('#607d43'), shadeColor=new THREE.Color('#485f37');
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i); p.setY(i,groundY(x,z)-.015);
    const trail=1-clamp((Math.abs(x-trailX(z))-.5)/.85);
    const c=shadeColor.clone().lerp(moss,rnd(i,4)*.65+.2).lerp(dirt,trail*.83);
    c.multiplyScalar(.86+rnd(i,3)*.24); colors.set([c.r,c.g,c.b],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3)); g.computeVertexNormals(); return g;
}

function forestData(season:number,localOnly=false) {
  const stems:Instance[]=[],nodes:Instance[]=[],blades:Instance[]=[],flowers:Instance[]=[];
  for(let i=0;i<360;i++) {
    const a=rnd(i,19)*Math.PI*2, distance=i<120?2.7+Math.sqrt(rnd(i,20))*8:7+Math.sqrt(rnd(i,20))*16;
    const x=Math.cos(a)*distance,z=Math.sin(a)*distance-2;
    if(Math.hypot(x,z)<2.25 || (z>0&&Math.abs(x)<10) || (z<1&&z>-8&&Math.abs(x-trailX(z))<1.05) || Math.abs(z+10-Math.sin(x*.26)*1.3)<1.1) continue;
    const height=4.2+rnd(i,21)*4.9, radius=.04+rnd(i,22)*.04;
    const local=x<-1.6&&z>-4.5&&z<4.5;
    if(local!==localOnly) continue;
    const dry=local?clamp(season):0;
    const data=bambooData(height,radius,dry,true,i+11), y=groundY(x,z);
    for(const [target,source] of [[stems,data.stems],[nodes,data.nodes],[blades,data.blades],[flowers,data.flowers]]) source.forEach(part=>target.push({...part,p:[part.p[0]+x,part.p[1]+y,part.p[2]+z]}));
  }
  return {stems,nodes,blades,flowers};
}

function understory() {
  const rocks:Instance[]=[], moss:Instance[]=[],leaves:Instance[]=[], flowers:Instance[]=[],stems:Instance[]=[];
  for(let i=0;i<90;i++) {
    const a=rnd(i,61)*Math.PI*2, d=2.4+rnd(i,62)*17,x=Math.cos(a)*d,z=Math.sin(a)*d-3;
    if(Math.abs(x-trailX(z))<.9) continue;
    const s=.13+rnd(i,63)*.65,y=groundY(x,z);
    put(rocks,[x,y+s*.27,z],[s,s*(.4+rnd(i,64)*.4),s*(.6+rnd(i,68)*.7)],['#7b8072','#8b8d7a','#697663'][i%3],[rnd(i,65),rnd(i,66),rnd(i,67)]);
    put(moss,[x,y+s*.82,z],[s*.8,.075,s*.65],'#688346');
  }
  for(let i=0;i<1600;i++) {
    const a=rnd(i,71)*Math.PI*2,d=.6+rnd(i,72)*20,x=Math.cos(a)*d,z=Math.sin(a)*d-2;
    if(Math.hypot(x,z)<.8) continue;
    put(leaves,[x,groundY(x,z)+.018,z],[.16+rnd(i,73)*.25,.2,.2+rnd(i,74)*.4],['#998650','#b2a36a','#6e7a44','#c0aa67'][i%4],[.04,rnd(i,75)*6.28,0]);
  }
  for(let i=0;i<75;i++) {
    const a=rnd(i,81)*6.28,d=2.4+rnd(i,82)*8,x=Math.cos(a)*d,z=Math.sin(a)*d;
    if(Math.abs(x-trailX(z))<1.2) continue;
    const y=groundY(x,z), h=.12+rnd(i,83)*.15;
    put(stems,[x,y+h/2,z],[.006,h,.006],'#72934d');
    for(let k=0;k<5;k++) put(flowers,[x+Math.cos(k*1.256)*.027,y+h,z+Math.sin(k*1.256)*.027],[.025,.012,.025],i%3?'#d9d9b1':'#b8b0cc');
    for(let k=0;k<8;k++) put(leaves,[x,y+.05,z],[.2,.5,.4],['#527942','#628e44'][k%2],[-.35,k*.785,.2]);
  }
  return {rocks,moss,leaves,flowers,stems};
}

function mountainGeometry(layer:number) {
  const g=new THREE.PlaneGeometry(160,30,80,12); const p=g.attributes.position;
  const colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i), f=(p.getY(i)+15)/30;
    const ridge=12+Math.sin(x*.087+layer*3)*5+Math.sin(x*.21+layer)*3+Math.sin(x*.49)*1.5;
    p.setXYZ(i,x,-2+f*ridge,-47-layer*17+(1-f)*8);
    const c=new THREE.Color(['#758d85','#91a5a0','#a6b7b2'][layer]).multiplyScalar(.85+f*.16+rnd(i,3)*.07);
    colors.set([c.r,c.g,c.b],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

function Stream({t}: {t:number}) {
  const geometry=useMemo(()=>{
    const g=new THREE.PlaneGeometry(48,1.55,80,6),p=g.attributes.position;
    for(let i=0;i<p.count;i++) {const x=p.getX(i), cross=p.getY(i);p.setXYZ(i,x,-.15+Math.sin(x*.45)*.015,-10+Math.sin(x*.26)*1.3+cross);}
    g.computeVertexNormals(); return g;
  },[]);
  return <group>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#658f87" metalness={.18} roughness={.28} side={THREE.DoubleSide}/></mesh>
    {Array.from({length:16},(_,i)=><mesh key={i} position={[-14+i*1.8+Math.sin(t*.4+i)*.08,-.125,-10+Math.sin((-14+i*1.8)*.26)*1.3]} rotation={[-Math.PI/2,0,Math.sin(i)*.2]} scale={[.45,.035,1]}><ringGeometry args={[.23,.25,24]}/><meshBasicMaterial color="#b9d0ba" transparent opacity={.22}/></mesh>)}
  </group>;
}

export function PilhaBambu({t:_t,consumed=0}: {t:number;consumed?:number}) {
  const n=Math.max(0,12-Math.floor(Math.max(0,consumed)));
  return <group>{Array.from({length:n},(_,i)=><group key={i} position={[(i%4)*.12-.18,.06+Math.floor(i/4)*.08,(i%3)*.06]} rotation={[0,(rnd(i,4)-.5)*.3,Math.PI/2+(rnd(i,5)-.5)*.1]}><ColmoBambu height={1.1+rnd(i,6)*.55} radius={.035} leaves={false}/></group>)}</group>;
}

export function Bambuzal({t,season=0,day=0}: {t:number;season?:number;day?:number}) {
  const stage=Math.round(clamp(season)*24)/24;
  const background=useMemo(()=>forestData(0),[]), local=useMemo(()=>forestData(stage,true),[stage]);
  const ground=useMemo(groundGeometry,[]), plants=useMemo(understory,[]),texture=useMemo(barkTexture,[]);
  const mountains=useMemo(()=>[0,1,2].map(mountainGeometry),[]);
  return <group>
    <SkyDome top="#88b5bc" horizon="#d9dfca" bottom="#b5c9b5"/>
    <Clouds t={t} n={7} spread={95} height={25} center={[0,-65]}/>
    <mesh position={[-25+clamp(day)*50,18+Math.sin(clamp(day)*Math.PI)*10,-77]}><sphereGeometry args={[2,20,16]}/><meshBasicMaterial color="#f1e6bd"/></mesh>
    {[2,1,0].map(i=><mesh key={i} geometry={mountains[i]}><meshStandardMaterial vertexColors roughness={1}/></mesh>)}
    <mesh geometry={ground} receiveShadow><meshStandardMaterial vertexColors map={texture} roughness={1}/></mesh>
    <Stream t={t}/>
    {[background,local].map((forest,i)=><group key={i}>
      <Instances parts={forest.stems} texture={texture}/><Instances parts={forest.nodes} shape="ring"/>
      <group rotation={[Math.sin(t*.75)*.001,0,Math.sin(t*.63)*.0015]}><Instances parts={forest.blades} shape="leaf"/><Instances parts={forest.flowers} shape="sphere"/></group>
    </group>)}
    <Instances parts={plants.rocks} shape="rock"/><Instances parts={plants.moss} shape="sphere"/>
    <Instances parts={plants.leaves} shape="leaf"/><Instances parts={plants.flowers} shape="sphere"/><Instances parts={plants.stems}/>
    {/* The same fallen trunk is present before the panda's rest scene. */}
    <group position={[-1.65,.32,1.35]} rotation={[0,.12,Math.PI/2]}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[.27,.32,2.7,18]}/><meshStandardMaterial color="#6e624a" map={texture} roughness={1}/></mesh>
      {[-1,1].map(side=><group key={side} position={[0,side*1.357,0]} rotation={[side*Math.PI/2,0,0]}>
        <mesh><circleGeometry args={[.265,24]}/><meshStandardMaterial color="#b4a078"/></mesh>
        {[.07,.13,.19,.24].map(r=><mesh key={r} position={[0,0,.002]}><ringGeometry args={[r-.004,r,32]}/><meshStandardMaterial color="#8e7855"/></mesh>)}
      </group>)}
      <mesh position={[.04,.1,-.28]} scale={[.22,.8,.08]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#6c8743" roughness={1}/></mesh>
    </group>
  </group>;
}
