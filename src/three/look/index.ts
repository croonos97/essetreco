// Módulo de LOOK reutilizável do canal (luz + IBL + pós + grading + materiais). Ver /home/claude/et/qa/look_dev.md.
export { LookPalco, resolverLook } from "./LookPalco";
export type { LookPalcoProps } from "./LookPalco";
export { LookAmbiente, useAmbienteLook } from "./LookAmbiente";
export { LookLuz } from "./LookLuz";
export { LookPos } from "./LookPos";
export { GradeEffect } from "./GradeEffect";
export { LookAve, LookConcreto, texRugosidade } from "./LookMateriais";
export * from "./presets";
