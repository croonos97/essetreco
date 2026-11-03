import {AbsoluteFill,useCurrentFrame,useVideoConfig} from "remotion";
import {Pombo} from "../three/animais/pombo/Pombo";
 import {Cidade,Pessoa} from "../three/animais/pombo/Cidade";
import {Falco} from "../three/animais/pombo/Falco";
import {PalcoNoite,LagCam,LKey} from "../three/animais/LagartixaComum";
export const PomboLab=()=>{
 const t=useCurrentFrame()/useVideoConfig().fps; const view=Math.floor(t/5);
 const cams:[number,number,number][]=[[1.5,1,2.2],[1.4,.65,.3],[.8,.55,1.2],[1.5,1.2,2.3],[2,2,5],[1.6,1,2.5]];
 const pos=cams[view%cams.length];const keys:LKey[]=[{t:0,pos,look:[0,.35,0],fov:38},{t:100,pos,look:[0,.35,0],fov:38}];
 return <AbsoluteFill><PalcoNoite fundo="#a3c5d5" sombras><LagCam t={t} keys={keys} deriva={0}/><ambientLight intensity={1.3}/><directionalLight castShadow position={[3,7,5]} intensity={3} shadow-mapSize={[1024,1024]}/><hemisphereLight args={["#d4f1ff","#7e6550",1]}/><Cidade t={t} mode="ninho"/>{view===2?<><Pombo t={t} baby beak={.3}/></>:view===3?<Falco t={t} position={[0,.1,0]} flap={.4}/>:view===4?<><Pombo t={t}/><Pessoa t={t} position={[1,0,-1]} coat="#a44335" action="idle"/></>:<Pombo t={t} walk={view===1?.5:0} flap={view===5?.8:0}/>}</PalcoNoite></AbsoluteFill>
};
