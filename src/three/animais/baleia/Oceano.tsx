import * as THREE from 'three';
import {useMemo} from 'react';
import {rnd} from '../LagartixaComum';

const vertex=`varying vec3 worldPoint; void main(){vec4 p=modelMatrix*vec4(position,1.); worldPoint=p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}`;
const waterFragment=`uniform float clock; varying vec3 worldPoint; void main(){vec2 p=worldPoint.xz; float a=sin(p.x*2.4+sin(p.y*1.8+clock*.7))*sin(p.y*2.9-clock*.8); float b=sin(p.x*4.7-p.y*2.+clock*.5); float foam=pow(max(0.,a*.6+b*.4),5.); vec3 color=mix(vec3(.08,.36,.45),vec3(.48,.85,.86),foam); gl_FragColor=vec4(color,.56+foam*.2);}`;
const backgroundFragment=`uniform float waterLevel; varying vec3 worldPoint; void main(){float h=clamp((worldPoint.y+13.)/30.,0.,1.); vec3 sea=mix(vec3(.012,.07,.14),vec3(.035,.48,.57),h); float skyHeight=clamp((worldPoint.y-waterLevel)/55.,0.,1.); vec3 sky=mix(vec3(.76,.91,.94),vec3(.22,.57,.79),skyHeight); gl_FragColor=vec4(worldPoint.y>waterLevel?sky:sea,1.);}`;
export function Oceano({t,cold=false,surface=2}:{t:number;cold?:boolean;surface?:number}){
 const water=useMemo(()=>{const g=new THREE.PlaneGeometry(90,90,70,70);g.rotateX(-Math.PI/2);return g;},[]);
 const points=water.attributes.position;
 for(let i=0;i<points.count;i++)points.setY(i,.045*Math.sin(points.getX(i)*1.6+t*1.1)+.035*Math.sin(points.getZ(i)*2.2-t*.8));
 points.needsUpdate=true;
 const waterUniforms=useMemo(()=>({clock:{value:0}}),[]);waterUniforms.clock.value=t;
 const dust=useMemo(()=>{const a=new Float32Array(240*3);for(let i=0;i<240;i++){a[i*3]=(rnd(i+31)-.5)*25;a[i*3+1]=-6+rnd(i+54)*8;a[i*3+2]=(rnd(i+86)-.5)*25;}return a;},[]);
 const ground=useMemo(()=>{const g=new THREE.PlaneGeometry(90,90,36,36);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.25*Math.sin(p.getX(i)*.35)+.18*Math.cos(p.getZ(i)*.5));g.computeVertexNormals();return g;},[]);
 return <>
 <mesh><sphereGeometry args={[75,32,20]}/><shaderMaterial vertexShader={vertex} fragmentShader={backgroundFragment} uniforms={{waterLevel:{value:surface}}} side={THREE.BackSide} depthWrite={false}/></mesh>
 <fog attach="fog" args={[cold?'#155f78':'#076478',10,42]}/>
 <mesh position={[0,surface,0]} geometry={water}><shaderMaterial vertexShader={vertex} fragmentShader={waterFragment} uniforms={waterUniforms} transparent side={THREE.DoubleSide} depthWrite={false}/></mesh>
 {Array.from({length:9},(_,i)=><mesh key={'ray'+i} position={[(i-4)*3.6,-3,-9-i%3]} rotation={[0,0,-.2]}><coneGeometry args={[.5,18,16,1,true]}/><meshBasicMaterial color="#b9eff3" transparent opacity={.016} depthWrite={false} side={THREE.DoubleSide}/></mesh>)}
 <points position={[Math.sin(t*.09)*.12,Math.sin(t*.12)*.1,0]}><bufferGeometry><bufferAttribute attach="attributes-position" args={[dust,3]}/></bufferGeometry><pointsMaterial color="#cff5e9" size={.025} transparent opacity={.36} depthWrite={false} sizeAttenuation/></points>
 {Array.from({length:16},(_,i)=><group key={'f'+i} position={[-10+((i*1.3+t*.3)%20),-3.5+rnd(i+77)*2,-13-rnd(i)*7]}><mesh scale={[.14,.045,.025]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#609fa6"/></mesh><mesh position={[.16,0,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[.05,.1,3]}/><meshStandardMaterial color="#609fa6"/></mesh></group>)}
 <mesh position={[0,-7.7,0]} geometry={ground}><meshStandardMaterial color="#536e70" roughness={1}/></mesh>
 {Array.from({length:22},(_,i)=><mesh key={'rock'+i} position={[(rnd(i+100)-.5)*35,-7.6,-5-rnd(i+150)*24]} rotation={[.1,i,.2]} scale={[.6+rnd(i)*2,.35+rnd(i+3),.6+rnd(i+10)]}><dodecahedronGeometry args={[1,1]}/><meshStandardMaterial color={i%3?'#426c72':'#68827d'} flatShading roughness={1}/></mesh>)}
 </>;
}
