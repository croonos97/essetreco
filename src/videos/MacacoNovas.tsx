import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import * as THREE from "three";
import { CameraRig, Key } from "../engine/Camera";
import { Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, Word, wordAt } from "../engine/timeline";
import timelineJson from "../../public/animal_macaco/timeline.json";
import { ApelidoAmarelo, Legenda1Palavra, useKitFont } from "../three/animais";
import { Macaco as Mac, MacacoProps, Mao } from "../three/animais/Macaco";
import { LAJE_TOPO, SerraCapivara, serraAltura } from "../three/animais/MacacoCenarios";
import {
  BOCA_L,
  caminhoCobra,
  corpoNoCaminho,
  EspirroNuvem,
  frenteCabeca,
  FURO_BOCA,
  FURO_N,
  GravetoFino,
  LarvaBranca,
  NARINA_E,
  OndasGrito,
  passada,
  pontoCabeca,
  QUATRO,
  quatPara,
  Serpente,
  TroncoFuro,
} from "../three/animais/MacacoCobra";

// =====================================================================
// CENAS NOVAS do roteiro v2 (prontas para encaixar em src/videos/Macaco.tsx):
//   planosCotonete(w, S)  → cena "cotonete" (larva saindo do buraco + macaca com graveto no nariz/espirro)
//   planosCobra(w, S)     → cena "gaviao" (agora COBRA: jararaca cercada pelo bando + cobra-cipó comida)
//   planosAlarme(w, S)    → cena "alarme" (grito passa de macaco em macaco e o bando corre junto)
// `w`/`S` são as MESMAS funções de Macaco.tsx (tempo do vídeo = timeline + OFF). Cada plano devolve
// { from, to, keys, look, drift, scene } — o mesmo formato de `Plan` em Macaco.tsx.
// A composição MacacoNovas (abaixo) monta só esses planos + legenda + apelidos + narração para conferir.
// =====================================================================
type V3 = [number, number, number];
type Look = { sun?: V3; sunPower?: number; ambient?: number; shadowSize?: number; exposure?: number };
export type PlanoNovo = { from: number; to: number; keys: Key[]; scene: (t: number) => React.ReactNode; look?: Look; drift?: number };
type W = (c: string, word: string, n?: number) => number;
type Sf = (c: string) => number;
const PI = Math.PI;
const DIA: Look = { sun: [4, 9, 6], sunPower: 2.7, ambient: 1.0, shadowSize: 5 };
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const lin = (x: number) => x;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 2);
const pulso = (t: number, a: number, b: number, sub0 = 0.12) => prog(t, a, a + sub0) * (1 - prog(t, b - sub0, b));
// chão da Serra com a laje (degrau de 0,07 suavizado em 3 cm para nada "pular")
const chaoY = (x: number, z: number) => {
  const dx = Math.abs(x) - 1.25, dz = Math.abs(z) - 1.1;
  const fora = Math.max(dx, dz);
  const k = Math.min(1, Math.max(0, (0.03 - fora) / 0.06));
  return mix(serraAltura(x, z), LAJE_TOPO, k);
};
const yawPara = (de: V3, para: V3) => Math.atan2(para[0] - de[0], para[2] - de[2]);
// menor diferença angular
const dAng = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ============================================================ COTONETE
const MG: V3 = [0.15, LAJE_TOPO, -0.05]; // macaco do tronco (mesmo lugar do vídeo)
const LG = 0.3; // graveto da pescaria
// graveto saindo do furo com a larva e subindo até a frente do rosto (sem entrar na boca)
const pescaria = (t: number, t0: number, tFora: number, tSobe: number) => {
  const n = new THREE.Vector3(...FURO_N);
  const sai = prog(t, t0, tFora, lin);
  const sobe = prog(t, tFora + 0.05, tSobe);
  // ponta (com a larva): de 0,13 un dentro do furo até 0,05 un fora
  const tip0 = new THREE.Vector3(...FURO_BOCA).addScaledVector(n, mix(-0.13, 0.05, sai));
  const hand0 = tip0.clone().addScaledVector(n, LG);
  // pose final: mão à frente do peito, graveto inclinado para cima, larva ao lado do rosto (espaço do mundo)
  const handF = new THREE.Vector3(MG[0] + 0.36, MG[1] + 0.22, MG[2] + 0.06);
  const tipF = new THREE.Vector3(MG[0] + 0.4, MG[1] + 0.45, MG[2] + 0.22);
  const hand = hand0.clone().lerp(handF, sobe);
  const d0 = tip0.clone().sub(hand0).normalize();
  const dF = tipF.clone().sub(handF).normalize();
  const d = d0.clone().lerp(dF, sobe).normalize();
  const tremido = Math.sin(t * 5.5) * 0.012 * (1 - sai); // vai-e-vem lento no fundo do furo
  hand.addScaledVector(d, -tremido);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const maoL: V3 = [hand.x - MG[0], hand.y - MG[1], hand.z - MG[2]];
  return (
    <>
      <TroncoFuro />
      <Mac t={t} maoE={{ alvo: maoL, palma: [-1, 0.2, 0], fechar: 0.9 }} maoD={{ alvo: [-0.12, 0.25, 0.22], palma: [0.2, -1, 0.2], fechar: 0.5 }} cabeca={[mix(0.05, 0.3, sobe), mix(0.38, 0.3, sobe)]} giro={0.35 * (1 - sobe)} sobrancelha={0.3 + 0.5 * sobe} sorriso={0.6 * prog(t, tSobe - 0.2, tSobe + 0.3)} position={MG}>
        <group position={maoL} quaternion={q}>
          <GravetoFino L={LG} r={0.005} />
          <LarvaBranca t={t} position={[0, LG + 0.006, 0.0]} rotation={[0, 0, 0]} scale={1.5} />
        </group>
      </Mac>
    </>
  );
};

