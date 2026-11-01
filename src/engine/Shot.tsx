import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraRig, Key } from "./Camera";
import { Stage } from "./Stage";

type V3 = [number, number, number];
type ShotProps = { from: number; to: number; children: (t: number) => React.ReactNode; sky?: [string, string]; sun?: V3; shadowSize?: number; exposure?: number; ambient?: number; sunPower?: number };

// Um "shot" monta seu próprio palco 3D; t = segundos absolutos do vídeo.
export const Shot: React.FC<ShotProps> = ({ from, to, ...rest }) => {
  const { fps } = useVideoConfig();
  const f0 = Math.round(from * fps);
  const f1 = Math.round(to * fps);
  return (
    <Sequence from={f0} durationInFrames={Math.max(1, f1 - f0)} layout="none">
      <Inner from={from} {...rest} />
    </Sequence>
  );
};

const Inner: React.FC<Omit<ShotProps, "to">> = ({ from, children, sky, sun, shadowSize, exposure, ambient, sunPower }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = from + frame / fps;
  return (
    <AbsoluteFill>
      <Stage sky={sky} sun={sun} shadowSize={shadowSize} exposure={exposure} ambient={ambient} sunPower={sunPower}>
        {children(t)}
      </Stage>
    </AbsoluteFill>
  );
};

export const Cam: React.FC<{ from: number; keys: Key[]; shake?: number }> = ({ from, keys, shake }) => <CameraRig keys={keys} offset={from} shake={shake} />;
