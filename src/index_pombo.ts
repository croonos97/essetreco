import {createElement, Fragment} from 'react';
import {Composition, registerRoot} from 'remotion';
import {CapaPombo, PomboVideo, pomboDuration} from './videos/Pombo';

const Root = () => createElement(Fragment, null,
  createElement(Composition, {id: 'Pombo', component: PomboVideo, durationInFrames: pomboDuration(30), fps: 30, width: 1080, height: 1920}),
  createElement(Composition, {id: 'CapaPombo', component: CapaPombo, durationInFrames: 1, fps: 30, width: 1080, height: 1920}),
);
registerRoot(Root);
