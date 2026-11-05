import { useContext } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverCtx } from "../../engine/Overlays";
import { AMARELO, FONT_KIT, TINTA } from "./ui";

// Elementos de tela do vídeo da lagartixa (somem em capas, como os outros textos).
const useJanela = (de: number, ate: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const local = frame - Math.round(de * fps);
  const inn = spring({ frame: local, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const out = interpolate(sec, [ate - 0.18, ate], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { on: sec >= de && sec < ate, inn, out, sec };
};
const stroke = (w: number) => ({ WebkitTextStroke: `${w}px ${TINTA}`, paintOrder: "stroke fill" as const });

// etiqueta pequena (REPLAY · CÂMERA LENTA, ESQUEMA, provavelmente…)
const _Etiqueta: React.FC<{ de: number; ate: number; texto: string; x?: number; y?: number; cor?: string; tamanho?: number }> = ({ de, ate, texto, x = 540, y = 560, cor = "#FFFFFF", tamanho = 44 }) => {
  const { on, inn, out } = useJanela(de, ate);
  if (!on) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - 400, width: 800, top: y, textAlign: "center", opacity: Math.min(1, inn * 2) * out, transform: `scale(${interpolate(inn, [0, 1], [0.7, 1])})` }}>
        <span style={{ display: "inline-block", padding: "8px 22px", borderRadius: 14, background: "rgba(20,22,27,0.82)", color: cor, fontFamily: FONT_KIT, fontWeight: 900, fontSize: tamanho, letterSpacing: 2 }}>{texto}</span>
      </div>
    </AbsoluteFill>
  );
};
// duas réguas: rabo (amarela) cresce 3 traços para cada 1 do cabelo (azul)
const _Reguas: React.FC<{ de: number; ate: number; y?: number }> = ({ de, ate, y = 1480 }) => {
  const { on, inn, out, sec } = useJanela(de, ate);
  if (!on) return null;
  const k = interpolate(sec, [de + 0.3, ate - 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const passos = Math.floor(k * 3.999); // degraus de 1 "dia"
  const sub = k * 3.999 - passos;
  const suave = passos + Math.min(1, sub / 0.25);
  const L = 120; // px por "dia" no rabo
  const barra = (x: number, cor: string, comp: number, rot: string, ticks: number) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-30} y={-380} width={60} height={400} rx={10} fill="rgba(20,22,27,0.6)" />
      {Array.from({ length: ticks }).map((_, i) => (
        <line key={i} x1={-30} x2={-6} y1={-i * 40} y2={-i * 40} stroke="#FFFFFF" strokeWidth={4} />
      ))}
      <rect x={-14} y={-comp} width={28} height={comp} rx={8} fill={cor} stroke={TINTA} strokeWidth={5} />
      <text x={0} y={70} textAnchor="middle" fontFamily={FONT_KIT} fontWeight={900} fontSize={40} fill={cor} stroke={TINTA} strokeWidth={8} paintOrder="stroke">
        {rot}
      </text>
    </g>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: Math.min(1, inn * 2) * out }}>
        {barra(380, AMARELO, (suave * L) / 1.0, "RABO", 10)}
        {barra(700, "#8FD0FF", (suave * L) / 3, "CABELO", 10)}
      </svg>
    </AbsoluteFill>
  );
};
// seta animada de um ponto a outro (px), com ponta
const _Seta: React.FC<{ de: number; ate: number; x0: number; y0: number; x1: number; y1: number; cor?: string }> = ({ de, ate, x0, y0, x1, y1, cor = AMARELO }) => {
  const { on, out, sec } = useJanela(de, ate);
  if (!on) return null;
  const k = interpolate(sec, [de, de + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
  const a = Math.atan2(y1 - y0, x1 - x0);
  const p = 34;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: out }}>
        <line x1={x0} y1={y0} x2={x} y2={y} stroke={TINTA} strokeWidth={22} strokeLinecap="round" />
        <line x1={x0} y1={y0} x2={x} y2={y} stroke={cor} strokeWidth={12} strokeLinecap="round" />
        <polygon points={`${x},${y} ${x - p * Math.cos(a - 0.5)},${y - p * Math.sin(a - 0.5)} ${x - p * Math.cos(a + 0.5)},${y - p * Math.sin(a + 0.5)}`} fill={cor} stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};
