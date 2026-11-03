import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ReactNode} from 'react';
import timelineJson from '../../public/panda/timeline.json';
import {cena, Timeline, Word, wordAt} from '../engine/timeline';
import {ApelidoAmarelo, FONT_KIT, Legenda1Palavra, useKitFont} from '../three/animais/ui';
import {LagCam, LKey, PalcoNoite, V3, mix} from '../three/animais/LagartixaComum';
import {Panda, PataPanda, MandibulaPanda} from '../three/animais/panda/Panda';
import {Bambuzal, ColmoBambu, PilhaBambu} from '../three/animais/panda/Bambuzal';
import {Caminhando, Comendo, Dejetos, Descansando, Digestivo, Residuos, suave} from './panda/Acoes';

const TL = timelineJson as Timeline;
const OFF = .5;
export const pandaDuration = (fps: number) => Math.ceil((TL.duration + .9) * fps);
const END = pandaDuration(30) / 30;
const w = (id: string, word: string, n = 0) => wordAt(TL, id, word, n) + OFF;
const S = (id: string) => cena(TL, id).start + OFF;
const v = (a: V3, b: V3, k: number): V3 => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
type Plan = {id: string; from: number; to: number; keys: LKey[]; action: (t: number) => ReactNode; scheme?: boolean; note?: string};
const plans: Plan[] = [];
const CAM0: V3 = [1.75, 1.32, 2.9], LOOK0: V3 = [0, .76, .22];
const WIDE: V3 = [2.8, 1.8, 4.1];
function add(id: string, from: number, to: number, pos: V3, look: V3, action: Plan['action'], opts: {end?: V3; endLook?: V3; fov?: number; scheme?: boolean; note?: string} = {}) {
  plans.push({id, from, to, action, scheme: opts.scheme, note: opts.note, keys: [{t: from, pos, look, fov: opts.fov ?? 40, lin: true}, {t: to, pos: opts.end ?? v(pos, look, .035), look: opts.endLook ?? look, fov: opts.fov ?? 40, lin: true}]});
}
const EAT = (t: number) => <Comendo t={t}/>;
const A = w('pegada', 'ajuda'), SIX = w('pegada', 'sexto'), BONE = w('pegada', 'osso'), FUNCTION = w('pegada', 'funciona'), FAKE = w('pegada', 'araque');
const BARK = w('mandibula', 'casca'), CRUSH = w('mandibula', 'esmaga'), JAW_START = w('mandibula', 'Mandíbula'), JAW_END = w('mandibula', 'dentes', 1), GRINDER = w('mandibula', 'triturador');
const ABSORB = w('digestao', 'aproveita'), PART = w('digestao', 'parte'), WORK = w('digestao', 'trabalho');
const HALF = w('rotina', 'metade'), SEEK = w('rotina', 'procurando'), ANOTHER = w('rotina', 'outro'), SHIFT = w('rotina', 'expediente');
const POOP = w('descanso', 'cocô'), SERVICE = w('descanso', 'serviço');
const SPECIES = w('floracao', 'espécie'), BLOOM = w('floracao', 'florescer'), DIE = w('floracao', 'morrer'), FIND = w('floracao', 'procurar'), BUFFET = w('floracao', 'buffet');
const LOOP_JAW = w('loop', 'mandíbula'), LOOP_DAY = w('loop', 'dia'), LOOP_ALL = w('loop', 'Tudo'), LOOP_END = w('loop', 'Você', 1);
const anatomy = 'ANATOMIA · ESQUEMA SEM ESCALA';
const chew = (t: number) => <Comendo t={t} peel={suave(t, BARK, CRUSH + .5)} consumed={2}/>;
const jaw = (t: number) => <group position={[0, .67, .1]} scale={1.8}><MandibulaPanda t={t} chew={.9} cutaway/></group>;
const paw = (t: number, xray = false) => xray ? <group position={[0, .62, .55]} scale={1.65}><PataPanda t={t} grip={1} xray bamboo/></group> : <Comendo t={t}/>;
const dayAt = (t: number) => t < S('rotina') || t >= S('loop') ? .23 : mix(.23, .8, suave(t, HALF, SHIFT));
const seasonAt = (t: number) => t >= S('loop') ? 0 : suave(t, BLOOM, FIND);

