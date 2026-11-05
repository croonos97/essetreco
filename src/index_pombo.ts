// Entry do vídeo do pombo ("Você bebe leite de macho."). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { PomboVideo, pomboDuration } from "./videos/Pombo";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "Pombo", component: PomboVideo, durationInFrames: pomboDuration(30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