// X vermelho (falhou) num ponto
const _Xis: React.FC<{ de: number; ate: number; x: number; y: number; r?: number }> = ({ de, ate, x, y, r = 46 }) => {
  const { on, inn, out } = useJanela(de, ate);
  if (!on) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: out }}>
        <g transform={`translate(${x} ${y}) scale(${interpolate(inn, [0, 1], [0.3, 1])})`} stroke="#E8352B" strokeWidth={18} strokeLinecap="round">
          <line x1={-r} y1={-r} x2={r} y2={r} />
          <line x1={r} y1={-r} x2={-r} y2={r} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
// rota África → Brasil (mapa esquemático: duas costas e um navio que cruza)
// mapa: América do Sul (Brasil em destaque) ← navio ← África; silhuetas reconhecíveis, painel na parte de baixo da tela
const SUL = [[60,0],[120,8],[170,38],[228,78],[252,102],[236,136],[204,170],[172,212],[146,250],[128,262],[118,232],[102,192],[82,142],[52,104],[30,62],[38,22]];
const AFR = [[70,0],[150,-6],[205,24],[236,66],[226,110],[204,150],[184,198],[162,246],[140,262],[122,222],[112,172],[98,134],[64,120],[22,96],[8,62],[30,22]];
const poli = (pts: number[][], ox: number, oy: number, s = 1) => pts.map(([x, y], i) => `${i ? "L" : "M"} ${ox + x * s} ${oy + y * s}`).join(" ") + " Z";
const _RotaAfrica: React.FC<{ de: number; ate: number; y?: number }> = ({ de, ate, y = 1430 }) => {
  const { on, inn, out, sec } = useJanela(de, ate);
  if (!on) return null;
  const k = interpolate(sec, [de + 0.5, de + 2.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const P = (u: number) => {
    // Bézier: costa oeste da África → Nordeste do Brasil
    const x0 = 712, y0 = 115, cx = 520, cy = 20, x1 = 340, y1 = 120;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1];
  };
  const pts = Array.from({ length: 41 }, (_, i) => P((i / 40) * k));
  const [nx, ny] = P(k);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: Math.min(1, inn * 2) * out }}>
        <g transform={`translate(0 ${y})`}>
          <rect x={70} y={-40} width={940} height={360} rx={28} fill="rgba(175,212,230,0.94)" stroke={TINTA} strokeWidth={6} />
          <path d={poli(SUL, 100, 0, 1.15)} fill="#9DBF7A" stroke={TINTA} strokeWidth={5} />
          <path d={poli(AFR, 700, -10, 1.15)} fill="#D7B46A" stroke={TINTA} strokeWidth={5} />
          <text x={230} y={190} textAnchor="middle" fontFamily={FONT_KIT} fontWeight={900} fontSize={38} fill={TINTA}>BRASIL</text>
          <text x={870} y={190} textAnchor="middle" fontFamily={FONT_KIT} fontWeight={900} fontSize={38} fill={TINTA}>ÁFRICA</text>
          <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#B5442E" strokeWidth={7} strokeDasharray="16 12" />
          <g transform={`translate(${nx} ${ny - 18})`}>
            <path d="M -34 0 L 34 0 L 24 18 L -24 18 Z" fill="#6E4528" stroke={TINTA} strokeWidth={4} />
            <line x1={0} y1={0} x2={0} y2={-46} stroke={TINTA} strokeWidth={5} />
            <path d="M 2 -44 L 30 -10 L 2 -10 Z" fill="#FFFFFF" stroke={TINTA} strokeWidth={4} />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
type P<T> = T extends React.FC<infer X> ? X : never;
export const Etiqueta: React.FC<P<typeof _Etiqueta>> = (p) => (useContext(CoverCtx) ? null : <_Etiqueta {...p} />);
export const Reguas: React.FC<P<typeof _Reguas>> = (p) => (useContext(CoverCtx) ? null : <_Reguas {...p} />);
export const Seta: React.FC<P<typeof _Seta>> = (p) => (useContext(CoverCtx) ? null : <_Seta {...p} />);
export const Xis: React.FC<P<typeof _Xis>> = (p) => (useContext(CoverCtx) ? null : <_Xis {...p} />);
export const RotaAfrica: React.FC<P<typeof _RotaAfrica>> = (p) => (useContext(CoverCtx) ? null : <_RotaAfrica {...p} />);
void stroke;
