import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import { createContext, useContext } from "react";
import { getInputProps } from "remotion";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, spring as SP } from "../theme";
import { useTimeline } from "./timeline";

const stroke = (px: number, color = C.ink) => ({
  WebkitTextStroke: `${px}px ${color}`,
  paintOrder: "stroke fill" as const,
});

// Legenda palavra por palavra (uma palavra por vez, com "pop").
const _Captions: React.FC<{ y?: number }> = ({ y = 1180 }) => {
  const t = useTimeline();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const words = t.cenas.flatMap((c) => c.words);
  const idx = words.findIndex((w, i) => sec >= w.s && sec < (words.at(i + 1)?.s ?? w.e + 0.35));
  const w = idx >= 0 ? words.at(idx) : undefined;
  if (!w || sec > w.e + 0.6) return null;
  const local = frame - Math.round(w.s * fps);
  const p = spring({ frame: local, fps, config: SP.snappy });
  const text = w.w.replace(/[.,:;!?"]+$/g, "").replace(/^["]+/, "");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: y,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: w.kw ? 112 : 96,
          lineHeight: 1,
          letterSpacing: -1,
          color: w.kw ? C.accent : "#FFFFFF",
          ...stroke(16),
          textShadow: "0 8px 0 rgba(0,0,0,0.25)",
          transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px) scale(${interpolate(p, [0, 1], [0.7, 1])})`,
          opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Rótulo-pílula do topo: nome da etapa, troca com animação.
const _TopLabel: React.FC = () => {
  const t = useTimeline();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const c = t.cenas.find((x) => sec >= x.start - 0.1 && sec < x.end + 0.22);
  if (!c || !c.label) return null;
  // conta a entrada a partir da primeira cena seguida com o mesmo rótulo
  let first = c;
  for (const x of t.cenas) {
    if (x.label === c.label && x.end + 0.3 >= first.start && x.start <= first.start) first = x;
  }
  const local = frame - Math.round(first.start * fps);
  const p = spring({ frame: local, fps, config: SP.bouncy });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 150, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 36px 14px 26px",
            borderRadius: 999,
            background: "rgba(22,24,29,0.88)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: 2,
            color: "#fff",
            transform: `translateY(${interpolate(p, [0, 1], [-40, 0])}px) scale(${interpolate(p, [0, 1], [0.6, 1])})`,
            opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 11, background: C.accent, boxShadow: `0 0 18px ${C.accent}` }} />
          {c.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Faixa final "SABIA? COMENTE" + palavra-chave.
const _CTA: React.FC<{ at: number }> = ({ at }) => {
  const t = useTimeline();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(at * fps);
  if (local < 0) return null;
  const a = spring({ frame: local, fps, config: SP.bouncy });
  const b = spring({ frame: local - 6, fps, config: SP.bouncy });
  const pulse = 1 + Math.sin(local / 5) * 0.03;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800 }}>
        <div style={{ fontSize: 64, color: "#fff", ...stroke(12), transform: `scale(${a})`, opacity: a }}>SABIA? COMENTE</div>
        <div
          style={{
            marginTop: 10,
            fontSize: 150,
            lineHeight: 1,
            color: C.accent,
            ...stroke(18),
            textShadow: "0 10px 0 rgba(0,0,0,0.25)",
            transform: `scale(${b * pulse})`,
            opacity: Math.min(b * 2, 1),
          }}
        >
          “{t.cta}”
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Ícone de certo/errado desenhado em SVG (sem emoji).
const _Mark: React.FC<{ at: number; kind: "ok" | "x" | "q"; x?: number; y?: number; size?: number; until?: number }> = ({
  at,
  kind,
  x = 540,
  y = 760,
  size = 260,
  until,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(at * fps);
  if (local < 0) return null;
  if (until !== undefined && frame > until * fps) return null;
  const p = spring({ frame: local, fps, config: SP.bouncy });
  const draw = interpolate(local, [2, 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const color = kind === "ok" ? C.good : C.bad;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ position: "absolute", left: x - size / 2, top: y - size / 2, transform: `scale(${p}) rotate(${kind === "q" ? Math.sin(local / 6) * 6 : 0}deg)`, filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.25))" }}
      >
        {kind === "q" ? (
          <>
            <path d="M32 34 Q32 14 50 14 Q68 14 68 32 Q68 44 54 50 Q50 52 50 60" fill="none" stroke={C.ink} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="82" r="11" fill={C.ink} />
            <path d="M32 34 Q32 14 50 14 Q68 14 68 32 Q68 44 54 50 Q50 52 50 60" fill="none" stroke={C.accent} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="82" r="7" fill={C.accent} />
          </>
        ) : kind === "ok" ? (
          <>
            <path d="M18 54 L42 76 L84 26" fill="none" stroke={C.ink} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
            <path d="M18 54 L42 76 L84 26" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
          </>
        ) : (
          <>
            <path d="M22 22 L78 78 M78 22 L22 78" fill="none" stroke={C.ink} strokeWidth={22} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
            <path d="M22 22 L78 78 M78 22 L22 78" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
};

// Texto grande pontual (ex.: "7.500 W"), com contador opcional.
const _BigText: React.FC<{
  at: number;
  until: number;
  text?: string;
  count?: { to: number; suffix: string };
  y?: number;
  color?: string;
  size?: number;
}> = ({ at, until, text, count, y = 520, color = "#fff", size = 130 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(at * fps);
  if (local < 0 || frame > until * fps) return null;
  const p = spring({ frame: local, fps, config: SP.bouncy });
  const out = interpolate(frame, [until * fps - 8, until * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let label = text ?? "";
  if (count) {
    const v = interpolate(spring({ frame: local, fps, config: { damping: 30, stiffness: 50 } }), [0, 1], [0, count.to]);
    label = `${Math.round(v).toLocaleString("pt-BR")}${count.suffix}`;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: y,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: size,
          color,
          fontVariantNumeric: "tabular-nums",
          ...stroke(16),
          textShadow: "0 10px 0 rgba(0,0,0,0.25)",
          transform: `scale(${p}) translateY(${(1 - out) * -30}px)`,
          opacity: out,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

// Etiqueta pequena presa a um ponto da tela (ex.: VERÃO / INVERNO).
const _Tag: React.FC<{ at: number; until: number; text: string; x: number; y: number; color?: string }> = ({
  at,
  until,
  text,
  x,
  y,
  color = C.ink,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(at * fps);
  if (local < 0 || frame > until * fps) return null;
  const p = spring({ frame: local, fps, config: SP.bouncy });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${p})`,
        padding: "10px 28px 6px",
        borderRadius: 18,
        background: color,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 54,
        letterSpacing: 1,
        boxShadow: "0 8px 0 rgba(0,0,0,0.22)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// Acabamento: gradação leve, vinheta e grão.
