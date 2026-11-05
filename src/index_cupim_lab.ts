// Entry isolado do kit do cupim ("Seu pau tá cheio de bicho"). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { CupimLab, LAB_DUR } from "./three/cupim/CupimLab";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "CupimLab", component: CupimLab, durationInFrames: Math.round(LAB_DUR * 30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
