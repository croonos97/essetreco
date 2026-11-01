import { Composition } from "remotion";
import { Chuveiro, chuveiroDuration } from "./videos/Chuveiro";
import { Fibra, fibraDuration } from "./videos/Fibra";
import { Panela, panelaDuration } from "./videos/Panela";
import { Jato, jatoDuration } from "./videos/Jato";
import { Hidreletrica, hidreletricaDuration } from "./videos/Hidreletrica";
import { Airbag, airbagDuration } from "./videos/Airbag";
import { Bunker, bunkerDuration } from "./videos/Bunker";
import { Barragem, barragemDuration } from "./videos/Barragem";
import { Aterro, aterroDuration } from "./videos/Aterro";
import { CapaAterro, CapaBarragem, CapaBunker, CapaJato, CapaQuadro } from "./videos/Capas";
import { Piscina, piscinaDuration } from "./videos/Piscina";
import { Telhado, telhadoDuration } from "./videos/Telhado";
import { Predio, predioDuration } from "./videos/Predio";
import { Preview } from "./Preview";
import { WorldTest } from "./videos/WorldTest";
import { Ornitorrinco, ornitorrincoDuration } from "./videos/Ornitorrinco";
import { AnimaisKitTest, animaisKitTestDuration } from "./videos/AnimaisKitTest";
import { Escada, escadaDuration } from "./videos/Escada";
export const Root = () => (
  <>
    <Composition id="Chuveiro" component={Chuveiro} durationInFrames={chuveiroDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Fibra" component={Fibra} durationInFrames={fibraDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Panela" component={Panela} durationInFrames={panelaDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Jato" component={Jato} durationInFrames={jatoDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Hidreletrica" component={Hidreletrica} durationInFrames={hidreletricaDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Airbag" component={Airbag} durationInFrames={airbagDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Bunker" component={Bunker} durationInFrames={bunkerDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Barragem" component={Barragem} durationInFrames={barragemDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Aterro" component={Aterro} durationInFrames={aterroDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="CapaJato" component={CapaJato} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="CapaBunker" component={CapaBunker} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="CapaBarragem" component={CapaBarragem} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="CapaAterro" component={CapaAterro} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="CapaQuadro" component={CapaQuadro} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ img: "panela", top: "", big: "" }} />
    <Composition id="Piscina" component={Piscina} durationInFrames={piscinaDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Telhado" component={Telhado} durationInFrames={telhadoDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Predio" component={Predio} durationInFrames={predioDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="WorldTest" component={WorldTest} durationInFrames={120} fps={30} width={1080} height={1920} />
    <Composition id="Preview" component={Preview} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="Ornitorrinco" component={Ornitorrinco} durationInFrames={ornitorrincoDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Escada" component={Escada} durationInFrames={escadaDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="AnimaisKitTest" component={AnimaisKitTest} durationInFrames={animaisKitTestDuration(30)} fps={30} width={1080} height={1920} />
  </>
);
