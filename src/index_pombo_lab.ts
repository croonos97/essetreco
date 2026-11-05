// Entry isolado do kit do pombo ("Você bebe leite de macho."). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { PomboLab, LAB_DUR } from "./three/pombo/PomboLab";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "PomboLab", component: PomboLab, durationInFrames: Math.round(LAB_DUR * 30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
