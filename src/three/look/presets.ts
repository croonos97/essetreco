// =====================================================================
// LOOK "ESSE TRECO" — presets de luz + pós por TIPO DE PLANO e por CENA.
// Tudo determinístico: nenhum valor depende do tempo de parede, de jitter ou de acumulação temporal.
// Unidade das distâncias: a da cena (no kit do pombo, cm).
// =====================================================================
export type V3 = [number, number, number];
export type ToneMode = "aces" | "agx" | "neutral";

export type LookCena = {
  // ---- IBL (ambiente gerado offline via PMREM a partir de um céu procedural; nada baixado) ----
  ceuZenite: string; // azul do céu no alto
  ceuHorizonte: string; // névoa quente no horizonte
  chao: string; // cor do chão visto pelo ambiente (rebatido difuso)
  iblIntensidade: number; // scene.environmentIntensity (céu procedural)
  hdri?: string; // arquivo em public/look/hdri/ (CC0); sem = céu procedural
  hdriIntensidade?: number;
  hdriLimite?: number; // pico de luminância do HDRI (o sol vira key direcional)
  hdriGiro?: number; // giro extra (rad) depois de alinhar o sol do HDRI com solDir
  // ---- luzes ----
  solDir: V3; // direção PARA o sol (normalizada na hora)
  solCor: string;
  solIntensidade: number;
  ceuCor: string; // fill frio (direcional fraca, sem sombra, do lado oposto ao sol)
  ceuIntensidade: number;
  rebateCor: string; // rebatido do concreto/calçada (de baixo para cima, sem sombra)
  rebateIntensidade: number;
  rimCor: string; // contraluz (spot atrás do bicho, oposto à câmera)
  // ---- atmosfera (perspectiva aérea na pós, por profundidade) ----
  nevoaCor: string;
  // ---- grading de cena ----
  fundoFrio: string; // tinta nas sombras (split-tone)
  altasQuentes: string; // tinta nos realces
  fundo: string; // cor de fundo do canvas (céu)
};

export type LookPlano = {
  exposicao: number; // pré-tone-map (linear)
  contraste: number; // contraste log em torno de 0,18 (1 = neutro)
  saturacao: number; // 1 = neutro
  temperatura: number; // −1 frio … +1 quente (balanço de branco)
  tinta: number; // −1 verde … +1 magenta
  splitForca: number; // 0…1 força do split-tone (sombras frias / altas quentes)
  rimIntensidade: number;
  rimAltura: number; // elevação do contraluz (rad)
  rimLado: number; // giro do contraluz para o lado (rad, 0 = exatamente atrás; lado oposto ao sol)
  rimAbertura: number; // ângulo do spot (rad)
  sombraMapa: number; // tamanho do mapa de sombra
  sombraRaio: number; // raio do filtro PCF (texels)
  ao: false | { raio: number; intensidade: number; queda: number; halfRes: boolean };
  bloom: false | { limiar: number; suave: number; intensidade: number; raio: number };
  dof: false | { faixa: number /* distância (cm) do plano de foco até o desfoque TOTAL (rampa smoothstep), não uma faixa nítida */; bokeh: number; resolucao: number }; // foco = distância câmera→alvo (calculado por quadro)
  nevoa: false | { perto: number; longe: number; quanto: number; dessatura: number }; // distâncias em unidades da cena
  vinheta: { offset: number; escuro: number };
  tone: ToneMode;
};

// ---------- CENA: marquise no centro, dia (sol baixo de fim de tarde, céu limpo) ----------
export const CENA_MARQUISE_DIA: LookCena = {
  ceuZenite: "#4F86D6",
  ceuHorizonte: "#F2DFC4",
  chao: "#9C8C76",
  iblIntensidade: 0.85,
  hdri: "german_town_street_2k.hdr",
  hdriIntensidade: 1.0,
  hdriLimite: 12,
  solDir: [-0.34, 0.36, 0.87], // = SOL_DIR do kit do pombo (continuidade com o storyboard)
  solCor: "#FFD3A0",
  solIntensidade: 3.4,
  ceuCor: "#BCD2FF",
  ceuIntensidade: 0.35,
  rebateCor: "#E8C9A0",
  rebateIntensidade: 0.35,
  rimCor: "#FFE6C4",
  nevoaCor: "#C9D6E6",
  fundoFrio: "#C9DAFF",
  altasQuentes: "#FFE7C9",
  fundo: "#9DBEE6",
};

// ---------- PLANOS ----------
const BASE: LookPlano = {
  exposicao: 1.0,
  contraste: 1.12,
  saturacao: 1.12,
  temperatura: 0,
  tinta: 0,
  splitForca: 0.35,
  rimIntensidade: 5,
  rimAltura: 0.45,
  rimLado: 0.9,
  rimAbertura: 0.45,
  sombraMapa: 2048,
  sombraRaio: 2.5,
  ao: { raio: 14, intensidade: 2.2, queda: 1, halfRes: false },
  bloom: { limiar: 1.0, suave: 0.25, intensidade: 0.35, raio: 0.6 },
  dof: { faixa: 120, bokeh: 2, resolucao: 0.5 },
  nevoa: { perto: 400, longe: 4000, quanto: 0.45, dessatura: 0.35 },
  vinheta: { offset: 0.32, escuro: 0.45 },
  tone: "aces",
};
export const PLANO_CLOSE: LookPlano = {
  ...BASE,
  rimIntensidade: 6,
  sombraMapa: 2048,
  sombraRaio: 2,
  ao: { raio: 4, intensidade: 2.0, queda: 1, halfRes: false },
  dof: { faixa: 25, bokeh: 3, resolucao: 0.5 },
  nevoa: { perto: 45, longe: 700, quanto: 0.3, dessatura: 0.35 },
  vinheta: { offset: 0.3, escuro: 0.5 },
};
export const PLANO_MEDIO: LookPlano = { ...BASE };
export const PLANO_ABERTO: LookPlano = {
  ...BASE,
  rimIntensidade: 4,
  rimAbertura: 0.6,
  sombraRaio: 3,
  ao: { raio: 40, intensidade: 2.0, queda: 1, halfRes: false },
  dof: { faixa: 400, bokeh: 1.5, resolucao: 0.5 },
  nevoa: { perto: 600, longe: 5000, quanto: 0.55, dessatura: 0.4 },
  vinheta: { offset: 0.35, escuro: 0.4 },
};
export const PLANOS = { close: PLANO_CLOSE, medio: PLANO_MEDIO, aberto: PLANO_ABERTO } as const;
export type TipoPlano = keyof typeof PLANOS;
// variante fim de tarde (praça de Palermo, sol baixo, céu parcialmente nublado)
export const CENA_MARQUISE_TARDE: LookCena = { ...CENA_MARQUISE_DIA, hdri: "palermo_square_1k.hdr", hdriIntensidade: 0.8 };
// variante sem nada baixado (céu procedural): fallback
export const CENA_MARQUISE_PROC: LookCena = { ...CENA_MARQUISE_DIA, hdri: undefined };
export const CENAS = { marquise_dia: CENA_MARQUISE_DIA, marquise_tarde: CENA_MARQUISE_TARDE, marquise_proc: CENA_MARQUISE_PROC } as const;
export type NomeCena = keyof typeof CENAS;
