import { useContext } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverCtx } from "../../engine/Overlays";
import { AMARELO, FONT_KIT, TINTA } from "./ui";

// Elementos de tela extras do macaco (somem em capas, como os outros textos).
const useJanela = (de: number, ate: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const local = frame - Math.round(de * fps);
  const inn = spring({ frame: local, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const out = interpolate(sec, [ate - 0.18, ate], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { on: sec >= de && sec < ate, inn, out, sec };
};

// pizza amarela que enche até `fracao` (ex.: 1/3 do peso), logo abaixo do número do topo
const _Pizza: React.FC<{ de: number; ate: number; fracao: number; y?: number; raio?: number }> = ({ de, ate, fracao, y = 470, raio = 95 }) => {
  const { on, inn, out, sec } = useJanela(de, ate);
  if (!on) return null;
  const f = fracao * interpolate(sec, [de + 0.15, de + 0.75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = f * Math.PI * 2;
  const x = Math.sin(a) * raio, yy = -Math.cos(a) * raio;
  const big = f > 0.5 ? 1 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: Math.min(1, inn * 2) * out }}>
        <g transform={`translate(540 ${y}) scale(${interpolate(inn, [0, 1], [0.5, 1])})`}>
          <circle r={raio + 9} fill={TINTA} />
          <circle r={raio} fill="#FFFFFF" />
          {f > 0.001 ? <path d={`M0 0 L0 ${-raio} A${raio} ${raio} 0 ${big} 1 ${x} ${yy} Z`} fill={AMARELO} stroke={TINTA} strokeWidth={6} strokeLinejoin="round" /> : null}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// relógio que gira rápido (passar de horas / quase uma hora); `minutos` = rótulo opcional embaixo
const _Relogio: React.FC<{ de: number; ate: number; voltas?: number; x?: number; y?: number; raio?: number; rotulo?: string }> = ({ de, ate, voltas = 6, x = 860, y = 560, raio = 92, rotulo }) => {
  const { on, inn, out, sec } = useJanela(de, ate);
  if (!on) return null;
  const k = interpolate(sec, [de, ate], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const aMin = k * voltas * 360;
  const aHr = aMin / 12;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: Math.min(1, inn * 2) * out }}>
        <g transform={`translate(${x} ${y}) scale(${interpolate(inn, [0, 1], [0.4, 1])})`}>
          <circle r={raio + 10} fill={TINTA} />
          <circle r={raio} fill="#FFFFFF" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={Math.sin(a) * raio * 0.78} y1={-Math.cos(a) * raio * 0.78} x2={Math.sin(a) * raio * 0.92} y2={-Math.cos(a) * raio * 0.92} stroke={TINTA} strokeWidth={i % 3 ? 4 : 8} strokeLinecap="round" />;
          })}
          <line x1={0} y1={0} x2={Math.sin((aHr * Math.PI) / 180) * raio * 0.5} y2={-Math.cos((aHr * Math.PI) / 180) * raio * 0.5} stroke={TINTA} strokeWidth={11} strokeLinecap="round" />
          <line x1={0} y1={0} x2={Math.sin((aMin * Math.PI) / 180) * raio * 0.78} y2={-Math.cos((aMin * Math.PI) / 180) * raio * 0.78} stroke={AMARELO} strokeWidth={9} strokeLinecap="round" />
          <circle r={9} fill={TINTA} />
        </g>
      </svg>
      {rotulo ? (
        <div style={{ position: "absolute", left: x - 160, width: 320, top: y + raio + 18, textAlign: "center", fontFamily: FONT_KIT, fontWeight: 900, fontSize: 46, color: AMARELO, WebkitTextStroke: `8px ${TINTA}`, paintOrder: "stroke fill", opacity: out }}>{rotulo}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// rótulos pequenos "ESQUERDA" / "DIREITA" sob as duas lascas
const _Rotulos: React.FC<{ de: number; ate: number; itens: { x: number; y: number; texto: string }[] }> = ({ de, ate, itens }) => {
  const { on, inn, out } = useJanela(de, ate);
  if (!on) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {itens.map((it, i) => (
        <div key={i} style={{ position: "absolute", left: it.x - 200, width: 400, top: it.y, textAlign: "center", fontFamily: FONT_KIT, fontWeight: 900, fontSize: 54, color: "#FFFFFF", WebkitTextStroke: `9px ${TINTA}`, paintOrder: "stroke fill", opacity: Math.min(1, inn * 2) * out, transform: `scale(${interpolate(inn, [0, 1], [0.6, 1])})` }}>
          {it.texto}
        </div>
      ))}
    </AbsoluteFill>
  );
};

type P<T> = T extends React.FC<infer X> ? X : never;
export const Pizza: React.FC<P<typeof _Pizza>> = (p) => (useContext(CoverCtx) ? null : <_Pizza {...p} />);
export const Relogio: React.FC<P<typeof _Relogio>> = (p) => (useContext(CoverCtx) ? null : <_Relogio {...p} />);
export const Rotulos: React.FC<P<typeof _Rotulos>> = (p) => (useContext(CoverCtx) ? null : <_Rotulos {...p} />);
