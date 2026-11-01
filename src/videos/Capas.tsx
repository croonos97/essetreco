import "@fontsource/baloo-2/800.css";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Cam, Shot } from "../engine/Shot";
import { JetEngine } from "../three/Jato";
import { Tiao } from "../three/Tiao";
import { Workshop } from "../three/Workshop";
import { BunkerScene } from "./Bunker";
import { DamScene } from "./Barragem";
import { LandfillScene } from "./Aterro";
import { C, FONT } from "../theme";

const outline = (px: number, color = C.ink) => ({
  WebkitTextStroke: `${px}px ${color}`,
  paintOrder: "stroke fill" as const,
});

const Title: React.FC<{ top: string; big: string; y: number }> = ({ top, big, y }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", top: y, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800, lineHeight: 0.95 }}>
      <div style={{ fontSize: 96, color: "#FFFFFF", ...outline(18), textShadow: "0 10px 0 rgba(0,0,0,0.25)" }}>{top}</div>
      <div style={{ fontSize: 150, color: "#FFD23F", ...outline(22), textShadow: "0 12px 0 rgba(0,0,0,0.3)", marginTop: 10 }}>{big}</div>
    </div>
  </AbsoluteFill>
);

// Capa do vídeo do motor a jato (1080x1920; texto dentro da área 3:4 do feed).
export const CapaJato: React.FC = () => {
  const t = 2.3;
  const s = {
    stands: 1,
    core: 1,
    comp: [1, 1, 1, 1, 1, 1],
    chamber: 1,
    fuel: 1,
    flame: 1,
    hotGas: 1,
    nozzle: 1,
    jet: 1,
    turbine: [1, 1, 1],
    shaft: 1,
    fan: 1,
    nacelle: 1,
    bypass: 1,
    compAngle: 0.6,
    turbAngle: 0.3,
    fanAngle: 0.4,
    cut: true,
  };
  return (
    <AbsoluteFill style={{ background: "#E9D7B8" }}>
      <Shot from={0} to={1} sky={["#F3E6CF", "#E9D7B8"]} sun={[4, 10, 8]} shadowSize={9}>
        {() => (
          <>
            <Cam from={0} keys={[{ t: 0, pos: [-4.2, 2.5, 7.4], look: [0.6, 1.2, 0.4], fov: 50 }]} />
            <Workshop />
            <JetEngine t={t} position={[0, 1.75, 0]} s={s} />
            <Tiao position={[-0.2, 0, 1.9]} rotation={-0.55} mood="shock" pose="up" t={t} scale={0.62} look={[-0.6, 0.6]} />
          </>
        )}
      </Shot>
      <Title top="COMO ISSO EMPURRA" big="300 TONELADAS?" y={300} />
    </AbsoluteFill>
  );
};

// Capa do bunker: corte completo do abrigo.
export const CapaBunker: React.FC = () => (
  <AbsoluteFill style={{ background: "#CFEAF6" }}>
    <Shot from={0} to={1} sky={["#6EBDE8", "#CFEAF6"]} sun={[7, 14, 9]} shadowSize={16}>
      {() => (
        <>
          <Cam from={0} keys={[{ t: 0, pos: [0.3, -0.6, 10.4], look: [0.3, -2.6, -1.2], fov: 50 }]} />
          <BunkerScene t={62.5} />
        </>
      )}
    </Shot>
    <Title top="DÁ PRA FAZER UM" big="BUNKER NO QUINTAL?" y={250} />
  </AbsoluteFill>
);

export const CapaBarragem: React.FC = () => (
  <AbsoluteFill style={{ background: "#CFEAF6" }}>
    <Shot from={0} to={1} sky={["#6EBDE8", "#CFEAF6"]} sun={[-6, 14, 10]} shadowSize={22}>
      {() => (
        <>
          <Cam from={0} keys={[{ t: 0, pos: [-4.0, 6.5, 15.5], look: [-1.2, 0.2, -3.5], fov: 50 }]} />
          <DamScene t={69.5} />
        </>
      )}
    </Shot>
    <Title top="COMO SEGURAR" big="UM RIO INTEIRO?" y={250} />
  </AbsoluteFill>
);

export const CapaAterro: React.FC = () => (
  <AbsoluteFill style={{ background: "#CFEAF6" }}>
    <Shot from={0} to={1} sky={["#6EBDE8", "#CFEAF6"]} sun={[6, 14, 9]} shadowSize={22}>
      {() => (
        <>
          <Cam from={0} keys={[{ t: 0, pos: [0.8, 0.4, 13.0], look: [0.8, -1.4, -2.0], fov: 50 }]} />
          <LandfillScene t={73.5} />
        </>
      )}
    </Shot>
    <Title top="PRA ONDE VAI" big="O SEU LIXO?" y={250} />
  </AbsoluteFill>
);

// Capa a partir de um quadro do vídeo: a imagem vem de public/capas/<img>.png (renderizada sem legendas).
export const CapaQuadro: React.FC<{ img: string; top: string; big: string }> = ({ img, top, big }) => (
  <AbsoluteFill>
    <Img src={staticFile(`capas/${img}.png`)} style={{ width: "100%", height: "100%" }} />
    <Title top={top} big={big} y={250} />
  </AbsoluteFill>
);
