import {AbsoluteFill,Audio,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {ReactNode} from 'react';
import * as THREE from 'three';
import timelineJson from '../../public/baleia/timeline.json';
import {cena,Timeline,Word,wordAt} from '../engine/timeline';
import {FONT_KIT,Legenda1Palavra,useKitFont} from '../three/animais/ui';
import {LagCam,LKey,PalcoNoite,V3,mix,seg01} from '../three/animais/LagartixaComum';
import {Jubarte} from '../three/animais/baleia/Jubarte';
import {Oceano} from '../three/animais/baleia/Oceano';

const TL=timelineJson as Timeline,OFF=.5;
const S=(id:string)=>cena(TL,id).start+OFF;
const W=(id:string,word:string,n=0)=>wordAt(TL,id,word,n)+OFF;
export const baleiaDuration=(fps:number)=>Math.ceil((TL.duration+.9)*fps);
const END=baleiaDuration(30)/30;
const wide:V3=[-.5,-.8,13],look:V3=[.2,-.25,0];
type Plan={id:string;from:number;to:number;keys:LKey[];action:(t:number)=>ReactNode;note?:string;cold?:boolean};
const plans:Plan[]=[];
function add(id:string,from:number,to:number,pos:V3,target:V3,action:Plan['action'],opts:{end?:V3;endLook?:V3;note?:string;cold?:boolean}={}){plans.push({id,from,to,action,note:opts.note,cold:opts.cold,keys:[{t:from,pos,look:target,fov:45,lin:true},{t:to,pos:opts.end??[pos[0]+.09,pos[1]+.04,pos[2]-.15],look:opts.endLook??target,fov:45}]});}
const CONTACT=new THREE.Vector3(.75,-.39,.19),MOUTH=new THREE.Vector3(-1.75,-.065,.36),NURSE_ROT=new THREE.Euler(-.12,-.5,-.25);
const nursingPosition=(size=.42)=>CONTACT.clone().sub(MOUTH.clone().multiplyScalar(size).applyEuler(NURSE_ROT)).toArray() as V3;
const NURSE=nursingPosition();
// The corner of the calf's mouth is locked to a maternal mammary slit after all transforms.
if(new THREE.Vector3(...NURSE).add(MOUTH.clone().multiplyScalar(.42).applyEuler(NURSE_ROT)).distanceTo(CONTACT)>1e-6)throw Error('Mamada desalinhada');
function Dupla({t,calfY,calfX,pitch,reserve=0,calfReserve=0,breath=false,growth=0}:{t:number;calfY?:number;calfX?:number;pitch?:number;reserve?:number;calfReserve?:number;breath?:boolean;growth?:number}){const size=.42+growth*.055;const pos=nursingPosition(size);const nursing=calfY===undefined;return <group rotation={[-.27,-.23,.06]}><Jubarte t={t} reserve={reserve}/><Jubarte t={t+.6} scale={size} position={[calfX??pos[0],calfY??pos[1],pos[2]]} pitch={pitch??-.25} yaw={nursing?-.5:0} roll={nursing?-.12:0} reserve={calfReserve} breath={breath}/></group>;}
const feeding=(t:number)=><Dupla t={t}/>;
const LEAVE=W('respirar','larga'),RISE=W('respirar','sobe'),HOLES=W('respirar','orifícios'),BREATH=W('respirar','Respirou'),DIVE=W('respirar','Mergulha'),BACK=W('respirar','leite');
function Respira({t}:{t:number}){const up=seg01(t,LEAVE,HOLES),down=seg01(t,DIVE,BACK),q=up*(1-down);const x=mix(NURSE[0],.8,q),y=mix(NURSE[1],1.9,q),z=mix(NURSE[2],.5,q);return <><Jubarte t={t}/><Jubarte t={t+.6} scale={.42} position={[x,y,z]} yaw={mix(-.5,0,q)} roll={mix(-.12,0,q)} pitch={mix(-.25,0,q)} breath={t>=HOLES&&t<DIVE}/>{t>=HOLES&&t<BREATH+.6&&Array.from({length:18},(_,i)=><mesh key={i} position={[x-.47+(i%3-.7)*.015,2.17+i*.017+seg01(t,HOLES,BREATH+.6)*.3,z+Math.sin(i*5)*.08]} scale={[.008+i*.0003,.025,.008]}><sphereGeometry args={[1,6,6]}/><meshBasicMaterial color="#e2f6f6" transparent opacity={.12*(1-seg01(t,HOLES,BREATH+.6))} depthWrite={false}/></mesh>)}</>;}
const ANTES=W('reserva','Quem'),JUNTOU=W('reserva','juntou'),CRESCE=W('reserva','cresce'),PAGA=W('reserva','paga');
const gordura=(t:number)=><><Jubarte t={t} scale={.8} position={[0,-.3,0]} reserve={.8}/>{Array.from({length:24},(_,i)=><mesh key={i} position={[-3+((i*.21+t*.3)%1.6),-.3+Math.sin(i*1.2)*.3,Math.cos(i*3)*.3]} scale={[.06,.018,.012]}><sphereGeometry args={[1,6,6]}/><meshStandardMaterial color="#d0b992"/></mesh>)}</>;
add('01-contato-primeiro-quadro',0,W('gancho','filhote'),wide,look,feeding,{end:[-.15,-.15,11.2]});
add('02-filhote-revelado',W('gancho','filhote'),S('mama'),[.7,-.6,9.7],[.2,-.2,.2],feeding);
add('03-ventre-localizacao',S('mama'),W('mama','mamilos'),[.8,-3.3,7.7],[.3,-.2,.1],feeding);
add('04-duas-fendas',W('mama','mamilos'),W('mama','chega'),[1.1,-2.5,2.9],[.75,-.42,.15],t=><Jubarte t={t} anatomy/>,{note:'AMARELO: FENDAS MAMÁRIAS · AZUL: FENDA GENITAL'});
add('05-aproxima-canto-boca',W('mama','chega'),W('mama','encosta'),[1.2,-1.9,4.1],[.8,-.46,.32],t=><Dupla t={t} calfX={mix(NURSE[0]+.4,NURSE[0],seg01(t,W('mama','chega'),W('mama','encosta')))}/>);
add('06-contato-abastecimento',W('mama','encosta'),S('leite'),[1,-1.8,3.5],[.8,-.45,.32],feeding);
add('07-leite-concentrado',S('leite'),W('leite','gordura'),[1.3,-1.9,4.5],[.8,-.45,.25],feeding);
add('08-camada-do-filhote',W('leite','gordura'),W('leite','crescer'),[1.8,-1,5.5],[1,-.6,.4],t=><Dupla t={t} calfReserve={.9}/>,{note:'DESTAQUE DIDÁTICO · CAMADA SUBCUTÂNEA'});
add('09-crescimento-tempo',W('leite','crescer'),S('respirar'),wide,look,t=><Dupla t={t} growth={seg01(t,W('leite','crescer'),S('respirar'))}/>,{note:'CRESCIMENTO AO LONGO DO TEMPO'});
add('10-solta-contato',S('respirar'),RISE,[1.1,-1.8,5.3],[.8,-.4,.3],t=><Respira t={t}/>);
add('11-subida-continua',RISE,HOLES,[.3,1,10],[.3,.65,0],t=><Respira t={t}/>,{end:[.1,2,9.5],endLook:[.1,.9,.2]});
add('12a-dois-espiraculos',HOLES,(HOLES+DIVE)/2-.3,[.19,4.5,.65],[.19,2.08,.5],t=><Respira t={t}/>,{note:'AR · DOIS ESPIRÁCULOS'});
add('12b-interface-ar-agua',(HOLES+DIVE)/2-.3,DIVE,[.2,2.045,3],[.2,2.045,.4],t=><Respira t={t}/>,{note:'ESPIRÁCULOS ACIMA DA SUPERFÍCIE'});
add('13-desce-retorna',DIVE,S('reserva'),[.2,1,10],[.3,.35,0],t=><Respira t={t}/>,{end:wide,endLook:look});
add('14a-custo-materno',S('reserva'),W('reserva','períodos'),wide,look,feeding);
add('14b-mae-sem-comer',W('reserva','períodos'),ANTES,[-1,-1,10.5],[.1,-.3,0],feeding);
add('15-antes-alimentacao',ANTES,JUNTOU,[-.2,.1,9],[-.3,-.1,0],t=><><Jubarte t={t} open={.8}/>{Array.from({length:38},(_,i)=><mesh key={i} position={[-2.8+((i*.19+t*.2)%.65),-.1+Math.sin(i*3)*.38,Math.cos(i*2)*.35]} scale={[.055,.025,.02]}><sphereGeometry args={[1,6,6]}/><meshStandardMaterial color="#b8b59b"/></mesh>)}</>,{cold:true,note:'ANTES · ÁGUAS DE ALIMENTAÇÃO'});
add('16-reserva-corporal',JUNTOU,CRESCE,[.1,-.9,9.9],[0,-.35,0],t=><Dupla t={t} reserve={.85}/>,{note:'AGORA · RESERVAS ACUMULADAS ANTES'});
add('17-mae-financia',CRESCE,S('viagem'),wide,look,t=><Dupla t={t} reserve={mix(.85,.4,seg01(t,CRESCE,S('viagem')))}/>,{note:'PASSAGEM DE TEMPO · RESERVA DA MÃE'});
add('18-rota-oceano',S('viagem'),W('viagem','mamando'),[4,3.3,14],[0,-.1,0],t=><group rotation={[0,-.25,0]} position={[mix(.4,-.4,seg01(t,S('viagem'),S('loop'))),0,0]}><Dupla t={t}/>{Array.from({length:15},(_,i)=><mesh key={i} position={[3+i*.28,-.8,-.3]} scale={[.07,.025,.07]}><sphereGeometry args={[1,6,6]}/><meshBasicMaterial color="#f3ce58" transparent opacity={.6}/></mesh>)}</group>,{note:'MIGRAÇÃO · ROTA ILUSTRATIVA SEM ESCALA'});
add('19-leite-vai-junto',W('viagem','mamando'),S('loop'),[.1,-.5,10.6],look,feeding);
add('20-loop-mergulho',S('loop'),W('loop','mama'),[.1,1.2,10],look,feeding);
add('21-loop-mamada',W('loop','mama'),W('loop','respirar'),[1.1,-1.8,4.8],[.8,-.45,.3],feeding);
add('22-loop-respirar',W('loop','respirar'),W('loop','primeiro'),[.2,2.045,3],[.2,2.045,.4],t=><Respira t={(HOLES+DIVE)/2}/>);
add('23-volta-ao-gancho',W('loop','primeiro'),END,wide,look,t=><Dupla t={mix(t,0,seg01(t,W('loop','Você',0),END))}/>,{end:wide});
for(const [i,p] of plans.entries()){if(!Number.isFinite(p.from+p.to)||p.to<=p.from)throw Error(`Plano inválido: ${p.id}`);if(i&&Math.abs(plans[i-1].to-p.from)>.001)throw Error(`Lacuna: ${p.id}`);}
export const baleiaPlanos=plans.map(({id,from,to,note})=>({id,from,to,note,frames:{inicio:Math.ceil(from*30),meio:Math.floor((from+to)*15),fim:Math.ceil(to*30)-1}}));
const WORDS:Word[]=TL.cenas.flatMap(c=>c.words.map(w=>({...w,s:w.s+OFF,e:w.e+OFF})));
const Texto=({children,y=235,size=74,color='#fff'}:{children:ReactNode;y?:number;size?:number;color?:string})=><div style={{position:'absolute',left:50,right:50,top:y,fontFamily:FONT_KIT,fontSize:size,fontWeight:900,textAlign:'center',lineHeight:1.05,color,WebkitTextStroke:'9px #092d40',paintOrder:'stroke fill',textShadow:'0 7px 16px #001d2b88'}}>{children}</div>;
export function BaleiaVideo({cover=false}:{cover?:boolean;planos?:unknown}){useKitFont();const f=useCurrentFrame(),{fps}=useVideoConfig(),t=cover?0:f/fps;const p=cover?plans[0]:plans.find(x=>t>=x.from&&t<x.to)??plans.at(-1)!;return <AbsoluteFill style={{background:'#086b85'}}>
 <PalcoNoite fundo={p.cold?'#216b86':'#086b85'} exposure={1.3} sombras={false}><LagCam t={t} keys={p.keys} deriva={0} far={100}/><ambientLight intensity={1}/><hemisphereLight args={['#c7eff6','#125264',1.5]}/><directionalLight position={[-3,6,5]} color="#d8f6f7" intensity={3}/><directionalLight position={[4,2,-4]} color="#4db8e1" intensity={2}/><Oceano t={t} cold={p.cold}/>{p.action(t)}</PalcoNoite>
 {!cover&&<><Audio src={staticFile('baleia/mix.wav')}/>{t<W('gancho','filhote')&&<><Texto>VOCÊ MAMA ATÉ</Texto><Texto y={325} size={87} color="#FFD21F">DEBAIXO D’ÁGUA</Texto></>}{p.note&&<Texto y={t>=S('leite')&&t<W('leite','crescer')?540:230} size={35}>{p.note}</Texto>}{t>=W('mama','abastecimento')&&t<S('leite')&&<Texto color="#FFD21F" size={64}>ABASTECIMENTO</Texto>}{t>=S('leite')&&t<W('leite','crescer')&&<><Texto size={40}>GORDURA DO LEITE · VARIA</Texto><Texto y={290} size={84} color="#FFD21F">PODE PASSAR DE 50%</Texto></>}<Legenda1Palavra palavras={WORDS} y={1400} tamanho={76}/></>}
 </AbsoluteFill>;}
export const CapaBaleia=()=><AbsoluteFill><BaleiaVideo cover/><Texto y={280} size={88}>VOCÊ MAMA ATÉ</Texto><Texto y={390} size={96} color="#FFD21F">DEBAIXO D’ÁGUA</Texto></AbsoluteFill>;
