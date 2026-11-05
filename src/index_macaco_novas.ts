// Entry isolado das cenas novas do macaco (v2): não interfere nos outros index*.ts.
import { registerRoot } from "remotion";
import { RootMacacoNovas } from "./animais_dev/RootMacacoNovas";
registerRoot(RootMacacoNovas);
