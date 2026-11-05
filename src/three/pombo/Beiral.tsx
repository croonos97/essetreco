import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clamp01, mix, pontilhar, rnd, texCanvas, V3 } from "./PomboComum";

// =====================================================================
// CENÁRIO ÚNICO: vão do ar-condicionado num prédio brasileiro (4º andar), com ninho de gravetos no canto.
// Unidade: cm. Piso do vão (laje) em y = 0; fachada (reboco pintado) no plano z = 0, olhando para +z.
// Vão: x −70…90, y 0…72, fundo em z = −50. A laje passa 12 cm para fora da fachada (borda com cocô branco).
// Condensadora (unidade externa do split) à direita: x 4…84, frente (grade do ventilador) em z = −17.
// Ninho à esquerda, centro NINHO = (−36, 0, −16), ~24 cm de diâmetro.
// Fundo: cidade desfocada pintada num cilindro distante (sem luz; cor fixa).
// =====================================================================
export const VAO = { x0: -70, x1: 90, alt: 72, fundo: -50, laje: 12, esp: 9 };
export const NINHO: V3 = [-36, 0, -16];
export const NINHO_R = 12;
export const NINHO_FUNDO = 1.6; // altura do fundo da tigela (onde ficam os filhotes)
export const ARC = { x0: 4, x1: 84, y0: 3, y1: 58, z0: -45, z1: -17 };

// ---------- texturas ----------
const reboco = () =>
  texCanvas("beiral_reboco", 512, 512, (g, w, h) => {
    g.fillStyle = "#D9C6A3";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 9000, "#B9A47F", 0.5, 1.6, 0.35, 81);
    pontilhar(g, w, h, 5000, "#EFE2C6", 0.5, 1.4, 0.35, 82);
    pontilhar(g, w, h, 40, "#9E8A68", 10, 40, 0.06, 83); // manchas grandes de sujeira
  });
const escorrido = () =>
  texCanvas("beiral_escorrido", 512, 256, (g, w, h) => {
    // sujeira escorrendo da laje para baixo (topo = linha 0)
    g.fillStyle = "#D9C6A3";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 4000, "#B9A47F", 0.5, 1.6, 0.35, 84);
    for (let i = 0; i < 70; i++) {
      const x = rnd(i, 85) * w, L = h * (0.25 + 0.75 * rnd(i, 86));
      const gr = g.createLinearGradient(0, 0, 0, L);
      gr.addColorStop(0, "rgba(90,78,60,0.35)");
      gr.addColorStop(1, "rgba(90,78,60,0)");
      g.fillStyle = gr;
      g.fillRect(x, 0, 2 + rnd(i, 87) * 6, L);
    }
  });
const concreto = () =>
  texCanvas("beiral_concreto", 512, 512, (g, w, h) => {
    g.fillStyle = "#A7A39B";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 8000, "#8C887F", 0.5, 1.8, 0.4, 88);
    pontilhar(g, w, h, 3000, "#C4C0B7", 0.5, 1.5, 0.4, 89);
    pontilhar(g, w, h, 30, "#6F6B62", 15, 50, 0.07, 90);
  });
// frente da laje: concreto + escorridos brancos de cocô
const frenteLaje = () =>
  texCanvas("beiral_frente", 1024, 64, (g, w, h) => {
    g.fillStyle = "#A39F97";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 3000, "#8A867D", 0.5, 1.5, 0.4, 91);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.04 + 0.5 * rnd(i, 92)); // perto do ninho (lado esquerdo)
      const L = h * (0.3 + 0.7 * rnd(i, 93));
      g.fillStyle = "rgba(238,236,228,0.92)";
      g.beginPath();
      g.ellipse(x, 2, 3 + rnd(i, 94) * 5, L, 0, 0, Math.PI);
      g.fill();
    }
  });
