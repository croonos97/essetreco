import * as THREE from "three";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";

// =====================================================================
// GRADING DE CENA (linear, ANTES do tone mapping) + PERSPECTIVA AÉREA por profundidade.
// Ordem: névoa/dessatura por distância → exposição → balanço de branco → contraste log (pivô 0,18)
//        → saturação → split-tone (sombras frias / realces quentes).
// Puro por pixel: sem tempo, sem ruído, sem jitter → determinístico.
// =====================================================================
const frag = /* glsl */ `
uniform float uExpo, uContr, uSat, uSplit, uNPerto, uNLonge, uNQuanto, uNDessat;
uniform vec3 uWB, uSombra, uAlta, uNevoa;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  #ifdef PERSPECTIVE_CAMERA
    float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  #else
    float viewZ = orthographicDepthToViewZ(depth, cameraNear, cameraFar);
  #endif
  float dist = -viewZ;
  // céu/fundo infinito (depth = 1) também recebe a névoa máxima
  float k = depth >= 0.99999 ? 1.0 : smoothstep(uNPerto, uNLonge, dist);
  float L0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(L0), k * uNDessat);
  c = mix(c, uNevoa, k * uNQuanto);
  c *= uExpo * uWB;
  vec3 lc = log2(max(c, vec3(1e-5)) / 0.18);
  c = 0.18 * exp2(lc * uContr);
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(L), c, uSat), 0.0);
  float t = smoothstep(-3.0, 1.5, log2(max(L, 1e-5) / 0.18));
  c *= mix(vec3(1.0), mix(uSombra, uAlta, t), uSplit);
  outputColor = vec4(c, inputColor.a);
}`;

export type GradeOpts = {
  exposicao: number;
  contraste: number;
  saturacao: number;
  temperatura: number;
  tinta: number;
  splitForca: number;
  sombra: string;
  alta: string;
  nevoa: string;
  nevoaPerto: number;
  nevoaLonge: number;
  nevoaQuanto: number;
  nevoaDessatura: number;
};
// balanço de branco simples: +temperatura = mais vermelho/menos azul; +tinta = menos verde
export const wb = (temp: number, tinta: number) => new THREE.Vector3(1 + 0.12 * temp + 0.03 * tinta, 1 - 0.06 * tinta, 1 - 0.14 * temp + 0.03 * tinta);
// cor normalizada para luminância 1 (tinta de split-tone não muda o brilho)
const normCor = (h: string) => {
  const c = new THREE.Color(h);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return new THREE.Vector3(c.r / l, c.g / l, c.b / l);
};

export class GradeEffect extends Effect {
  constructor(o: GradeOpts) {
    super("GradeEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uExpo", new THREE.Uniform(o.exposicao)],
        ["uContr", new THREE.Uniform(o.contraste)],
        ["uSat", new THREE.Uniform(o.saturacao)],
        ["uSplit", new THREE.Uniform(o.splitForca)],
        ["uWB", new THREE.Uniform(wb(o.temperatura, o.tinta))],
        ["uSombra", new THREE.Uniform(normCor(o.sombra))],
        ["uAlta", new THREE.Uniform(normCor(o.alta))],
        ["uNevoa", new THREE.Uniform(new THREE.Color(o.nevoa))],
        ["uNPerto", new THREE.Uniform(o.nevoaPerto)],
        ["uNLonge", new THREE.Uniform(o.nevoaLonge)],
        ["uNQuanto", new THREE.Uniform(o.nevoaQuanto)],
        ["uNDessat", new THREE.Uniform(o.nevoaDessatura)],
      ]),
    });
  }
}