// These boundaries are resolved only from the aligned voice, never estimated scene lengths.
add('01-mordida-gancho', 0, S('contradicao'), CAM0, LOOK0, EAT, {end: [1.69, 1.31, 2.86]});
add('02-identidade-floresta', S('contradicao'), w('contradicao', 'Parece'), WIDE, [0, .78, 0], EAT);
add('03-mesmo-bambu', w('contradicao', 'Parece'), w('contradicao', 'intestino'), [-1.7, 1.3, 2.6], [0, .85, .3], EAT);
add('04-boca-ao-intestino', w('contradicao', 'intestino'), w('contradicao', 'carnívoro'), [.95, 1.1, 1.8], [0, .9, .32], EAT);
add('05-intestino-ancestral', w('contradicao', 'carnívoro'), S('pegada'), [1.2, 1.1, 2.5], [0, .68, 0], t => <Digestivo t={t}/>, {scheme: true, note: anatomy});
add('06-pata-pega-colmo', S('pegada'), A, [1.65, 1, 2.5], [0, .55, .45], t => <Comendo t={t} reach={suave(t, S('pegada'), A)} consumed={1}/>);
add('07-pata-real', A, SIX, [.7, .68, 1.55], [0, .65, .58], t => paw(t));
add('08-parece-sexto-dedo', SIX, BONE, [-.65, .7, 1.5], [0, .62, .55], t => paw(t));
add('09-osso-do-punho', BONE, FUNCTION, [.62, .7, 1.4], [0, .62, .55], t => paw(t, true), {scheme: true, note: 'SESAMOIDE RADIAL · ESQUEMA LOCAL'});
add('10-pegada-leva-a-boca', FUNCTION, FAKE, [-1.45, 1.14, 2.35], [0, .81, .4], t => <Comendo t={t} reach={mix(.6, 1, suave(t, FUNCTION, FAKE))} consumed={1}/>);
add('11-polegar-de-araque', FAKE, S('mandibula'), CAM0, LOOK0, EAT);
add('12-bambu-preso', S('mandibula'), BARK, [-1.2, 1.25, 2], [0, .95, .4], t => <Comendo t={t} consumed={2}/>);
add('13-casca-cai', BARK, CRUSH, [1.1, 1.14, 1.85], [0, .91, .44], chew, {endLook: [0, .8, .47]});
add('14-esmaga-parte-clara', CRUSH, JAW_START, [-1, 1.08, 1.72], [0, .95, .44], chew);
add('15-molares-e-musculos', JAW_START, JAW_END, [.95, .91, 1.75], [0, .67, .1], jaw, {scheme: true, note: anatomy});
add('16-triturador', JAW_END, S('digestao'), CAM0, LOOK0, chew);
add('17-triturar-nao-basta', S('digestao'), ABSORB, [-1.8, 1.3, 2.65], [0, .75, .2], t => <Comendo t={t} consumed={3} peel={1}/>);
add('18-nutrientes-e-fibra', ABSORB, PART, [1.1, 1, 2.2], [0, .64, 0], t => <Digestivo t={t} absorption={1}/>, {scheme: true, note: 'DOURADO: NUTRIENTES · VERDE: FIBRA · SEM ESCALA'});
add('19-fibra-no-residuo', PART, WORK, [-1.3, .58, 1.65], [-.3, .35, .05], t => <><Comendo t={t} consumed={3}/><Dejetos amount={3}/></>);
add('20-trabalho-duplo', WORK, S('rotina'), [2.2, 1.38, 3.3], [0, .72, .2], t => <><Comendo t={t} consumed={3}/><Dejetos amount={3}/></>);
add('21-come-muito', S('rotina'), HALF, WIDE, [0, .7, .05], t => <Comendo t={t} consumed={4} peel={.8}/>);
add('22-metade-do-dia', HALF, SEEK, [3.6, 2.1, 4.7], [0, .65, -.05], t => <Comendo t={t} consumed={5} peel={.9}/>);
add('23-procura-na-pilha', SEEK, ANOTHER, [2.4, 1.35, 3.3], [0, .65, .25], t => <><Panda t={t} pose="walk" bamboo={false} position={[0, 0, mix(-.3, 0, suave(t, SEEK, ANOTHER))]}/><group position={[-.25, 0, .65]}><PilhaBambu t={t} consumed={5}/></group><Residuos count={19}/></>);
add('24-pega-outro-colmo', ANOTHER, SHIFT, [-1.5, 1.1, 2.4], [0, .68, .42], t => <Comendo t={t} consumed={6} reach={suave(t, ANOTHER, SHIFT)}/>);
add('25-almoco-expediente', SHIFT, S('descanso'), CAM0, LOOK0, t => <Comendo t={t} consumed={6}/>);
add('26-repouso-no-tronco', S('descanso'), POOP, [-3, 1.5, 3.6], [-.9, .65, .65], t => <Descansando t={t}/>);
add('27-repouso-dejeto-novo', POOP, SERVICE, [-2.65, .9, -.7], [-1.1, .4, .6], t => <Descansando t={t} fresh={suave(t, POOP, SERVICE)}/>);
add('28-boca-fecha-servico-segue', SERVICE, S('floracao'), [-2.5, 1.3, 3.4], [-.9, .7, .7], t => <Descansando t={t} fresh={1}/>);
add('29-cardapio-local', S('floracao'), SPECIES, [3.4, 2.2, 5.2], [-.5, 1.3, -.5], t => <Comendo t={t} consumed={7}/>);
add('30-especie-da-mancha', SPECIES, BLOOM, [-1.1, 1.65, 2.4], [-2.5, 1.4, .15], t => <group position={[-2.6, 0, .15]}><ColmoBambu height={3.2} radius={.075} dry={seasonAt(t)} leaves/></group>);
add('31-florescer-na-regiao', BLOOM, DIE, [-.2, 2.1, 3.6], [-2.6, 1.5, .1], t => <group position={[-2.6, 0, .15]}><ColmoBambu height={3.2} radius={.075} dry={seasonAt(t)} leaves/></group>, {note: 'OUTRA ESCALA DE TEMPO · FLORESCIMENTO LOCAL'});
add('32-mancha-seca', DIE, FIND, [2.9, 2.4, 5.1], [-.6, 1.25, -.8], t => <Panda t={t} pose="sit" bamboo={false}/>, {note: 'APENAS ESTA MANCHA · OUTRA ÁREA SEGUE VERDE'});
add('33-procura-outro-lugar', FIND, BUFFET, [6.3, 2.2, 3.5], [1.7, .9, -2.1], t => <Caminhando t={t} from={FIND} to={BUFFET}/>, {end: [6.9, 2.15, .5], endLook: [3.1, .8, -4]});
add('34-chega-ao-verde', BUFFET, S('loop'), [6.1, 1.9, -.9], [3.6, .74, -4.8], t => <Comendo t={t} position={[3.6, 0, -4.8]} reach={suave(t, BUFFET, S('loop'))}/>);
add('35-recap-polegar', S('loop'), LOOP_JAW, [.7, .68, 1.55], [0, .65, .58], t => paw(t));
add('36-recap-mandibula', LOOP_JAW, LOOP_DAY, [-1.2, 1.2, 2], [0, .92, .4], t => <Comendo t={t} peel={.7}/>);
add('37-recap-dia-comida', LOOP_DAY, LOOP_ALL, WIDE, [0, .75, .1], EAT);
add('38-reencontra-mordida', LOOP_ALL, LOOP_END, [2.2, 1.5, 3.3], LOOK0, t => <Comendo t={t} reach={mix(.45, 1, suave(t, LOOP_ALL, LOOP_END))}/>, {end: [1.83, 1.35, 3]});
add('39-loop-exato', LOOP_END, END, [1.83, 1.35, 3], LOOK0, t => <Comendo t={mix(1.1, 0, suave(t, LOOP_END, END - 1 / 30))}/>, {end: CAM0});
plans[plans.length - 1].keys[1].t = END - 1 / 30;