const cidade = () =>
  texCanvas(
    "beiral_cidade",
    2048,
    512,
    (g0, w, h) => {
      // tudo é pintado nítido num canvas temporário e desfocado UMA vez no fim
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const g = tmp.getContext("2d")!;
      // céu
      const ceu = g.createLinearGradient(0, 0, 0, h * 0.55);
      ceu.addColorStop(0, "#8FB4DA");
      ceu.addColorStop(1, "#CFDDEA");
      g.fillStyle = ceu;
      g.fillRect(0, 0, w, h);
      // prédios (brancos, beges, cinza, alguns de tijolo) com janelas
      const cores = ["#E9E6DE", "#D8CCB6", "#B9BCC0", "#C9A58A", "#EFEDE7", "#A9B2B8", "#DCD3C2"];
      for (let i = 0; i < 90; i++) {
        const bw = 30 + rnd(i, 101) * 80, bh = 60 + rnd(i, 102) * 190 * (0.5 + 0.5 * rnd(i, 103));
        const x = rnd(i, 104) * w, y = h * 0.6 - bh;
        g.fillStyle = cores[Math.floor(rnd(i, 105) * cores.length)];
        g.fillRect(x, y, bw, bh + h * 0.4);
        g.fillStyle = "rgba(60,70,85,0.35)";
        for (let yy = y + 8; yy < h * 0.6; yy += 12) for (let xx = x + 5; xx < x + bw - 6; xx += 10) g.fillRect(xx, yy, 5, 6);
      }
      // árvores e rua (embaixo)
      g.fillStyle = "#6F7F62";
      for (let i = 0; i < 120; i++) {
        g.beginPath();
        g.arc(rnd(i, 106) * w, h * (0.6 + 0.15 * rnd(i, 107)), 12 + rnd(i, 108) * 24, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#8D8C88";
      g.fillRect(0, h * 0.74, w, h * 0.26);
      g0.filter = "blur(5px)";
      g0.drawImage(tmp, 0, 0);
      g.filter = "none";
    },
    true,
    true,
  );

// ---------- peças ----------
const Caixa: React.FC<{ a: V3; b: V3; m: THREE.Material; sombra?: boolean; recebe?: boolean }> = ({ a, b, m, sombra = true, recebe = true }) => (
  <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} material={m} castShadow={sombra} receiveShadow={recebe}>
    <boxGeometry args={[Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])]} />
  </mesh>
);
// UV em cm (uma repetição a cada `tam` cm), por face, para caixas de parede
const matTex = (tx: THREE.Texture, rep: [number, number], cor = "#ffffff", rough = 0.95) => {
  const t = tx.clone();
  t.needsUpdate = true;
  t.repeat.set(rep[0], rep[1]);
  return new THREE.MeshStandardMaterial({ map: t, color: cor, roughness: rough });
};

// condensadora
const grade = () =>
  texCanvas("beiral_grade", 256, 256, (g, w, h) => {
    g.fillStyle = "#1E1F22";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#C9CCD0";
    g.lineWidth = 5;
    for (let r = 18; r < 128; r += 16) {
      g.beginPath();
      g.arc(128, 128, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.cos((k * Math.PI) / 4) * 128, 128 + Math.sin((k * Math.PI) / 4) * 128);
      g.stroke();
    }
  });
const aletas = () =>
  texCanvas("beiral_aletas", 128, 128, (g, w, h) => {
    g.fillStyle = "#D9D9D4";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6E7074";
    for (let y = 0; y < h; y += 8) g.fillRect(6, y, w - 12, 3);
  });