// macaca do nariz: sentada de frente para +z num canto da laje; câmera de lado (+x)
const FN: V3 = [-0.55, LAJE_TOPO, 0.25];
const NAR_R: V3 = [-NARINA_E[0], NARINA_E[1], NARINA_E[2]]; // narina direita (−x)
const DIR_G = norm([-0.12, -0.5, 0.86]); // da narina para a mão (graveto sai para a frente e para baixo)
const LN = 0.17;
type PoseN = { hp: number; incl: number; pis: number; boca: number; sob: number; conv: number; sor: number; ins: number; solta: number; olha: number };
const poseNariz = (t: number, T: { ini: number; ah: number; atchim: number; fim: number; apelido: number }): PoseN => {
  const entra = prog(t, T.ini + 0.15, T.ini + 1.0);
  const ah = prog(t, T.ah, T.atchim - 0.04);
  const snap = prog(t, T.atchim - 0.04, T.atchim + 0.08, easeOut);
  const volta = prog(t, T.atchim + 0.3, T.atchim + 1.0);
  const olha = prog(t, T.apelido - 0.6, T.apelido + 0.2);
  const choque = snap * (1 - volta);
  return {
    hp: mix(-0.08, -0.28, ah) * (1 - snap) + -0.55 * choque + mix(0.15, 0.25, olha) * volta * 0,
    incl: -0.16 * choque,
    pis: Math.max(mix(0.35, 0.85, ah) * entra * (1 - snap), choque),
    boca: mix(0.08, 0.55, ah) * (1 - snap) + 0.75 * choque * (1 - prog(t, T.atchim + 0.12, T.atchim + 0.4)),
    sob: mix(0.25, 0.85, ah) * (1 - volta) + 0.2 * volta,
    conv: olha,
    sor: olha * 0.8,
    ins: entra * (1 - snap),
    solta: snap,
    olha,
  };
};
const macacaNariz = (t: number, T: { ini: number; ah: number; atchim: number; fim: number; apelido: number }) => {
  const p = poseNariz(t, T);
  // cabeça vira para o graveto erguido ao lado do rosto no "cotonete"
  const P: Pick<MacacoProps, "sentar" | "inclinar" | "cabeca" | "position"> = { sentar: 1, inclinar: p.incl, cabeca: [mix(0, 0.45, p.olha), p.hp + p.olha * 0.1], position: [0, 0, 0] };
  const nar = pontoCabeca(P, NAR_R);
  // graveto: ponta 1,2 cm dentro da narina quando enfiado; com o espirro a mão é jogada para a frente e o graveto sai
  const vai = Math.sin(t * 6.0) * 0.004 * p.ins;
  const fora = mix(0.06, -0.012, p.ins) + vai;
  const tip = add(nar, mul(DIR_G, fora));
  let hand = add(tip, mul(DIR_G, LN));
  hand = add(hand, mul([0, -0.01, 0.05], p.solta)); // o espirro empurra a mão para longe do focinho
  // no apelido: mão sobe ao lado do rosto, graveto em pé (como quem mostra o cotonete)
  const handA: V3 = [-0.17, 0.5, 0.24];
  hand = mixV(hand, handA, p.olha);
  let dir = norm(sub(tip, add(tip, mul(DIR_G, LN)))); // da mão para a ponta (para a narina)
  dir = norm(mixV(dir, norm([-0.1, 1, -0.1]), p.solta));
  dir = norm(mixV(dir, norm([-0.3, 1, 0.12]), p.olha));
  const q = quatPara(dir);
  const mao: Mao = { alvo: hand, palma: [1, 0, 0], fechar: 0.85, polegar: 0.9 };
  const nq = quatPara([0, 0, 1]);
  void nq;
  // espirro: nuvem presa no ar no ponto da narina no instante do espirro
  const Pa = { ...P, inclinar: poseNariz(T.atchim, T).incl, cabeca: [0, poseNariz(T.atchim, T).hp] as [number, number] };
  const narA = pontoCabeca(Pa, [0, NARINA_E[1], NARINA_E[2]]);
  const fA = frenteCabeca(Pa);
  const qe = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(fA[0], fA[1] - 0.25, fA[2]).normalize());
  return (
    <>
      <Mac t={t} femea sentar={1} inclinar={p.incl} cabeca={P.cabeca} piscar={p.pis} boca={p.boca} sobrancelha={p.sob} convencido={p.conv * 0.8} sorriso={p.sor * (p.boca < 0.2 ? 1 : 0)} maoD={mao} maoE={{ alvo: [0.1, 0.2, 0.2], palma: [-0.2, -1, 0.2], fechar: 0.4 }} rabo={0.4} position={FN}>
        <group position={hand}>
          <GravetoFino L={LN} r={0.0032} quaternion={q} />
        </group>
      </Mac>
      <EspirroNuvem k={prog(t, T.atchim - 0.02, T.atchim + 0.75, lin)} position={add(FN, narA)} quaternion={qe} scale={1.25} />
    </>
  );
};

