import { createContext, useContext } from "react";
import { interpolate } from "remotion";
import { ease } from "../theme";

export type Word = { w: string; s: number; e: number; kw: boolean };
export type Cena = { id: string; label: string; start: number; end: number; words: Word[] };
export type Timeline = { id: string; cta: string; duration: number; cenas: Cena[] };

export const TimelineCtx = createContext<Timeline | null>(null);
export const useTimeline = () => {
  const t = useContext(TimelineCtx);
  if (!t) throw new Error("Timeline ausente");
  return t;
};

export const cena = (t: Timeline, id: string) => {
  const c = t.cenas.find((x) => x.id === id);
  if (!c) throw new Error(`Cena ${id} não existe`);
  return c;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Momento (em segundos) em que uma palavra da cena é dita. nth conta repetições.
export const wordAt = (t: Timeline, id: string, word: string, nth = 0) => {
  const c = cena(t, id);
  const hits = c.words.filter((w) => norm(w.w) === norm(word));
  const hit = hits.at(nth);
  if (!hit) throw new Error(`Palavra "${word}" não encontrada na cena ${id}`);
  return hit.s;
};

// Progresso suave 0..1 entre dois instantes (segundos), sempre com easing e clamp.
export const prog = (sec: number, a: number, b: number, e = ease.inOut) =>
  interpolate(sec, [a, b], [0, 1], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const lerp3 = (a: number[], b: number[], p: number) => a.map((v, i) => lerp(v, b.at(i) ?? v, p));

// Ângulo acumulado de algo que gira com velocidade variável (rad/s) entre t0 e t.
export const spin = (speed: (s: number) => number, t0: number, t: number, dt = 1 / 30) => {
  let a = 0;
  for (let s = t0; s < t; s += dt) a += speed(s) * Math.min(dt, t - s);
  return a;
};

// Entrada com leve "passar do ponto" (peça encaixando).
export const pop = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