export const Condensadora: React.FC<{ sombra?: boolean }> = ({ sombra = true }) => {
  const M = useMemo(
    () => ({
      caixa: new THREE.MeshStandardMaterial({ color: "#E7E6E1", roughness: 0.5, metalness: 0.1 }),
      grade: new THREE.MeshStandardMaterial({ map: grade(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      aleta: new THREE.MeshStandardMaterial({ map: aletas(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      pe: new THREE.MeshStandardMaterial({ color: "#5B5D60", roughness: 0.7 }),
      cano: new THREE.MeshStandardMaterial({ color: "#B9B7B0", roughness: 0.8 }),
    }),
    [],
  );
  const A = ARC;
  const cx = mix(A.x0, A.x1, 0.38), cy = (A.y0 + A.y1) / 2;
  return (
    <group>
      <Caixa a={[A.x0, A.y0, A.z0]} b={[A.x1, A.y1, A.z1]} m={M.caixa} sombra={sombra} />
      {/* grade do ventilador (disco um pouco à frente da face) */}
      <mesh position={[cx, cy, A.z1 + 0.25]} material={M.grade} receiveShadow>
        <circleGeometry args={[21, 48]} />
      </mesh>
      {/* aro da grade */}
      <mesh position={[cx, cy, A.z1 + 0.6]} material={M.caixa} castShadow={sombra}>
        <torusGeometry args={[21.3, 0.8, 8, 48]} />
      </mesh>
      {/* aletas laterais (lado direito) */}
      <mesh position={[A.x1 - 9, cy, A.z1 + 0.25]} material={M.aleta} receiveShadow>
        <planeGeometry args={[12, A.y1 - A.y0 - 10]} />
      </mesh>
      {/* pés */}
      {[A.x0 + 6, A.x1 - 6].map((x) => (
        <Caixa key={x} a={[x - 3, 0, A.z0 + 2]} b={[x + 3, A.y0 + 0.01, A.z1 - 2]} m={M.pe} sombra={sombra} />
      ))}
      {/* canos de cobre isolados entrando na parede do fundo */}
      {[0, 1].map((k) => (
        <mesh key={k} position={[A.x1 - 6 - k * 4, A.y1 - 8, (A.z0 + VAO.fundo) / 2]} rotation={[Math.PI / 2, 0, 0]} material={M.cano} castShadow={sombra}>
          <cylinderGeometry args={[1.3, 1.3, Math.abs(A.z0 - VAO.fundo) + 2, 12]} />
        </mesh>
      ))}
    </group>
  );
};

// ---------- ninho de gravetos ----------
const N_GR = 150;
export const Ninho: React.FC<{ sombra?: boolean; position?: V3 }> = ({ sombra = true, position = NINHO }) => {
  const { mesh, base } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 0.85, 1, 6, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: false });
    const m = new THREE.InstancedMesh(geo, mat, N_GR);
    const cores = ["#8A6A48", "#6E5338", "#A2865F", "#7C746A", "#5E4A36", "#B49C78"];
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < N_GR; i++) {
      const camada = i / N_GR;
      const r = mix(3.5, NINHO_R, Math.sqrt(rnd(i, 111))) * mix(0.75, 1.05, camada);
      const a = rnd(i, 112) * Math.PI * 2;
      const L = 7 + rnd(i, 113) * 11;
      const raio = 0.22 + rnd(i, 114) * 0.18;
      const y = NINHO_FUNDO * 0.6 + Math.pow(r / NINHO_R, 2) * 3.6 + camada * 1.2 + raio;
      // graveto quase tangente ao anel, inclinado seguindo a tigela
      const tang = a + Math.PI / 2 + (rnd(i, 115) - 0.5) * 1.2;
      e.set((rnd(i, 116) - 0.5) * 0.35, -tang, Math.PI / 2 + (rnd(i, 117) - 0.5) * 0.25, "YXZ");
      q.setFromEuler(e);
      M4.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(raio, L, raio));
      m.setMatrixAt(i, M4);
      m.setColorAt(i, new THREE.Color(cores[Math.floor(rnd(i, 118) * cores.length)]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = sombra;
    m.receiveShadow = true;
    // fundo da tigela (palha e sujeira) para não ver a laje entre os gravetos
    // base escondida por baixo dos gravetos (sem aro aparente)
    const pts = [new THREE.Vector2(0.01, NINHO_FUNDO), new THREE.Vector2(NINHO_R * 0.5, NINHO_FUNDO + 0.5), new THREE.Vector2(NINHO_R * 0.72, 2.8)]; // só a tigela (sem borda/aro por fora)
    const bg = new THREE.LatheGeometry(pts, 40);
    const bt = texCanvas("ninho_fundo", 256, 256, (g, w, h) => {
      g.fillStyle = "#8A6E50";
      g.fillRect(0, 0, w, h);
      pontilhar(g, w, h, 2500, "#5E4A36", 0.5, 2, 0.5, 119);
      pontilhar(g, w, h, 900, "#A88C66", 0.5, 2, 0.5, 120);
      pontilhar(g, w, h, 60, "#ECEBE4", 1.5, 4, 0.8, 121); // cocô
    });
    const base = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, side: THREE.DoubleSide }));
    base.receiveShadow = true;
    return { mesh: m, base };
  }, [sombra]);
  useEffect(() => () => (mesh.dispose(), base.geometry.dispose()), [mesh, base]);
  return (
    <group position={position}>
      <primitive object={base} />
      <primitive object={mesh} />
    </group>
  );
};