export const planosCotonete = (w: W, S: Sf): PlanoNovo[] => {
  const T = { ini: w("cotonete", "e"), ah: w("cotonete", "ate"), atchim: w("cotonete", "espirrar") + 0.06, fim: S("lascas"), apelido: w("cotonete", "cotonete") };
  const corte = w("cotonete", "nariz") + 0.15;
  return [
    // por isso você tira bicho de buraco: o graveto sai do MESMO furo do tronco com a larva na ponta
    {
      from: S("cotonete"),
      to: w("cotonete", "e"),
      keys: [
        { t: S("cotonete"), pos: [1.3, 0.62, 0.02], look: [0.26, 0.4, 0.16], fov: 38 },
        { t: w("cotonete", "e"), pos: [1.2, 0.68, 0.12], look: [0.22, 0.48, 0.14], fov: 38 },
      ],
      look: DIA,
      drift: 0.4,
      scene: (t) => (
        <>
          <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }]} />
          {pescaria(t, S("cotonete") - 0.05, w("cotonete", "bicho") + 0.15, w("cotonete", "e") - 0.2)}
        </>
      ),
    },
    // e já pegaram macaca enfiando graveto no nariz: close lateral
    {
      from: w("cotonete", "e"),
      to: corte,
      keys: [
        { t: w("cotonete", "e"), pos: add(FN, [-0.88, 0.72, 0.62]), look: add(FN, [0, 0.49, 0.21]), fov: 31 },
        { t: corte, pos: add(FN, [-0.8, 0.7, 0.56]), look: add(FN, [0, 0.5, 0.21]), fov: 30 },
      ],
      look: DIA,
      drift: 0.3,
      scene: (t) => (
        <>
          <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }]} />
          {macacaNariz(t, T)}
        </>
      ),
    },
    // até espirrar: cabeça vai para trás, nuvenzinha, graveto sai; esse é seu cotonete (mostra o graveto)
    {
      from: corte,
      to: S("lascas"),
      keys: [
        { t: corte, pos: add(FN, [-0.72, 0.62, 0.95]), look: add(FN, [-0.03, 0.47, 0.14]), fov: 36 },
        { t: S("lascas"), pos: add(FN, [-0.64, 0.6, 0.86]), look: add(FN, [-0.03, 0.48, 0.14]), fov: 35 },
      ],
      look: DIA,
      drift: 0.3,
      scene: (t) => (
        <>
          <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }]} />
          {macacaNariz(t, T)}
        </>
      ),
    },
  ];
};

