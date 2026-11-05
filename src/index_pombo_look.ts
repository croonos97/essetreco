// Entry isolado do TESTE DE LOOK do pombo (antes × depois). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { PomboLook, POMBO_LOOK_DUR } from "./three/look/PomboLook";

const D = Math.round(POMBO_LOOK_DUR * 30);
const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "PomboLook", component: PomboLook, durationInFrames: D, fps: 30, width: 1080, height: 1920, defaultProps: { modo: "depois" as const, rotulo: true } }),
    createElement(Composition, { id: "PomboLookEcon", component: PomboLook, durationInFrames: D, fps: 30, width: 1080, height: 1920, defaultProps: { modo: "depois" as const, rotulo: true, economico: true } }),
    createElement(Composition, { id: "PomboLookProc", component: PomboLook, durationInFrames: D, fps: 30, width: 1080, height: 1920, defaultProps: { modo: "depois" as const, rotulo: true, proc: true } }),
    createElement(Composition, { id: "PomboLookAntes", component: PomboLook, durationInFrames: D, fps: 30, width: 1080, height: 1920, defaultProps: { modo: "antes" as const, rotulo: true } }),
  );
registerRoot(Root);
