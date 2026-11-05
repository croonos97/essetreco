import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Amostra } from "../animais/LagartixaComum";
import { bocaLocal, Esqueleto } from "./Ave";
import { clamp01, mix, rnd, sm, texCanvas } from "./PomboComum";

// =====================================================================
// PAPO (crop) em raio-x/corte — referencial do CORPO da ave (filho de <Ave noCorpo>).
// Dois lobos na base do pescoço (frente). O lobo do lado da câmera (+x) é mostrado CORTADO ao meio:
// casca opaca de verdade (parede externa, parede interna e a face do corte com a espessura), sem transparência.
// parede 0..1: a parede engrossa (camada creme que vira "leite"); leite 0..1: nível da pasta no lúmen;
// soltar 0..1: flocos se desprendem da parede e caem no leite; fluxo 0..1: a pasta sobe pelo esôfago até a boca.
// =====================================================================
const C_PAREDE = "#C8AE94", C_CORTE = "#E0C9AA", C_LEITE = "#F1DC9E", C_ESOF = "#B4AA9E"; // vídeo: tons bege/cinza (sem leitura de pele/rosa)

// meia-casca por revolução (eixo y), metade x ≤ 0, face de corte no plano x = 0 olhando para +x
const meiaCasca = (rx: number, ry: number, th: number) => {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push(new THREE.Vector2(Math.max(1e-3, rx * Math.cos(a)), ry * Math.sin(a)));
  }
  const ri = Math.max(0.05, rx - th), ryi = Math.max(0.05, ry - th);
  const inn: THREE.Vector2[] = [];
  for (let i = n; i >= 0; i--) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    inn.push(new THREE.Vector2(Math.max(1e-3, ri * Math.cos(a)), ryi * Math.sin(a)));
  }
  const ext = new THREE.LatheGeometry(pts, 24, Math.PI, Math.PI);
  const int = new THREE.LatheGeometry(inn, 24, Math.PI, Math.PI);
  // face do corte: anel entre as curvas (meia-lua dos dois lados do eixo)
  const shape = new THREE.Shape([...pts.map((p) => new THREE.Vector2(p.x, p.y)), ...inn.map((p) => new THREE.Vector2(p.x, p.y))]);
  const capA = new THREE.ShapeGeometry(shape, 1);
  capA.rotateY(-Math.PI / 2); // x da forma → z
  const capB = capA.clone();
  capB.scale(1, 1, -1);
  capB.index && capB.setIndex(Array.from(capB.index.array).reverse());
  capA.computeVertexNormals();
  capB.computeVertexNormals();
  return { ext, int, capA, capB, ri, ryi };
};
// leite: volume de revolução que enche o lúmen até o nível (metade x ≤ 0) + tampa plana no corte
const meioLeite = (ri: number, ryi: number, nivel: number) => {
  const yTop = -ryi + 2 * ryi * clamp01(nivel);
  const pts: THREE.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const y = mix(-ryi * 0.999, yTop, i / n);
    const r = ri * Math.sqrt(Math.max(0, 1 - (y * y) / (ryi * ryi))) * 0.96;
    pts.push(new THREE.Vector2(Math.max(1e-3, r), y));
  }
  pts.push(new THREE.Vector2(1e-3, yTop));
  const vol = new THREE.LatheGeometry(pts, 24, Math.PI, Math.PI);
  const shape = new THREE.Shape([new THREE.Vector2(0, -ryi), ...pts.map((p) => new THREE.Vector2(p.x, p.y))]);
  const tA = new THREE.ShapeGeometry(shape, 1);
  tA.rotateY(-Math.PI / 2);
  const tB = tA.clone();
  tB.scale(1, 1, -1);
  tB.index && tB.setIndex(Array.from(tB.index.array).reverse());
  // tampa de cima (superfície do leite) — disco meio
  const topo = new THREE.CircleGeometry(Math.max(0.01, pts[n].x), 24, Math.PI / 2, Math.PI);
  topo.rotateX(-Math.PI / 2);
  topo.translate(0, yTop, 0);
  return { vol, tA, tB, topo };
};

const texParede = () =>
  texCanvas("papo_parede", 256, 256, (g, w, h) => {
    g.fillStyle = C_PAREDE;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#9E3C4A";
    g.globalAlpha = 0.55;
    for (let i = 0; i < 26; i++) {
      let x = rnd(i, 1) * w, y = rnd(i, 2) * h;
      g.lineWidth = 1 + rnd(i, 3) * 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd(i * 7 + k, 4) - 0.5) * 50;
        y += (rnd(i * 7 + k, 5) - 0.3) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
// interior: dobras do epitélio; a cor vai do rosa ao creme com a espessura (uniforme no material)
const texInterno = () =>
  texCanvas("papo_interno", 256, 256, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#B9A08C";
    g.globalAlpha = 0.35;
    g.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      const y = (i / 18) * h;
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.06 + i) * 6);
      g.stroke();
    }
    g.globalAlpha = 1;
  });

