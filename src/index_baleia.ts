import {createElement,Fragment} from 'react';
import {Composition,registerRoot} from 'remotion';
import {BaleiaVideo,CapaBaleia,baleiaDuration,baleiaPlanos} from './videos/Baleia';
const Root=()=>createElement(Fragment,null,
 createElement(Composition,{defaultProps:{planos:baleiaPlanos},id:'Baleia',component:BaleiaVideo,durationInFrames:baleiaDuration(30),fps:30,width:1080,height:1920}),
 createElement(Composition,{id:'CapaBaleia',component:CapaBaleia,durationInFrames:1,fps:30,width:1080,height:1920}));
registerRoot(Root);