// ============================================================ COBRA
// jararaca: entra pela direita, rasteja até CC e para em alerta (frente erguida). Velocidade 0,55 un/s, freia em 0,6 s.
const JAR_L = 1.7, JAR_R = 0.036, JAR_V = 0.55, JAR_FREIO = 0.6;
const JAR_DE: V3 = [3.4, 0, 1.75];
const JAR_ANG = Math.atan2(0.5, -3.2);
const JAR_CAM = caminhoCobra(JAR_DE, JAR_ANG, 0.085, 0.72, chaoY);
const JAR_SFIM = 3.25;
const CC: V3 = JAR_CAM(JAR_SFIM); // onde a cabeça para (centro do cerco)
const frenteJar = (t: number, tPara: number) => {
  const tau = Math.max(0, tPara - t);
  const resta = tau < JAR_FREIO ? (JAR_V * tau * tau) / (2 * JAR_FREIO) : (JAR_V * JAR_FREIO) / 2 + JAR_V * (tau - JAR_FREIO);
  return JAR_SFIM - resta;
};
const Jararaca: React.FC<{ t: number; tPara: number; tErgue: number; olhar?: number }> = ({ t, tPara, tErgue, olhar = 0 }) => {
  const er = prog(t, tErgue - 0.3, tErgue + 0.4);
  return <Serpente t={t} tipo="jararaca" corpo={corpoNoCaminho(JAR_CAM, frenteJar(t, tPara), JAR_L, JAR_R, er * 0.9)} raio={JAR_R} ergueCabeca={er * 0.25} giroCabeca={olhar} />;
};
// bando do cerco: posição final (relativa a CC) e fator de onde vem (de fora do quadro)
const CERCO: { o: V3; de: number; fem?: boolean; ph: number }[] = [
  { o: [-0.3, 0, 0.82], de: 2.6, ph: 0.0 },
  { o: [-0.74, 0, 0.3], de: 2.3, fem: true, ph: 0.3 },
  { o: [-0.5, 0, -0.62], de: 2.6, ph: 0.55 },
  { o: [0.36, 0, -0.78], de: 2.6, fem: true, ph: 0.8 },
  { o: [0.8, 0, 0.3], de: 2.3, ph: 0.15 },
];
const BandoCerco: React.FC<{ t: number; t0: number; t1: number; tGrito: number }> = ({ t, t0, t1, tGrito }) => (
  <>
    {CERCO.map((m, i) => {
      const fim = add(CC, m.o);
      const ini = add(CC, mul(m.o, m.de));
      const ti = t0 + i * 0.06, tf = t1 + (i % 2) * 0.08;
      const k = prog(t, ti, tf);
      const kk = prog(t + 1 / 30, ti, tf);
      const D = len(sub(fim, ini));
      const vel = ((kk - k) * D) * 30;
      const p = mixV(ini, fim, k);
      p[1] = chaoY(p[0], p[2]);
      const ps = passada(k * D, Math.min(1, vel / 0.35), "bipede", 0.5);
      const g = prog(t, tGrito + i * 0.05, tGrito + i * 0.05 + 0.18);
      const hop = Math.max(0, Math.sin((t - tGrito) * 2 * PI * 1.6 + m.ph * 6)) * 0.022 * g; // pulinhos de ameaça (1,6 Hz)
      const yaw = yawPara(p, CC);
      const braco = prog(t, tf - 0.4, tf + 0.2);
      const P: MacacoProps = {
        t: t + i * 0.37,
        sentar: 0,
        quadril: [0, -0.03 + ps.bob + hop, 0],
        inclinar: 0.12 * g,
        cabeca: [Math.sin(t * 1.3 + i) * 0.12, mix(0.15, 0.32, g)],
        position: p,
        rotation: [0, yaw, 0],
      };
      const ombro = (lado: 1 | -1): Mao => ({ alvo: mixV([-lado * 0.13, 0.36, 0.08], [-lado * 0.21, 0.6, 0.16], braco), palma: mixV([lado * 0.6, -1, 0.2], [0, 0.1, 1], braco) as V3, fechar: mix(0.45, 0.12, braco) });
      return (
        <group key={i}>
          <Mac {...P} femea={m.fem} grito={g} sobrancelha={-0.5 * g} peD={add(ps.peD, [0, -hop, 0])} peE={add(ps.peE, [0, -hop, 0])} maoD={ombro(1)} maoE={ombro(-1)} rabo={0.75} />
          <OndasGrito t={t + i * 0.21} forca={g} position={pontoCabeca(P, BOCA_L)} dir={frenteCabeca(P)} />
        </group>
      );
    })}
  </>
);
// cobra-cipó sendo comida: macaco sentado na laje segurando a cobra com as duas mãos, mordendo a ponta do rabo
const MK: V3 = [0.7, LAJE_TOPO, 0.35];
const MK_YAW = -0.45;
const comendoCobra = (t: number, tMorde: number, tFim: number) => {
  const morde = prog(t, tMorde - 0.25, tMorde, easeOut);
  const abre = pulso(t, tMorde - 0.55, tMorde + 0.02, 0.2);
  const masca = t > tMorde ? Math.max(0, Math.sin((t - tMorde) * 2 * PI * 2.2)) : 0; // 2,2 Hz
  const P: Pick<MacacoProps, "sentar" | "inclinar" | "cabeca" | "position"> = { sentar: 1, inclinar: 0.1 * morde, cabeca: [0.12, mix(0.12, 0.22, morde) + masca * 0.04], position: [0, 0, 0] };
  const boca = pontoCabeca(P, BOCA_L);
  const fr = frenteCabeca(P);
  const mD: V3 = add(boca, [-0.05, -0.1, 0.09]);
  const mE: V3 = add(boca, [0.06, -0.19, 0.07]);
  const r = 0.016;
  // eixo da cobra (espaço do macaco), do rabo (na boca) até a cabeça (deitada na laje)
  const rabo = add(boca, mul(fr, mix(0.05, -0.012, morde)));
  const pts: V3[] = [
    [-0.2, r, 0.46], // cabeça (deitada na laje, olhos fechados, à vista)
    [-0.05, r, 0.5],
    [0.12, r, 0.52],
    [0.24, r, 0.44],
    [0.14, r + 0.002, 0.36],
    [0.0, 0.03, 0.33],
    [0.0, 0.12, 0.26],
    add(mE, [0, -0.005, 0.0]),
    add(mD, [0, -0.005, 0.0]),
    add(boca, mul(fr, mix(0.1, 0.05, morde))),
    rabo,
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const corpo = (u: number): V3 => curve.getPointAt(Math.min(1, Math.max(0, u))).toArray() as V3;
  return (
    <Mac t={t} sentar={1} inclinar={P.inclinar} cabeca={P.cabeca} boca={Math.max(abre * 0.7, 0.12 + masca * 0.28)} piscar={0.55 * prog(t, tMorde + 0.1, tMorde + 0.4)} sobrancelha={0.4 * (1 - morde)} maoD={{ alvo: mD, palma: [1, 0, 0.3], fechar: 0.9 }} maoE={{ alvo: mE, palma: [-1, 0, 0.3], fechar: 0.9 }} rabo={0.5} position={MK} rotation={[0, MK_YAW, 0]}>
      <Serpente t={t} tipo="cipo" corpo={corpo} raio={r} lingua={0} olhos={0} />
    </Mac>
  );
};
const serraCobra = (t: number) => <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }, { x: CC[0], z: CC[2], r: 2.2 }, { x: CC[0] + 0.4, z: CC[2] + 2.6, r: 1.6 }]} />;

