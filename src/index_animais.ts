// Entry isolado do kit de animais (desenvolvimento): não interfere no src/index.ts usado nos renders.
import { registerRoot } from "remotion";
import { RootAnimais } from "./animais_dev/RootAnimais";
registerRoot(RootAnimais);
