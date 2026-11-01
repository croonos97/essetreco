// Entry isolado do kit da lagartixa ("Você dá o rabo para sobreviver"). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { LagartixaLab, LAB_DUR } from "./three/animais/LagartixaLab";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "LagartixaLab", component: LagartixaLab, durationInFrames: Math.round(LAB_DUR * 30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
