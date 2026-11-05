// Entry do vídeo do cupim ("Seu pau tá cheio de bicho"). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { Cupim, cupimDuration } from "./videos/Cupim";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "Cupim", component: Cupim, durationInFrames: cupimDuration(30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