for (const [i, plan] of plans.entries()) {
  if (!Number.isFinite(plan.from + plan.to) || plan.to <= plan.from) throw new Error(`Plano inválido: ${plan.id}`);
  if (i && Math.abs(plans[i - 1].to - plan.from) > .001) throw new Error(`Intervalo sem plano antes de ${plan.id}`);
}
export const pandaPlanos = plans.map(({id, from, to, scheme}) => ({id, from, to, scheme: !!scheme, frames: {inicio: Math.ceil(from * 30), meio: Math.floor((from + to) * 15), fim: Math.ceil(to * 30) - 1}}));
const WORDS: Word[] = TL.cenas.flatMap(c => c.words.map(x => ({...x, s: x.s + OFF, e: x.e + OFF})));
const Texto = ({children, y = 220, size = 78, color = '#fff'}: {children: ReactNode; y?: number; size?: number; color?: string}) => <div style={{position: 'absolute', top: y, left: 58, right: 58, textAlign: 'center', fontFamily: FONT_KIT, fontWeight: 900, fontSize: size, lineHeight: 1.04, color, WebkitTextStroke: size < 50 ? '5px #15221c' : '11px #15221c', paintOrder: 'stroke fill', textShadow: '0 7px 18px #0008'}}>{children}</div>;