// cocô no topo da laje (perto da borda e do ninho)
const Coco: React.FC = () => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#EEEDE6", roughness: 0.8 }), 60);
    const M4 = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) {
      const borda = i < 38;
      const x = borda ? mix(VAO.x0 + 4, 20, rnd(i, 131)) : NINHO[0] + (rnd(i, 132) - 0.5) * 34;
      const z = borda ? VAO.laje - 0.4 - rnd(i, 133) * 3 : NINHO[2] + 13 + rnd(i, 134) * 10;
      const r = 0.4 + rnd(i, 135) * 1.0;
      M4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(i, 136) * 6, 0)), new THREE.Vector3(r * (1 + rnd(i, 137)), r * 0.28, r));
      m.setMatrixAt(i, M4);
      if (i % 3 === 0) m.setColorAt(i, new THREE.Color("#6F6A58"));
      else m.setColorAt(i, new THREE.Color("#EEEDE6"));
    }
    m.receiveShadow = true;
    return m;
  }, []);
  return <primitive object={mesh} />;
};

export const Cidade: React.FC = () => {
  const mat = useMemo(() => {
    const t = cidade();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false });
  }, []);
  return (
    <mesh position={[0, -600, 0]} material={mat} renderOrder={-10}>
      <cylinderGeometry args={[3000, 3000, 3600, 64, 1, true]} />
    </mesh>
  );
};

export const Beiral: React.FC<{ ninho?: boolean; condensadora?: boolean; sombra?: boolean }> = ({ ninho = true, condensadora = true, sombra = true }) => {
  const M = useMemo(() => {
    const rb = reboco();
    return {
      fachada: matTex(rb, [5, 9]),
      fachadaBaixo: (() => {
        const t = escorrido().clone();
        t.needsUpdate = true;
        t.repeat.set(4, 1);
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
      })(),
      vao: matTex(rb, [2, 1], "#E3D4B6"),
      laje: matTex(concreto(), [2, 1]),
      frente: new THREE.MeshStandardMaterial({ map: frenteLaje(), roughness: 0.9 }),
    };
  }, []);
  const V = VAO;
  return (
    <group>
      <Cidade />
      {/* fachada em volta do vão (4 painéis, sem sobrepor) */}
      <Caixa a={[-260, V.alt, -6]} b={[260, 400, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[-260, -400, -6]} b={[260, -V.esp - 60, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[-260, -V.esp - 60, -6]} b={[260, -V.esp, 0]} m={M.fachadaBaixo} sombra={sombra} />
      <Caixa a={[-260, -V.esp, -6]} b={[V.x0, V.alt, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[V.x1, -V.esp, -6]} b={[260, V.alt, 0]} m={M.fachada} sombra={sombra} />
      {/* paredes internas do vão */}
      <Caixa a={[V.x0 - 6, 0, V.fundo - 6]} b={[V.x1 + 6, V.alt, V.fundo]} m={M.vao} sombra={sombra} />
      <Caixa a={[V.x0 - 6, 0, V.fundo]} b={[V.x0, V.alt, -6]} m={M.vao} sombra={sombra} />
      <Caixa a={[V.x1, 0, V.fundo]} b={[V.x1 + 6, V.alt, -6]} m={M.vao} sombra={sombra} />
      <Caixa a={[V.x0 - 6, V.alt, V.fundo - 6]} b={[V.x1 + 6, V.alt + 8, -6]} m={M.vao} sombra={sombra} />
      {/* laje do piso, saindo para fora da fachada */}
      <Caixa a={[V.x0, -V.esp, V.fundo]} b={[V.x1, 0, V.laje]} m={M.laje} sombra={sombra} />
      {/* frente da laje com escorrido de cocô (plano 0,2 cm à frente) */}
      <mesh position={[(V.x0 + V.x1) / 2, -V.esp / 2, V.laje + 0.2]} material={M.frente} receiveShadow>
        <planeGeometry args={[V.x1 - V.x0, V.esp]} />
      </mesh>
      <Coco />
      {condensadora ? <Condensadora sombra={sombra} /> : null}
      {ninho ? <Ninho sombra={sombra} /> : null}
    </group>
  );
};
void clamp01;
