import { Composition } from "remotion";
import { AnimaisKitTest, animaisKitTestDuration } from "../videos/AnimaisKitTest";
import { Lab } from "./Lab";
import { MACACO_LAB_DUR, MacacoLab } from "./MacacoLab";
import { Macaco, macacoDuration } from "../videos/Macaco";

export const RootAnimais = () => (
  <>
    <Composition id="AnimaisKitTest" component={AnimaisKitTest} durationInFrames={animaisKitTestDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="Macaco" component={Macaco} durationInFrames={macacoDuration(30)} fps={30} width={1080} height={1920} />
    <Composition id="MacacoLab" component={MacacoLab} durationInFrames={MACACO_LAB_DUR * 30} fps={30} width={1080} height={1920} />
    <Composition id="AnimaisLab" component={Lab} durationInFrames={4 * 30} fps={30} width={1080} height={1920} />
  </>
);
