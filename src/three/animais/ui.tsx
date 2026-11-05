import { useContext, useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverCtx } from "../../engine/Overlays";
import { TimelineCtx, Word } from "../../engine/timeline";

// =====================================================================
// INTERFACE do formato "Você é um [animal]" — igual à referência @vocessaoanimais:
// - NumeroTopo: número grande branco + subtítulo amarelo ("310° / DE VISÃO")
// - ApelidoAmarelo: apelido em amarelo no topo ("RETROVISOR")
// - Legenda1Palavra: uma palavra por vez, branca, palavras-chave em amarelo
// - PontoDeVista: tela escura com pontinhos/ondinhas (o que o bicho "sente")
// Os TEXTOS somem em capas (CoverCtx = true); PontoDeVista/TintaAgua ficam (são imagem). Tempos em segundos do vídeo.
// =====================================================================
export const AMARELO = "#FFD21F";
export const TINTA = "#14161B";
export const FONT_KIT = "'MontserratET', 'Baloo 2', system-ui, sans-serif";

let fontP: Promise<void> | null = null;
export const loadKitFont = () =>
  (fontP ??= Promise.all(
    [
      ["800", "montserrat-latin-800-normal.woff2"],
      ["900", "montserrat-latin-900-normal.woff2"],
      ["800", "montserrat-latin-ext-800-normal.woff2"],
      ["900", "montserrat-latin-ext-900-normal.woff2"],
    ].map(([w, f]) => new FontFace("MontserratET", `url(${staticFile(`animais/fonts/${f}`)})`, { weight: w }).load()),
  ).then((fs) => fs.forEach((f) => document.fonts.add(f))));
// Chame uma vez na composição (segura o render até a fonte carregar).
export const useKitFont = () => {
  const [h] = useState(() => delayRender("fonte Montserrat do kit"));
  useEffect(() => {
    loadKitFont()
      .catch(() => undefined)
      .then(() => continueRender(h));
  }, [h]);
};

const stroke = (px: number) => ({ WebkitTextStroke: `${px}px ${TINTA}`, paintOrder: "stroke fill" as const });
const SP = { damping: 12, stiffness: 180, mass: 0.6 };