const _Finish: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.10), transparent 22%, transparent 78%, rgba(0,0,0,0.16))" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.20) 100%)" }} />
      <AbsoluteFill
        style={{
          backgroundImage: noise,
          backgroundSize: "220px",
          backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
          opacity: 0.045,
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};

// Flash branco curto para cortes entre cenários.
const _Flash: React.FC<{ at: number[] }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = Math.max(
    0,
    ...at.map((s) => {
      const f = s * fps;
      return interpolate(frame, [f - 3, f, f + 7], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }),
  );
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};

// Em capas (CoverCtx = true) os textos sobrepostos do vídeo somem.
export const CoverCtx = createContext(Boolean((getInputProps() as { cover?: boolean }).cover));
type P<T> = T extends React.FC<infer Q> ? Q : never;
export const Captions: React.FC<P<typeof _Captions>> = (p) => (useContext(CoverCtx) ? null : <_Captions {...p} />);
export const TopLabel: React.FC<P<typeof _TopLabel>> = (p) => (useContext(CoverCtx) ? null : <_TopLabel {...p} />);
export const CTA: React.FC<P<typeof _CTA>> = (p) => (useContext(CoverCtx) ? null : <_CTA {...p} />);
export const Mark: React.FC<P<typeof _Mark>> = (p) => (useContext(CoverCtx) ? null : <_Mark {...p} />);
export const BigText: React.FC<P<typeof _BigText>> = (p) => (useContext(CoverCtx) ? null : <_BigText {...p} />);
export const Tag: React.FC<P<typeof _Tag>> = (p) => (useContext(CoverCtx) ? null : <_Tag {...p} />);
export const Finish: React.FC<P<typeof _Finish>> = (p) => (useContext(CoverCtx) ? null : <_Finish {...p} />);
export const Flash: React.FC<P<typeof _Flash>> = (p) => (useContext(CoverCtx) ? null : <_Flash {...p} />);