export const planosCobra = (w: W, S: Sf): PlanoNovo[] => {
  const tPara = w("gaviao", "venenosa") - 0.05;
  const a = w("gaviao", "venenosa") + 0.6; // corte para o cerco
  const b = w("gaviao", "se", 1); // corte para a cobra-cipó
  return [
    // mas no chão tem cobra: câmera rente ao chão; a jararaca entra pela direita e para em alerta no "venenosa"
    {
      from: S("gaviao"),
      to: a,
      // câmera parada no 1º segundo (a cabeça entra pela borda direita); depois UM trilho suave acompanhando a
      // cabeça até fechar nela no "venenosa" (poucas chaves: nada de micro-solavanco entre chaves)
      keys: (() => {
        const ent = S("gaviao") + 1.0;
        const h0 = JAR_CAM(frenteJar(ent, tPara) - 0.15);
        const h1 = CC;
        return [
          { t: S("gaviao"), pos: add(h0, [0.05, 0.2, 1.05]), look: add(h0, [0.05, 0.1, 0]), fov: 40 },
          { t: ent, pos: add(h0, [0.04, 0.2, 1.02]), look: add(h0, [0.04, 0.1, 0]), fov: 40 },
          { t: tPara + 0.1, pos: add(h1, [0.12, 0.24, 0.8]), look: add(h1, [0.03, 0.14, 0]), fov: 38 },
          { t: a, pos: add(h1, [0.1, 0.25, 0.68]), look: add(h1, [0.02, 0.16, 0]), fov: 37 },
        ] as Key[];
      })(),
      look: DIA,
      drift: 0.3,
      scene: (t) => (
        <>
          {serraCobra(t)}
          <Jararaca t={t} tPara={tPara} tErgue={w("gaviao", "venenosa")} olhar={0.9 * prog(t, tPara - 0.1, tPara + 0.5)} />
        </>
      ),
    },
    // o bando inteiro cerca e grita: grua sobe enquanto 5 macacos chegam pelas bordas e param em roda
    {
      from: a,
      to: b,
      keys: [
        { t: a, pos: add(CC, [0.55, 1.75, 2.3]), look: add(CC, [0, 0.15, -0.15]), fov: 46 },
        { t: w("gaviao", "grita"), pos: add(CC, [0.6, 2.55, 1.65]), look: add(CC, [0, 0.12, -0.05]), fov: 46 },
        { t: b, pos: add(CC, [0.58, 2.6, 1.55]), look: add(CC, [0, 0.12, -0.05]), fov: 45 },
      ],
      look: DIA,
      drift: 0.5,
      scene: (t) => (
        <>
          {serraCobra(t)}
          <Jararaca t={t} tPara={tPara} tErgue={w("gaviao", "venenosa")} olhar={0.9 - 0.7 * prog(t, a, a + 0.8) + 0.45 * Math.sin((t - a) * 1.5) * prog(t, a, a + 0.8)} />
          <BandoCerco t={t} t0={a - 0.45} t1={w("gaviao", "cerca") + 0.1} tGrito={w("gaviao", "grita") - 0.3} />
        </>
      ),
    },
    // se não é, vocês comem: cobra-cipó lisa e verde, mordida na ponta como petisco
    {
      from: b,
      to: S("alarme"),
      keys: [
        { t: b, pos: add(MK, [-0.15, 0.6, 1.55]), look: add(MK, [-0.05, 0.3, 0.22]), fov: 38 },
        { t: S("alarme"), pos: add(MK, [-0.14, 0.58, 1.42]), look: add(MK, [-0.05, 0.32, 0.22]), fov: 37 },
      ],
      look: DIA,
      drift: 0.4,
      scene: (t) => (
        <>
          <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }]} />
          {comendoCobra(t, w("gaviao", "comem") - 0.05, S("alarme"))}
        </>
      ),
    },
  ];
};