const useWindow = (de: number, ate: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const local = frame - Math.round(de * fps);
  const inn = spring({ frame: local, fps, config: SP });
  const out = interpolate(sec, [ate - 0.18, ate], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { on: sec >= de && sec < ate, inn, out, local, fps, sec };
};

// Número grande + subtítulo amarelo. `contar` faz o número subir até o valor.
const _NumeroTopo: React.FC<{ de: number; ate: number; numero: string | number; sub?: string; contar?: boolean; y?: number; tamanho?: number; corNumero?: string }> = ({
  de,
  ate,
  numero,
  sub,
  contar = false,
  y = 210,
  tamanho = 150,
  corNumero = "#FFFFFF",
}) => {
  const { on, inn, out, local, fps } = useWindow(de, ate);
  if (!on) return null;
  let label = String(numero).toUpperCase();
  if (contar && typeof numero === "number") {
    const v = interpolate(local, [0, fps * 0.7], [0, numero], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
    label = Math.round(v).toLocaleString("pt-BR");
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: y, width: "100%", textAlign: "center", fontFamily: FONT_KIT, transform: `scale(${interpolate(inn, [0, 1], [0.5, 1])})`, opacity: Math.min(inn * 2, 1) * out }}>
        <div style={{ fontWeight: 900, fontSize: tamanho, lineHeight: 0.95, color: corNumero, letterSpacing: -2, ...stroke(14), textShadow: "0 8px 18px rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>{label}</div>
        {sub ? <div style={{ marginTop: 6, fontWeight: 900, fontSize: tamanho * 0.34, color: AMARELO, letterSpacing: 1, ...stroke(9), textShadow: "0 5px 12px rgba(0,0,0,0.35)" }}>{sub.toUpperCase()}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

// Apelido amarelo no topo ("Esse é seu DETECTOR DE METAIS").
const _ApelidoAmarelo: React.FC<{ de: number; ate: number; texto: string; y?: number; tamanho?: number }> = ({ de, ate, texto, y = 230, tamanho = 92 }) => {
  const { on, inn, out } = useWindow(de, ate);
  if (!on) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: y,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: FONT_KIT,
          fontWeight: 900,
          fontSize: tamanho,
          lineHeight: 1.0,
          color: AMARELO,
          letterSpacing: 0,
          ...stroke(13),
          textShadow: "0 8px 18px rgba(0,0,0,0.35)",
          transform: `rotate(-3deg) scale(${interpolate(inn, [0, 1], [0.4, 1])})`,
          opacity: Math.min(inn * 2, 1) * out,
        }}
      >
        {texto.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};

// Legenda de 1 palavra. Lê a timeline (TimelineCtx) ou `palavras`. Palavra-chave (kw) em amarelo.
const _Legenda1Palavra: React.FC<{ palavras?: Word[]; y?: number; tamanho?: number }> = ({ palavras, y = 1330, tamanho = 76 }) => {
  const tl = useContext(TimelineCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = palavras ?? tl?.cenas.flatMap((c) => c.words) ?? [];
  const sec = frame / fps;
  const idx = words.findIndex((w, i) => sec >= w.s && sec < (words.at(i + 1)?.s ?? w.e + 0.35));
  const w = idx >= 0 ? words.at(idx) : undefined;
  if (!w || sec > w.e + 0.6) return null;
  const local = frame - Math.round(w.s * fps);
  const p = spring({ frame: local, fps, config: { damping: 14, stiffness: 220, mass: 0.5 } });
  const raw = w.w.replace(/[.,:;!?"“”]+$/g, "").replace(/^["“]+/, "");
  const text = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: y,
          left: 40,
          right: 40,
          textAlign: "center",
          fontFamily: FONT_KIT,
          fontWeight: 800,
          fontSize: tamanho,
          lineHeight: 1,
          color: w.kw ? AMARELO : "#FFFFFF",
          ...stroke(9),
          textShadow: "0 4px 14px rgba(0,0,0,0.55)",
          transform: `scale(${interpolate(p, [0, 1], [0.82, 1])})`,
          opacity: interpolate(local, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Ponto de vista "de olho fechado": tela escura, ruído, e o pontinho onde está a presa
// com ondinhas se espalhando. x,y em px (1080×1920). cor: azul (sensor) ou amarelo (presa).
const _PontoDeVista: React.FC<{ de: number; ate: number; pontos: { x: number; y: number; de: number; cor?: string }[]; escuridao?: number }> = ({ de, ate, pontos, escuridao = 0.94 }) => {
  const { on, sec, local, fps } = useWindow(de, ate);
  if (!on) return null;
  const fadeIn = interpolate(local, [0, fps * 0.25], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(sec, [ate - 0.25, ate], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: fadeIn * fadeOut }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, rgba(10,22,32,${escuridao * 0.92}) 0%, rgba(2,4,8,${escuridao}) 70%)` }} />
      <AbsoluteFill style={{ backgroundImage: noise, backgroundSize: "200px", backgroundPosition: `${(local * 11) % 200}px ${(local * 17) % 200}px`, opacity: 0.08, mixBlendMode: "screen" }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {pontos.map((pt, i) => {
          const tt = sec - pt.de;
          if (tt < 0) return null;
          const c = pt.cor ?? AMARELO;
          const pulse = 0.75 + 0.25 * Math.sin(tt * 9);
          return (
            <g key={i}>
              {[0, 1, 2].map((k) => {
                const ph = ((tt / 1.1 + k / 3) % 1 + 1) % 1;
                return <circle key={k} cx={pt.x} cy={pt.y} r={14 + ph * 170} fill="none" stroke={c} strokeWidth={6 * (1 - ph) + 1} opacity={(1 - ph) * 0.85} />;
              })}
              <circle cx={pt.x} cy={pt.y} r={34 * pulse} fill={c} opacity={0.25} />
              <circle cx={pt.x} cy={pt.y} r={13 * pulse} fill={c} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// Tom de "embaixo d'água" para planos com câmera submersa.
const _TintaAgua: React.FC<{ de: number; ate: number; forca?: number }> = ({ de, ate, forca = 1 }) => {
  const { on, sec } = useWindow(de, ate);
  if (!on) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(140,230,240,0.22), rgba(10,80,110,0.38))", mixBlendMode: "multiply", opacity: forca }} />
      <AbsoluteFill style={{ background: `repeating-linear-gradient(${100 + Math.sin(sec) * 5}deg, rgba(255,255,255,0.05) 0 50px, transparent 50px 150px)`, opacity: forca }} />
    </AbsoluteFill>
  );
};

type P<T> = T extends React.FC<infer Q> ? Q : never;
export const NumeroTopo: React.FC<P<typeof _NumeroTopo>> = (p) => (useContext(CoverCtx) ? null : <_NumeroTopo {...p} />);
export const ApelidoAmarelo: React.FC<P<typeof _ApelidoAmarelo>> = (p) => (useContext(CoverCtx) ? null : <_ApelidoAmarelo {...p} />);
export const Legenda1Palavra: React.FC<P<typeof _Legenda1Palavra>> = (p) => (useContext(CoverCtx) ? null : <_Legenda1Palavra {...p} />);
// Ponto de vista e tinta d'água fazem parte da imagem (não são texto): continuam aparecendo em capas.
export const PontoDeVista = _PontoDeVista;
export const TintaAgua = _TintaAgua;