export type PapoProps = { S: Esqueleto; A: Amostra[]; parede: number; leite: number; soltar: number; fluxo?: number; entrada?: number; t: number; lobos?: number; corte?: boolean; bocaL?: [number, number, number]; lado?: 1 | -1; descida?: boolean }; // descida=false: sem o tubo papo→estômago (vídeo: o tubo saía do contorno do fantasma)
export const Papo: React.FC<PapoProps> = ({ S, A, parede, leite, soltar, fluxo = 0, entrada = 0, t, bocaL, lado = 1, descida = true }) => {
  const nT = S.nTorso;
  // centro do papo: base do pescoço, lado ventral
  const tau = nT - 1 + 0.45;
  const K = A[A.length - 1].s;
  const k = Math.round((tau / K) * (A.length - 1));
  const am = A[k];
  const dVent = am.u.clone().multiplyScalar(-1);
  const centro = am.p.clone().addScaledVector(dVent, am.hb * 0.3);
  const rx = Math.min(am.hb, am.w) * 0.36 * (1 + 0.15 * leite);
  const ry = rx * 1.3;
  const sep = am.w * 0.3;
  const th = mix(0.06, 0.42, clamp01(parede)) * rx;
  // orientação: y = eixo do pescoço, x = lateral do corpo
  const Y = am.d.clone().normalize();
  const X = new THREE.Vector3(1, 0, 0).sub(Y.clone().multiplyScalar(Y.x)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  const key = [rx, ry, th, leite].map((v) => v.toFixed(3)).join(",");
  const G = useMemo(() => ({ ...meiaCasca(rx, ry, th), L: meioLeite(Math.max(0.05, rx - th), Math.max(0.05, ry - th), leite) }), [key]); // eslint-disable-line
  useEffect(() => () => [G.ext, G.int, G.capA, G.capB, G.L.vol, G.L.tA, G.L.tB, G.L.topo].forEach((g) => g.dispose()), [G]);
  const M = useMemo(
    () => ({
      parede: new THREE.MeshStandardMaterial({ map: texParede(), roughness: 0.5, side: THREE.DoubleSide }),
      interno: new THREE.MeshStandardMaterial({ map: texInterno(), color: "#E2C7A4", roughness: 0.6, side: THREE.DoubleSide }),
      corte: new THREE.MeshStandardMaterial({ color: C_CORTE, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      leite: new THREE.MeshStandardMaterial({ color: C_LEITE, roughness: 0.5, side: THREE.DoubleSide }),
      esof: new THREE.MeshStandardMaterial({ color: C_ESOF, roughness: 0.55 }),
      fluxo: new THREE.MeshStandardMaterial({ color: C_LEITE, roughness: 0.45, emissive: new THREE.Color("#5A4410"), emissiveIntensity: 0.25 }),
      floco: new THREE.MeshStandardMaterial({ color: "#F0D98E", roughness: 0.55 }),
    }),
    [],
  );
  // a parede interna fica creme quando engrossa (é ela que descama e vira o "leite")
  M.interno.color.set(new THREE.Color("#E2C7A4").lerp(new THREE.Color("#F2DDA6"), sm(parede)));
  M.corte.color.set(new THREE.Color(C_CORTE).lerp(new THREE.Color("#F0CF9A"), sm(parede) * 0.6));
  // esôfago: boca → pescoço → papo → dentro do corpo
  const bl = bocaL ?? bocaLocal({ bico: { z0: 1.72, y0: 0.56, len: 2.0 } } as never, 0);
  // começa na comissura (base do bico, por dentro) — a pasta nunca aparece no bico nem fora do corpo
  const boca = new THREE.Vector3(0, bl[1] - 0.05 * bl[2], bl[2] * 0.62).applyMatrix4(S.cab);
  // boca → garganta (embaixo do crânio) → frente do pescoço → papo
  const garganta = new THREE.Vector3(0, bl[1] - 0.28 * bl[2], -0.2 * bl[2]).applyMatrix4(S.cab);
  // o esôfago começa DENTRO do crânio (garganta): nenhum tubo aparece no bico nem entre os bicos
  void boca;
  const caminho: THREE.Vector3[] = [garganta];
  const Kc = S.ctrl.length - 1;
  for (let i = A.length - 2; i >= 0; i--) {
    const a = A[i];
    if (a.s > Kc - 1.6) continue; // pula o trecho dentro da cabeça
    if (a.s < tau + 0.4) break;
    caminho.push(a.p.clone().addScaledVector(a.u, -a.hb * 0.45));
  }
  caminho.push(centro.clone().addScaledVector(Y, ry * 0.75));
  const curva = useMemo(() => new THREE.CatmullRomCurve3(caminho), [caminho.map((p) => p.toArray().map((v) => v.toFixed(2)).join()).join()]); // eslint-disable-line
  const fundo = A[Math.round(((nT - 3) / K) * (A.length - 1))];
  const curvaDesce = new THREE.CatmullRomCurve3([centro.clone().addScaledVector(Y, -ry * 0.6).addScaledVector(dVent, -rx * 0.4), fundo.p.clone().addScaledVector(fundo.u, -fundo.hb * 0.1)]);
  const esofG = useMemo(() => new THREE.TubeGeometry(curva, 40, rx * 0.16, 10), [curva, rx]);
  const desceG = useMemo(() => new THREE.TubeGeometry(curvaDesce, 12, rx * 0.22, 10), [curvaDesce.points.map((p) => p.x + p.y + p.z).join(), rx]); // eslint-disable-line
  useEffect(() => () => (esofG.dispose(), desceG.dispose()), [esofG, desceG]);
  // pasta subindo: do papo (u=1) até a boca (u=0)
  // fluxo: sobe do papo (u=1) até a boca; entrada: desce da boca (u=0) até o papo (filhote recebendo)
  const fl = clamp01(Math.max(fluxo, entrada));
  const desce = entrada > fluxo;
  const fluxoG = useMemo(() => {
    if (fl <= 0.001) return null;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) pts.push(curva.getPoint(desce ? mix(0, fl, i / 20) : mix(1, 1 - fl, i / 20)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, rx * 0.2, 10);
  }, [curva, fl.toFixed(3), rx, desce]); // eslint-disable-line
  useEffect(() => () => fluxoG?.dispose(), [fluxoG]);
  // flocos que se soltam da parede (metade visível, x ≤ 0 no lobo)
  const nF = 14;
  const flocos = [];
  for (let i = 0; i < nF; i++) {
    const a0 = Math.PI * (0.55 + 0.9 * rnd(i, 11)); // ângulo na metade visível
    const yy = (rnd(i, 12) * 1.6 - 0.8) * (ry - th);
    const ri = (rx - th) * Math.sqrt(Math.max(0.05, 1 - (yy * yy) / ((ry - th) * (ry - th))));
    const p0 = new THREE.Vector3(Math.sin(a0) * ri * 0.92, yy, Math.cos(a0) * ri * 0.92);
    const fim = new THREE.Vector3(p0.x * 0.4, -(ry - th) + (ry - th) * 2 * leite * 0.95, p0.z * 0.4);
    const s = clamp01((soltar - rnd(i, 13) * 0.5) / 0.5);
    const p = p0.clone().lerp(fim, sm(s));
    p.y += Math.sin(t * 1.2 + i) * 0.03 * s * (1 - s);
    flocos.push({ p, r: rx * (0.07 + 0.05 * rnd(i, 14)), vis: parede > 0.3 ? 1 : 0 });
  }
  return (
    <group>
      {/* lobo cortado (lado +x) */}
      <group position={centro.clone().addScaledVector(X, sep * lado)} quaternion={q} scale={[lado, 1, 1]}>
        <mesh geometry={G.ext} material={M.parede} />
        <mesh geometry={G.int} material={M.interno} />
        <mesh geometry={G.capA} material={M.corte} />
        <mesh geometry={G.capB} material={M.corte} />
        {leite > 0.01 ? (
          <group position={[-0.004, 0, 0]}>
            <mesh geometry={G.L.vol} material={M.leite} />
            <mesh geometry={G.L.tA} material={M.leite} />
            <mesh geometry={G.L.tB} material={M.leite} />
            <mesh geometry={G.L.topo} material={M.leite} />
          </group>
        ) : null}
        {flocos.map((f, i) => (f.vis ? <mesh key={i} position={f.p} scale={[f.r, f.r * 0.45, f.r * 0.8]} material={M.floco}><sphereGeometry args={[1, 10, 8]} /></mesh> : null))}
      </group>
      {/* lobo do outro lado: inteiro */}
      <mesh position={centro.clone().addScaledVector(X, -sep * lado)} quaternion={q} scale={[rx, ry, rx]} material={M.parede}>
        <sphereGeometry args={[1, 24, 18]} />
      </mesh>
      {/* esôfago */}
      <mesh geometry={esofG} material={M.esof} />
      {descida ? <mesh geometry={desceG} material={M.esof} /> : null}
      {fluxoG ? <mesh geometry={fluxoG} material={M.fluxo} /> : null}
    </group>
  );
};
