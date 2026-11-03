import {createElement, Fragment} from 'react';
import {Composition, registerRoot} from 'remotion';
import {CapaPanda, PandaVideo, pandaDuration} from './videos/Panda';
const Root = () => createElement(Fragment, null,
  createElement(Composition, {id: 'Panda', component: PandaVideo, durationInFrames: pandaDuration(30), fps: 30, width: 1080, height: 1920}),
  createElement(Composition, {id: 'CapaPanda', component: CapaPanda, durationInFrames: 1, fps: 30, width: 1080, height: 1920}),
);
registerRoot(Root);
