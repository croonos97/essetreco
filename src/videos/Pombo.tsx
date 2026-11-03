import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ReactNode} from 'react';
import timelineJson from '../../public/pombo/timeline.json';
import {cena, Timeline, Word, wordAt} from '../engine/timeline';
import {ApelidoAmarelo, FONT_KIT, Legenda1Palavra, useKitFont} from '../three/animais/ui';
import {LagCam, LKey, PalcoNoite, V3, clamp01, mix, sm} from '../three/animais/LagartixaComum';
import {Pombo} from '../three/animais/pombo/Pombo';
import {Cidade, Pessoa} from '../three/animais/pombo/Cidade';
import {Falco} from '../three/animais/pombo/Falco';
import {Alimentacao, CortePapo, Crescimento, Pipoca, Rato, Reconhecimento, Transporte} from './pombo/Acoes';

const TL = timelineJson as Timeline;
const OFF = .5;
export const pomboDuration = (fps: number) => Math.ceil((TL.duration + .9) * fps);
const END = pomboDuration(30) / 30;
const PI = Math.PI;
const w = (id: string, word: string, n = 0) => wordAt(TL, id, word, n) + OFF;
const S = (id: string) => cena(TL, id).start + OFF;
const p = (t: number, a: number, b: number) => sm(clamp01((t - a) / Math.max(.001, b - a)));
const vec = (a: V3, b: V3, k: number): V3 => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

type Shot = {id: string; from: number; to: number; keys: LKey[]; world: 'ninho'|'praca'|'telhado'|'porto'|'anatomia'; action: (t: number) => ReactNode; note?: string};
const shots: Shot[] = [];
function shot(id: string, from: number, to: number, world: Shot['world'], pos: V3, look: V3, action: Shot['action'], endPos?: V3, endLook?: V3, fov = 38, note?: string) {
  const dolly = endPos ?? vec(pos, look, .035);
  shots.push({id, from, to, world, action, note, keys: [{t: from, pos, look, fov, lin: true}, {t: to, pos: dolly, look: endLook ?? look, fov, lin: true}]});
}

const C0: V3 = [1.25, .75, 1.5], L0: V3 = [0, .34, .12];
const C1: V3 = [-1.1, .62, 1.45];
const FEED = (t: number) => <Alimentacao t={t}/>;
const T_MAE = w('papo', 'sua');
const T_SCHEMA = w('papo', 'engrossa');
const T_CEL = w('papo', 'células');
const T_DESC = w('papo', 'descasca');
const T_PASTA = w('papo', 'pasta');
const T_SAI = w('falcao', 'sai');
const T_PRACA = w('falcao', 'praça');
const T_CITY = w('falcao', 'cidade');
const T_FALCO = w('falcao', 'falcão-peregrino');
const T_DESVIA = w('falcao', 'desvia');
const T_VOLTA = w('falcao', 'volta');
const T_BOCA = w('falcao', 'boca');
const T_HUMAN = w('crescimento', 'humano');
const T_ESTIRAO = w('crescimento', 'estirão');
const T_PORQUE = w('anonimo', 'Porque');
const T_PENA = w('anonimo', 'pena');
const T_RECON = w('rancor', 'reconhece');
const T_ROUPA = w('rancor', 'roupa');
const T_CONTINUA = w('rancor', 'continua');
const T_PESSOA = w('rancor', 'pessoa');
const T_GENTE = w('humanos', 'gente');
const T_CASA = w('humanos', 'casa');
const T_PIPOCA = w('humanos', 'pipoca');
const T_DRIBLOU = w('recap', 'driblou');
const T_CRESCEU = w('recap', 'cresceu');
const T_DEPOIS = w('recap', 'Depois');
const T_LOOP = w('recap', 'Você', 1);