// ============================================================ ALARME
// sentinela na beira da laje vê a jararaca no chão à direita; os outros 4 em fila, cada vez mais longe da câmera
const SENT: V3 = [-0.35, LAJE_TOPO, 0.95];
const COBRA_AL_DE: V3 = [1.4, 0, 1.85];
const COBRA_AL = caminhoCobra(COBRA_AL_DE, PI + 0.1, 0.08, 0.7, chaoY);
const COBRA_AL_CAB: V3 = [0.15, 0, 1.75];
type Membro = { p: V3; yaw: number; fem?: boolean; alvo: V3; ouve: number; corre: number };
const BANDO_AL: Membro[] = [
  { p: [0.3, LAJE_TOPO, 0.2], yaw: -2.2, alvo: [0.12, 0, 0.62], ouve: 0, corre: 0 },
  { p: [-0.5, 0, -1.05], yaw: 1.2, fem: true, alvo: [-0.85, 0, 0.55], ouve: 0, corre: 0 },
  { p: [0.6, 0, -1.75], yaw: -0.6, alvo: [0.42, 0, 0.98], ouve: 0, corre: 0 },
  { p: [-0.12, 0, -2.45], yaw: 2.6, fem: true, alvo: [-0.5, 0, 0.12], ouve: 0, corre: 0 },
];
const sentinela = (t: number, T: { ve: number; grita: number; ate?: number }) => {
  const ve = prog(t, T.ve, T.ve + 0.3);
  const pe = prog(t, T.ve + 0.15, T.grita - 0.05);
  const g = prog(t, T.grita - 0.08, T.grita + 0.1) * (T.ate ? 1 - prog(t, T.ate - 0.2, T.ate) : 1);
  const yaw = yawPara(SENT, COBRA_AL_CAB); // virado para a cobra
  const P: MacacoProps = { t, sentar: 1 - pe, quadril: [0, -0.02 * pe, 0], inclinar: -0.05 * g, cabeca: [mix(-0.6, 0.0, ve), mix(0.1, 0.18, ve)], position: SENT, rotation: [0, yaw, 0] };
  const mao = (lado: 1 | -1): Mao => ({ alvo: mixV([-lado * 0.09, 0.2, 0.2], [-lado * 0.2, 0.56, 0.14], pe), palma: mixV([lado * 0.2, -1, 0.2], [0, 0.1, 1], pe) as V3, fechar: mix(0.35, 0.15, pe) });
  return (
    <>
      <Mac {...P} grito={g} sobrancelha={mix(0, 0.8, ve) * (1 - g) - 0.4 * g} maoD={mao(1)} maoE={mao(-1)} rabo={0.5 + 0.3 * pe} />
      <OndasGrito t={t} forca={g} position={pontoCabeca(P, BOCA_L)} dir={frenteCabeca(P)} alcance={0.3} />
    </>
  );
};
const membro = (t: number, i: number, T: { ouve: number[]; corre: number[]; chega: number[] }) => {
  const m = BANDO_AL[i];
  const ouve = prog(t, T.ouve[i], T.ouve[i] + 0.25);
  const g = prog(t, T.ouve[i] + 0.2, T.ouve[i] + 0.35) * (1 - prog(t, T.chega[i] - 0.3, T.chega[i]));
  const k = prog(t, T.corre[i], T.chega[i]);
  const kk = prog(t + 1 / 30, T.corre[i], T.chega[i]);
  const fim: V3 = [m.alvo[0], 0, m.alvo[2]];
  const D = len(sub(fim, [m.p[0], 0, m.p[2]]));
  const vel = (kk - k) * D * 30;
  const a = Math.min(1, vel / 0.5);
  const pos: V3 = mixV([m.p[0], 0, m.p[2]], fim, k);
  pos[1] = chaoY(pos[0], pos[2]);
  // vira o corpo para a sentinela ao ouvir; na corrida, para onde corre; ao chegar, olha para a cobra
  const ySent = yawPara(pos, SENT);
  const yRun = yawPara([m.p[0], 0, m.p[2]], fim);
  const yCobra = yawPara(pos, COBRA_AL_CAB);
  let yaw = m.yaw + dAng(m.yaw, ySent) * ouve;
  yaw = yaw + dAng(yaw, yRun) * prog(t, T.corre[i] - 0.1, T.corre[i] + 0.15);
  yaw = yaw + dAng(yaw, yCobra) * prog(t, T.chega[i] - 0.15, T.chega[i] + 0.35);
  const corre = a * pulso(t, T.corre[i], T.chega[i], 0.15);
  const ps4 = passada(k * D, corre, "quatro", 0.72);
  const levanta = Math.max(ouve * (1 - prog(t, T.corre[i] - 0.1, T.corre[i] + 0.1)), prog(t, T.chega[i] - 0.05, T.chega[i] + 0.3));
  const quatro = prog(t, T.corre[i] - 0.12, T.corre[i] + 0.08) * (1 - prog(t, T.chega[i] - 0.15, T.chega[i] + 0.15));
  const sentado = 1 - Math.max(levanta, quatro);
  const P: MacacoProps = {
    t: t + i * 0.41,
    sentar: sentado,
    inclinar: QUATRO.inclinar * quatro - 0.05 * g,
    quadril: mixV([0, -0.02 * (1 - sentado), 0], add(QUATRO.quadril, [0, ps4.bob, 0]), quatro),
    cabeca: [Math.sin(t * 0.9 + i) * 0.2 * (1 - ouve), mix(0.25, 0.08, ouve) + QUATRO.cabecaPitch * quatro],
    position: pos,
    rotation: [0, yaw, 0],
  };
  const peRest = (lado: 1 | -1): V3 => [-lado * mix(0.075, 0.085, sentado), 0.03, mix(0.0, 0.17, sentado)];
  const peD = mixV(peRest(1), ps4.peD, quatro), peE = mixV(peRest(-1), ps4.peE, quatro);
  const maoAlerta = (lado: 1 | -1): V3 => mixV([-lado * 0.09, 0.2, 0.2], [-lado * 0.13, 0.34, 0.12], 1 - sentado);
  const maoD: Mao = { alvo: mixV(maoAlerta(1), ps4.maoD!, quatro), palma: [0, -1, 0.3], fechar: 0.45 };
  const maoE: Mao = { alvo: mixV(maoAlerta(-1), ps4.maoE!, quatro), palma: [0, -1, 0.3], fechar: 0.45 };
  return (
    <group key={i}>
      <Mac {...P} femea={m.fem} grito={g} sobrancelha={0.8 * ouve * (1 - g) - 0.3 * g} peD={peD} peE={peE} maoD={maoD} maoE={maoE} rabo={0.5} />
      <OndasGrito t={t + i * 0.3} forca={g} position={pontoCabeca(P, BOCA_L)} dir={frenteCabeca(P)} alcance={0.3} />
    </group>
  );
};
const serraAlarme = (t: number) => <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.8 }, { x: 1.4, z: 2.4, r: 1.8 }]} />;

