import { Composition } from "remotion";
import { MACACO_NOVAS_LAB_DUR, MacacoNovasLab } from "./MacacoNovasLab";
import { MacacoNovas, macacoNovasDuration } from "../videos/MacacoNovas";

// Root isolado das cenas novas do macaco (cobra / alarme / graveto no nariz).
// MacacoNovas tem a MESMA duração/tempos do vídeo Macaco (OFF 0,5 s): renderize por --frames.
export const RootMacacoNovas = () => (
  <>
    <Composition id="MacacoNovas" component={MacacoNovas} durationInFrames={macacoNovasDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="MacacoNovasLab" component={MacacoNovasLab} durationInFrames={MACACO_NOVAS_LAB_DUR * 30} fps={30} width={1080} height={1920} />
  </>
);