export function PandaVideo({cover = false}: {cover?: boolean}) {
  useKitFont();
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const t = cover ? 0 : frame / fps;
  const active = cover ? plans[0] : plans.find(plan => t >= plan.from && t < plan.to) ?? plans[plans.length - 1];
  const day = dayAt(t), season = seasonAt(t);
  const worldTime = active.id === '39-loop-exato' ? mix(1.1, 0, suave(t, LOOP_END, END - 1 / 30)) : t;
  return <AbsoluteFill style={{background: '#b0c5ad'}}>
    <PalcoNoite fundo={active.scheme ? '#244137' : '#b0c5ad'} exposure={1.03}>
      <LagCam t={t} keys={active.keys} deriva={0} far={180}/>
      <ambientLight intensity={.9}/><hemisphereLight args={['#eff8df', '#5c6846', 1.1]}/>
      <directionalLight position={[mix(-5, 5, day), 7, 5]} color="#fff0c7" intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={8} shadow-camera-bottom={-7} shadow-normalBias={.025}/>
      <directionalLight position={[3, 3, -4]} color="#d7e7e2" intensity={.7}/>
      {!active.scheme && <Bambuzal t={worldTime} day={day} season={season}/>}
      {active.action(t)}
    </PalcoNoite>
    {!cover && <>
      <Audio src={staticFile('panda/mix.wav')}/>
      {t < S('contradicao') && <><Texto>VOCÊ CAI DE BOCA</Texto><Texto y={310} color="#FFD21F">NO BAMBU</Texto></>}
      {t >= w('contradicao', 'panda') && t < w('contradicao', 'panda') + 1.3 && <Texto size={34}>PANDA · Ailuropoda melanoleuca</Texto>}
      {active.note && <Texto size={34}>{active.note}</Texto>}
      {t >= HALF && t < SHIFT && <><Texto color="#FFD21F" size={92}>10–16 H</Texto><Texto y={326} size={34}>BUSCANDO COMIDA E COMENDO · VARIA</Texto></>}
      <ApelidoAmarelo de={FAKE} ate={Math.min(FAKE + 1.4, S('mandibula'))} texto="POLEGAR DE ARAQUE" y={230} tamanho={70}/>
      <ApelidoAmarelo de={GRINDER} ate={Math.min(GRINDER + 1.4, S('digestao'))} texto="TRITURADOR" y={230} tamanho={86}/>
      <ApelidoAmarelo de={SHIFT} ate={Math.min(SHIFT + 1.4, S('descanso'))} texto="EXPEDIENTE" y={230} tamanho={86}/>
      <ApelidoAmarelo de={BUFFET} ate={Math.min(BUFFET + 1.4, S('loop'))} texto="BUFFET FECHADO" y={230} tamanho={78}/>
      <Legenda1Palavra palavras={WORDS} y={1400} tamanho={76}/>
    </>}
  </AbsoluteFill>;
}
export const CapaPanda = () => <AbsoluteFill><PandaVideo cover/><Texto y={285} size={85}>VOCÊ CAI DE BOCA</Texto><Texto y={395} size={124} color="#FFD21F">NO BAMBU</Texto></AbsoluteFill>;
