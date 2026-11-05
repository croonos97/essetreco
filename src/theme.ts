import { Easing } from "remotion";

// Paleta única do canal. Nada de hex solto nos componentes.
export const C = {
  sky: "#9FD6F2",
  skyTop: "#6EBDE8",
  grass: "#78B85A",
  grassDark: "#5E9A47",
  dirt: "#B9784A",
  dirtDark: "#8F5634",
  street: "#5B5F66",
  sidewalk: "#C9C4BA",
  wall: "#F1E6D3",
  wallShade: "#E3D4BC",
  wallCut: "#D9C7A9",
  roof: "#D8693B",
  roofDark: "#B4532C",
  wood: "#A8693E",
  tile: "#EEF3F5",
  tileLine: "#C9D6DC",
  floor: "#B8C3C9",
  chrome: "#C8D0D6",
  white: "#FAFAF7",
  plastic: "#F4F4F0",
  rubber: "#2E2F33",
  copper: "#D08B4C",
  nichrome: "#8E9196",
  hot: "#FF4A1C",
  warm: "#FF9A3C",
  water: "#3FA8F0",
  waterDeep: "#1F7FD1",
  energy: "#FFD23F",
  good: "#3DBE5A",
  bad: "#E8352B",
  skin: "#F8CBA2",
  skinCold: "#D3DDF2",
  hair: "#3A2A20",
  shirt: "#F2C230",
  jeans: "#3E5C9A",
  towel: "#FFFFFF",
  ink: "#16181D",
  panel: "#9AA3AA",
  leaf: "#4FA453",
  leafDark: "#3D8A43",
  trunk: "#7A4E2D",
  cloud: "#FFFFFF",
  groundWire: "#3DBE5A",
  groundWire2: "#F2D230",
  accent: "#FF8A1E", // destaque das palavras-chave
};

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

export const spring = {
  snappy: { damping: 14, stiffness: 160, mass: 0.6 },
  smooth: { damping: 20, stiffness: 90, mass: 1 },
  bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
};

export const FONT = "'Baloo 2', 'Nunito', system-ui, sans-serif";
