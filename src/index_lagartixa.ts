// Entry do vídeo da lagartixa ("Você dá o rabo para sobreviver"). Não interfere nos outros index*.ts.
import { createElement, Fragment } from "react";
import { Composition, registerRoot } from "remotion";
import { Lagartixa, lagartixaDuration } from "./videos/Lagartixa";

const Root = () =>
  createElement(
    Fragment,
    null,
    createElement(Composition, { id: "Lagartixa", component: Lagartixa, durationInFrames: lagartixaDuration(30), fps: 30, width: 1080, height: 1920 }),
  );
registerRoot(Root);