export const planosAlarme = (w: W, S: Sf): PlanoNovo[] => {
  const a = w("alarme", "avisa"); // corte para o plano aberto
  const b = w("alarme", "esse"); // corte para o bando junto
  const ouve = [a + 0.25, a + 0.6, a + 0.95, a + 1.3];
  const corre = [ouve[0] + 0.7, ouve[1] + 0.65, ouve[2] + 0.55, ouve[3] + 0.45];
  const chega = [corre[0] + 0.55, corre[1] + 0.85, corre[2] + 1.05, b - 0.05];
  const T = { ouve, corre, chega };
  const jararacaAl = (t: number) => <Serpente t={t} tipo="jararaca" corpo={corpoNoCaminho(COBRA_AL, 1.1 + (t - S("alarme")) * 0.12, JAR_L, JAR_R, 0.5)} raio={JAR_R} ergueCabeca={0.12} />;
  return [
    // por isso vocês têm grito de alarme: a sentinela vê a jararaca, fica de pé e grita
    {
      from: S("alarme"),
      to: a,
      keys: [
        { t: S("alarme"), pos: add(SENT, [0.75, 1.05, 2.5]), look: add(SENT, [0.38, 0.22, 0.42]), fov: 40 },
        { t: a, pos: add(SENT, [0.7, 1.0, 2.3]), look: add(SENT, [0.36, 0.26, 0.4]), fov: 39 },
      ],
      look: DIA,
      drift: 0.4,
      scene: (t) => (
        <>
          {serraAlarme(t)}
          {jararacaAl(t)}
          {sentinela(t, { ve: S("alarme") + 0.15, grita: w("alarme", "grito") })}
        </>
      ),
    },
    // um avisa, e o bando inteiro fica sabendo: o grito acende de macaco em macaco e todos correm para perto
    {
      from: a,
      to: b,
      keys: [
        { t: a, pos: [0.8, 1.8, 3.45], look: [-0.1, 0.25, -0.85], fov: 46 },
        { t: b, pos: [0.72, 1.6, 3.2], look: [-0.15, 0.3, -0.2], fov: 45 },
      ],
      look: DIA,
      drift: 0.5,
      scene: (t) => (
        <>
          {serraAlarme(t)}
          {jararacaAl(t)}
          {sentinela(t, { ve: S("alarme") + 0.15, grita: w("alarme", "grito"), ate: chega[3] - 0.2 })}
          {BANDO_AL.map((_, i) => membro(t, i, T))}
        </>
      ),
    },
    // esse é seu grupo da família: o bando todo junto, de pé, olhando a cobra
    {
      from: b,
      to: S("virada"),
      keys: [
        { t: b, pos: [0.5, 1.15, 3.55], look: [-0.2, 0.36, 0.55], fov: 42 },
        { t: S("virada"), pos: [0.46, 1.1, 3.35], look: [-0.2, 0.38, 0.55], fov: 41 },
      ],
      look: DIA,
      drift: 0.4,
      scene: (t) => (
        <>
          {serraAlarme(t)}
          {sentinela(t, { ve: S("alarme") + 0.15, grita: w("alarme", "grito"), ate: chega[3] - 0.2 })}
          {BANDO_AL.map((_, i) => membro(t, i, T))}
        </>
      ),
    },
  ];
};

