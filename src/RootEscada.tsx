import { Composition } from "remotion";
import { Escada, escadaDuration } from "./videos/Escada";
export const RootEscada = () => <Composition id="Escada" component={Escada} durationInFrames={escadaDuration(30)} fps={30} width={1080} height={1920} />;