function Partida({t}: {t: number}) {
  const k = p(t, T_SAI, T_PRACA);
  return <>
    <Pombo t={t} position={[k * .55, k * .6, -.12 + k * .8]} rotation={[-k * .22, .6 * k, -.15 * Math.sin(k * PI)]} flap={k > 0 ? 1 : 0} head={[.1, 0, 0]}/>
    <Pombo t={t} baby position={[0, .04, .34]} rotation={[0, PI, 0]} head={[-.4, -.15, 0]} beak={.5}/>
  </>;
}
function Praca({t, shadow = false}: {t: number; shadow?: boolean}) {
  const k = p(t, T_CITY, T_FALCO + .4);
  return <>
    <Pombo t={t} head={[shadow ? mix(.95, -.1, k) : .2 + Math.max(0, Math.sin(t * 9)) * .9, shadow ? .3 * k : 0, 0]} walk={.18}/>
    {shadow && <group position={[mix(-1.6, 1.8, k), .012, mix(.7, -.4, k)]} rotation={[-PI / 2, 0, -.6]}>
      <mesh scale={[.13, .48, 1]}><circleGeometry args={[1, 24]}/><meshBasicMaterial color="#29363d" transparent opacity={.34} depthWrite={false}/></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .45, .05, 0]} rotation={[0, 0, s * .22]} scale={[.55, .13, 1]}><circleGeometry args={[1, 3]}/><meshBasicMaterial color="#29363d" transparent opacity={.34} depthWrite={false}/></mesh>)}
    </group>}
  </>;
}
function Predador({t}: {t: number}) {
  const k = p(t, T_FALCO, T_DESVIA);
  return <Falco t={t} position={[mix(-.55, .4, k), .35 + Math.sin(k * PI) * .12, mix(-.3, .1, k)]} rotation={[-.08, .5, -.12 + k * .18]} scale={.65} flap={.08}/>;
}
function Desvio({t, k}: {t: number; k: number}) {
  const bank = Math.sin(k * PI);
  return <>
    <Pombo t={t} position={[mix(-.4, .45, k), .23 + bank * .32, .1 + .2 * k]} rotation={[.68, mix(.2, 1.5, k), -.6 * bank]} flap={1}/>
    <Falco t={t} position={[mix(-.7, .7, k), mix(.8, .12, k), mix(-.8, -.2, k)]} rotation={[.1, .9, .25]} scale={.63} flap={.12}/>
  </>;
}
function Retorno({t}: {t: number}) {
  const k = p(t, T_VOLTA, T_BOCA);
  return <>
    <Pombo t={t} baby position={[0, .04, .346]} rotation={[0, PI, 0]} head={[-.6, 0, 0]} beak={.8}/>
    <Pombo t={t} position={[mix(-.7, 0, k), mix(.55, -.035, k), mix(-.6, -.11, k)]} rotation={[0, mix(.8, 0, k), 0]} head={[mix(0, 1.05, k), 0, 0]} beak={k * .6} flap={(1 - k) * .9} crop={.45}/>
  </>;
}
const grow = (t: number) => <Crescimento t={t} k={p(t, S('crescimento'), T_HUMAN)}/>;
const grown = (t: number) => <Crescimento t={t} k={1}/>;
function Comparacao({t}: {t: number}) {
  const k = p(t, T_HUMAN, T_ESTIRAO);
  return <>
    <Pessoa t={t} position={[-.45, 0, -.65]} scale={mix(.16, .58, k)} coat="#60929a"/>
    <Pessoa t={t} position={[.5, 0, -.65]} scale={.58} coat="#af8860"/>
    <Pombo t={t} position={[-.24, 0, .5]} scale={.93} rotation={[0, -.3, 0]} head={[0, .2, 0]}/>
    <Pombo t={t} position={[.3, 0, .4]} rotation={[0, .2, 0]}/>
  </>;
}
function Oculto({t, emerge = false}: {t: number; emerge?: boolean}) {
  const k = emerge ? p(t, T_PENA, w('anonimo', 'modo')) : 0;
  return <>
    <mesh position={[0, .9, -.22]} castShadow><boxGeometry args={[2, .16, 1.1]}/><meshStandardMaterial color="#a9835e" roughness={.92}/></mesh>
    <mesh position={[-.92, .45, -.4]} castShadow><boxGeometry args={[.12, .9, .8]}/><meshStandardMaterial color="#c6b89c"/></mesh>
    <Pombo t={t} baby={!emerge} scale={emerge ? .93 : 1} position={[0, .04, mix(-.1, .42, k)]} rotation={[0, -.3, 0]} walk={emerge && k > 0 && k < 1 ? .8 : 0} head={[-.12, -.2, 0]}/>
    {emerge && <Pombo t={t} position={[.5, 0, -.1]} rotation={[0, -.8, 0]}/>}
  </>;
}