// ============================================================ composição de teste (mesmo tempo do vídeo)
const TL = timelineJson as Timeline;
const FPS = 30;
const OFF = 0.5;
export const macacoNovasDuration = (fps: number) => Math.ceil((TL.duration + OFF + 0.4) * fps);
const w: W = (c, word, n = 0) => wordAt(TL, c, word, n) + OFF;
const S: Sf = (c) => cena(TL, c).start + OFF;
const PLANOS: PlanoNovo[] = [...planosCotonete(w, S), ...planosCobra(w, S), ...planosAlarme(w, S)];
const WORDS: Word[] = TL.cenas.flatMap((c) => {
  const ws = c.words.map((x) => ({ ...x, s: x.s + OFF, e: x.e + OFF }));
  if (!c.label) return ws;
  const i = ws.findIndex((x, k) => /^ess[ea]$/i.test(x.w) && k > ws.length - 7);
  return ws.map((x, k) => (i >= 0 && k >= i + 3 ? { ...x, kw: true } : x));
});
export const MacacoNovas: React.FC = () => {
  useKitFont();
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#CFE6EF" }}>
        {PLANOS.map((p, i) => {
          const L = p.look ?? DIA;
          return (
            <Shot key={i} from={p.from} to={p.to} sun={L.sun} sunPower={L.sunPower} ambient={L.ambient} shadowSize={L.shadowSize} exposure={L.exposure}>
              {(t) => (
                <>
                  <CameraRig keys={p.keys} offset={p.from} drift={p.drift ?? 1} />
                  {p.scene(t)}
                </>
              )}
            </Shot>
          );
        })}
        <ApelidoAmarelo de={w("cotonete", "cotonete")} ate={S("lascas")} texto="Cotonete" />
        <ApelidoAmarelo de={w("alarme", "grupo")} ate={S("virada")} texto="Grupo da família" tamanho={86} />
        <Legenda1Palavra palavras={WORDS} />
        <Sequence from={Math.round(OFF * FPS)} layout="none">
          <Audio src={staticFile("animal_macaco/narracao.wav")} />
        </Sequence>
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};
