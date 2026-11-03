import {createElement} from "react";
import {Composition,registerRoot} from "remotion";
import {PomboLab} from "./animais_dev/PomboLab";
registerRoot(()=>createElement(Composition,{id:"PomboLab",component:PomboLab,durationInFrames:1200,fps:30,width:1080,height:1920}));