// Cut boundaries are narration words; only this current shot mounts its actors and city.
shot('01-bicos-loop', 0, S('identidade'), 'ninho', C0, L0, FEED, [1.19, .73, 1.46]);
shot('02-voce-filhote', S('identidade'), w('identidade', 'E', 1), 'ninho', [-.86, .52, .95], [0, .29, .22], FEED);
shot('03-papo-do-pai', w('identidade', 'E', 1), S('papo'), 'ninho', [.95, .57, .92], [0, .38, .05], t => <Alimentacao t={t} crop={p(t, w('identidade', 'papo') - .2, w('identidade', 'pai'))}/>);
shot('04-pai-incredulo', S('papo'), T_MAE, 'ninho', C1, L0, t => <Alimentacao t={t} crop={.55}/>);
shot('05-mae-entra', T_MAE, w('papo', 'hormônio'), 'ninho', [1.6, .8, 2], [.18, .34, -.02], t => <Alimentacao t={t} crop={.65} mother={p(t, T_MAE, T_MAE + .65)}/>);
shot('06-pais-e-papo', w('papo', 'hormônio'), T_SCHEMA, 'ninho', [-1.35, .68, 1.6], [.16, .38, -.05], t => <Alimentacao t={t} crop={.8} mother={1}/>);
shot('07-camada-engrossa', T_SCHEMA, T_CEL, 'anatomia', [.15, .51, 1.22], [0, .41, 0], t => <CortePapo t={t} k={p(t, T_SCHEMA, T_CEL)} detach={0}/>, [.1, .49, 1.17], undefined, 36, 'ANATOMIA · ESQUEMA SEM ESCALA');
shot('08-celulas-nutritivas', T_CEL, T_DESC, 'anatomia', [.34, .57, 1.03], [0, .42, 0], t => <CortePapo t={t} k={1} detach={0}/>, [.31, .54, .99], undefined, 36, 'ANATOMIA · ESQUEMA SEM ESCALA');
shot('09-desprende-pasta', T_DESC, T_PASTA, 'anatomia', [-.19, .5, 1.02], [0, .36, 0], t => <CortePapo t={t} k={1} detach={p(t, T_DESC, T_PASTA)}/>, [-.17, .48, .98], undefined, 36, 'ANATOMIA · ESQUEMA SEM ESCALA');
shot('10-requeijao-alimenta', T_PASTA, S('falcao'), 'ninho', C0, L0, FEED);
shot('11-fome-do-pai', S('falcao'), T_SAI, 'ninho', [-1.06, .62, 1.2], [0, .34, .08], t => <><Pombo t={t} position={[0, 0, -.12]} rotation={[0, -.3 * p(t, S('falcao'), T_SAI), 0]} head={[0, -.35, 0]}/><Pombo t={t} baby position={[0, .04, .34]} rotation={[0, PI, 0]} beak={.5}/></>);
shot('12-pai-deixa-ninho', T_SAI, T_PRACA, 'ninho', [1.5, .9, 1.9], [.1, .4, .2], t => <Partida t={t}/>, [1.6, 1.02, 2.1], [.3, .65, .6]);
shot('13-bica-na-praca', T_PRACA, T_CITY, 'praca', [1, .62, 1.4], [0, .28, .05], t => <Praca t={t}/>);
shot('14-sombra-peregrino', T_CITY, T_FALCO, 'praca', [.65, 1.25, 1.15], [0, .13, .1], t => <Praca t={t} shadow/>, [.61, 1.22, 1.12]);
shot('15-peregrino-entre-predios', T_FALCO, T_DESVIA, 'telhado', [2.45, 1.05, 2.6], [0, .65, -.05], t => <Predador t={t}/>, [2.28, 1.03, 2.55]);
shot('16-decola-desvia', T_DESVIA, T_VOLTA, 'praca', [1.5, .85, 1.7], [0, .55, .05], t => <Desvio t={t} k={p(t, T_DESVIA, T_VOLTA)}/>, [1.6, 1.05, 1.8], [.2, .7, .1]);
shot('17-retorna-ao-filho', T_VOLTA, T_BOCA, 'ninho', [-1.4, .8, 1.7], [-.1, .4, .05], t => <Retorno t={t}/>);
shot('18-boca-motoboy', T_BOCA, S('crescimento'), 'ninho', C1, L0, FEED);
shot('19-quatro-semanas', S('crescimento'), T_HUMAN, 'ninho', [1.5, .8, 1.7], [0, .35, .05], grow, [1.42, .77, 1.65]);
shot('20-humano-cresce', T_HUMAN, T_ESTIRAO, 'praca', [2.7, 1.45, 3.1], [0, .9, -.1], t => <Comparacao t={t}/>, [2.62, 1.42, 3.04]);
shot('21-estirao-dupla', T_ESTIRAO, S('anonimo'), 'ninho', [-1.4, .7, 1.6], [0, .35, .08], grown);
shot('22-onde-filhotes', S('anonimo'), T_PORQUE, 'praca', [2.3, 1.2, 3], [0, 1.05, -.4], t => <><Pessoa t={t} position={[0, 0, -.6]} rotation={[0, -.1, 0]} scale={.58}/><Pombo t={t} position={[.35, 0, .4]} rotation={[0, -1, 0]}/><group position={[0, 3.7, -3]}><mesh><boxGeometry args={[3, .18, 2]}/><meshStandardMaterial color="#af9677"/></mesh></group></>, [2.1, 1.45, 2.9], [0, 1.45, -.6]);
shot('23-revela-ninho-protegido', T_PORQUE, T_PENA, 'ninho', [1.6, .8, 1.9], [0, .4, -.1], t => <Oculto t={t}/>, [1.2, .65, 1.55], [0, .34, .05]);
shot('24-jovem-emplumado', T_PENA, S('rancor'), 'ninho', [-1.5, .64, 1.65], [.12, .36, .12], t => <Oculto t={t} emerge/>, [-1.42, .64, 1.61]);
shot('25-pessoa-a-enxota', S('rancor'), T_RECON, 'praca', [2.5, 1.2, 3], [.05, .72, -.15], t => <Reconhecimento t={t} stage="shoo" k={p(t, w('rancor', 'enxota'), T_RECON)}/>);
shot('26-pessoa-b-neutra', T_RECON, T_ROUPA, 'praca', [-2.4, 1.1, 3.1], [.2, .74, -.2], t => <Reconhecimento t={t} stage="neutral" k={0}/>);
shot('27-a-troca-casaco', T_ROUPA, T_CONTINUA, 'praca', [1.2, 1.22, 2.6], [-.4, 1, -.6], t => <Reconhecimento t={t} stage="change" k={p(t, T_ROUPA, T_CONTINUA)}/>);
shot('28-pombo-evita-a', T_CONTINUA, T_PESSOA, 'praca', [2.25, 1.25, 3.15], [.05, .76, -.25], t => <Reconhecimento t={t} stage="avoid" k={p(t, T_CONTINUA, T_PESSOA)}/>);
shot('29-a-parado-pombo-esquiva', T_PESSOA, S('humanos'), 'praca', [-2.15, 1.15, 2.9], [.2, .73, -.1], t => <Reconhecimento t={t} stage="avoid" k={p(t, T_PESSOA, w('rancor', 'rancor'))}/>);
shot('30-rato-com-asa', S('humanos'), T_GENTE, 'praca', [1.18, .6, 1.6], [-.12, .28, .1], t => <><Pombo t={t} position={[.2, 0, .05]} rotation={[0, -.25, 0]} head={[0, -.5, 0]}/><Rato t={t}/></>);
shot('31-trazido-por-gente', T_GENTE, T_CASA, 'porto', [2.9, 1.7, 3.4], [0, .9, -.15], t => <Transporte t={t} k={p(t, T_GENTE, T_CASA)}/>, [2.75, 1.66, 3.3], undefined, 40, 'VINHETA HISTÓRICA ILUSTRATIVA');
shot('32-pipoca-na-praca', T_CASA, S('recap'), 'praca', [2.1, 1.03, 2.6], [0, .65, -.05], t => <Pipoca t={t} from={T_PIPOCA}/>, [2.02, 1, 2.52]);
shot('33-recap-pai-alimenta', S('recap'), T_DRIBLOU, 'ninho', C1, L0, FEED);
shot('34-recap-pai-dribla', T_DRIBLOU, T_CRESCEU, 'telhado', [1.7, .95, 1.95], [0, .55, .05], t => <Desvio t={t} k={p(t, T_DRIBLOU, T_CRESCEU)}/>);
shot('35-recap-filho-ninho', T_CRESCEU, T_DEPOIS, 'ninho', [1.25, .73, 1.6], [0, .36, .03], t => <Oculto t={t} emerge/>);
shot('36-recap-reconhece', T_DEPOIS, T_LOOP, 'praca', [2, 1.08, 2.7], [.15, .65, -.05], t => <Reconhecimento t={t} stage="avoid" k={p(t, T_DEPOIS, T_LOOP)}/>);
// This closes at the exact opening camera and pose, with no time-dependent bird gait.
shot('37-loop-alimentacao', T_LOOP, END, 'ninho', [1.3, .77, 1.54], L0, t => <Alimentacao t={mix(1.2, 0, p(t, T_LOOP, END - 1 / 30))}/>, C0, L0);
shots[shots.length - 1].keys[1].t = END - 1 / 30;

for (const [i, s] of shots.entries()) {
  if (s.to - s.from < .5 || !Number.isFinite(s.from + s.to)) throw new Error(`Plano inválido ou curto demais: ${s.id}`);
  if (i && Math.abs(s.from - shots[i - 1].to) > .001) throw new Error(`Descontinuidade antes de ${s.id}`);
}
if (T_PASTA - T_SCHEMA > 5) throw new Error('Anatomia excede cinco segundos');
export const pomboPlanos = shots.map(({id, from, to, world}) => ({id, from, to, world}));
const WORDS: Word[] = TL.cenas.flatMap(c => c.words.map(word => ({...word, s: word.s + OFF, e: word.e + OFF})));

function Top({children, small = false, y = 220}: {children: ReactNode; small?: boolean; y?: number}) {
  return <div style={{position: 'absolute', top: y, left: 58, right: 58, textAlign: 'center', fontFamily: FONT_KIT, fontWeight: 900, fontSize: small ? 35 : 76, lineHeight: 1.08, color: '#ffe033', WebkitTextStroke: small ? '5px #222a2e' : '10px #222a2e', paintOrder: 'stroke fill', textShadow: '0 7px 18px #0008'}}>{children}</div>;
}
export function PomboVideo({cover = false}: {cover?: boolean}) {
  useKitFont();
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const t = cover ? 0 : frame / fps;
  const active = cover ? shots[0] : shots.find(s => t >= s.from && t < s.to) ?? shots[shots.length - 1];
  const title = t < S('identidade');
  const is = (a: number, b: number) => t >= a && t < b;
  return <AbsoluteFill style={{background: '#b9d0d5'}}>
    <PalcoNoite fundo={active.world === 'anatomia' ? '#213b45' : '#adc7d1'} exposure={1.05}>
      <LagCam t={t} keys={active.keys} deriva={0} far={180}/>
      <ambientLight intensity={1.2}/><hemisphereLight args={['#e6f2ff', '#9d886c', 1]}/>
      <directionalLight position={[-3, 5, 4]} intensity={2.5} color="#ffe1ae" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={6} shadow-camera-bottom={-4} shadow-normalBias={.025}/>
      <directionalLight position={[3, 2, -3]} intensity={.8} color="#d2e8ff"/>
      {active.world !== 'anatomia' && <Cidade t={t} mode={active.world} seeds={active.world === 'praca' ? 35 : 0}/>}
      {active.action(t)}
    </PalcoNoite>
    {!cover && <>
      <Audio src={staticFile('pombo/mix.wav')}/>
      {title && <Top>VOCÊ BEBE<br/>LEITE DE MACHO</Top>}
      {is(w('identidade', 'pombo'), w('identidade', 'pombo') + 1.3) && <Top small>POMBO · Columba livia</Top>}
      {active.note && <Top small>{active.note}</Top>}
      {is(S('crescimento'), T_HUMAN) && <><Top>CERCA DE 4 SEMANAS</Top><Top small y={340}>QUASE DO TAMANHO ADULTO</Top><Top small y={1530}>DIA {Math.round(mix(1, 28, p(t, S('crescimento'), T_HUMAN)))}</Top></>}
      {is(T_HUMAN, T_ESTIRAO) && <Top small>COMPARAÇÃO DE TAMANHO · APROXIMADA</Top>}
      {is(T_PENA, w('anonimo', 'modo')) && <Top small>JOVEM EMPLUMADO · QUASE DO TAMANHO ADULTO</Top>}
      {is(S('rancor'), w('rancor', 'rancor')) && <Top small>RESUMO DE EXPERIMENTO</Top>}
      <ApelidoAmarelo de={w('papo', 'requeijão')} ate={Math.min(w('papo', 'requeijão') + 1.3, S('falcao'))} texto="REQUEIJÃO" y={240} tamanho={84}/>
      <ApelidoAmarelo de={w('falcao', 'motoboy')} ate={Math.min(w('falcao', 'motoboy') + 1.3, S('crescimento'))} texto="MOTOBOY" y={240} tamanho={88}/>
      <ApelidoAmarelo de={T_ESTIRAO} ate={Math.min(T_ESTIRAO + 1.3, S('anonimo'))} texto="ESTIRÃO" y={240} tamanho={88}/>
      <ApelidoAmarelo de={w('anonimo', 'anônimo')} ate={Math.min(w('anonimo', 'anônimo') + 1.3, S('rancor'))} texto="MODO ANÔNIMO" y={240} tamanho={82}/>
      <ApelidoAmarelo de={w('rancor', 'rancor')} ate={Math.min(w('rancor', 'rancor') + 1.3, S('humanos'))} texto="RANCOR" y={240} tamanho={90}/>
      <Legenda1Palavra palavras={WORDS} y={1400} tamanho={76}/>
    </>}
  </AbsoluteFill>;
}
export const CapaPombo = () => <AbsoluteFill>
  <PomboVideo cover/>
  <div style={{position: 'absolute', top: 280, left: 64, right: 64, textAlign: 'center', fontFamily: FONT_KIT, fontWeight: 900, lineHeight: 1, WebkitTextStroke: '12px #172126', paintOrder: 'stroke fill', textShadow: '0 9px 20px #0009'}}>
    <div style={{fontSize: 86, color: '#fff'}}>VOCÊ BEBE</div>
    <div style={{fontSize: 112, color: '#FFD21F', marginTop: 14}}>LEITE DE</div>
    <div style={{fontSize: 148, color: '#FFD21F'}}>MACHO</div>
  </div>
</AbsoluteFill>;
