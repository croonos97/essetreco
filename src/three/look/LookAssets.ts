import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender, staticFile } from "remotion";

// =====================================================================
// RECURSOS REAIS DO LOOK (CC0, em public/look/ — ver public/look/LICENCAS.md).
// Carregados UMA vez por página (promessa em cache) e segurados com delayRender: nenhum quadro é capturado sem eles.
// Depois de aplicados, o hook força um novo desenho do canvas (advance) antes de liberar o quadro.
// =====================================================================
const cache = new Map<string, Promise<unknown>>();
const uma = <T,>(chave: string, f: () => Promise<T>) => {
  if (!cache.has(chave)) cache.set(chave, f());
  return cache.get(chave) as Promise<T>;
};

// carrega e devolve null até ficar pronto; segura o render do Remotion enquanto isso
export const useRecurso = <T,>(chave: string | null, f: () => Promise<T>): T | null => {
  const { advance } = useThree();
  const [val, setVal] = useState<{ k: string; v: T } | null>(null);
  const hold = useRef<number | null>(null);
  if (chave && hold.current === null && val?.k !== chave) hold.current = delayRender(`look: ${chave}`, { timeoutInMilliseconds: 120000 });
  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    uma(chave, f).then(
      (v) => vivo && setVal({ k: chave, v }),
      (e) => {
        console.error("look: falhou", chave, e);
        if (hold.current !== null) continueRender(hold.current);
        hold.current = null;
      },
    );
    return () => {
      vivo = false;
    };
  }, [chave]); // eslint-disable-line
  // pronto: quem usa aplica no useLayoutEffect; aqui redesenha e libera
  useEffect(() => {
    if (!val || hold.current === null) return;
    advance(performance.now());
    continueRender(hold.current);
    hold.current = null;
  }, [val, advance]);
  useLayoutEffect(() => () => {
    if (hold.current !== null) continueRender(hold.current);
  }, []);
  return val && val.k === chave ? val.v : null;
};

// ---------- HDRI ----------
export type HdriInfo = { tex: THREE.DataTexture; solDir: THREE.Vector3; picoOriginal: number };
// lê o .hdr, acha a direção do sol (pixel mais brilhante) e limita o pico (o sol "de verdade" é a key direcional)
export const carregarHdri = (arquivo: string, limite: number) =>
  uma(`hdri:${arquivo}:${limite}`, async (): Promise<HdriInfo> => {
    const tex = (await new RGBELoader().setDataType(THREE.FloatType).loadAsync(staticFile(`look/hdri/${arquivo}`))) as THREE.DataTexture;
    const { width: W, height: H, data } = tex.image as { width: number; height: number; data: Float32Array };
    let best = 0, bi = 0;
    for (let i = 0; i < W * H; i++) {
      const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
      if (l > best) (best = l), (bi = i);
    }
    const x = bi % W, y = Math.floor(bi / W);
    const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H; // flipY: linha 0 = topo
    const az = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
    const solDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    if (limite > 0)
      for (let i = 0; i < W * H; i++) {
        const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
        if (l > limite) {
          const k = limite / l;
          data[i * 4] *= k;
          data[i * 4 + 1] *= k;
          data[i * 4 + 2] *= k;
        }
      }
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    return { tex, solDir, picoOriginal: best };
  });

// ---------- texturas PBR (1k JPG) ----------
export type TexPBR = { dif: THREE.Texture; nor: THREE.Texture; rou: THREE.Texture; difMedia: number; rouMedia: number };
const ld = new THREE.TextureLoader();
const prep = (t: THREE.Texture, srgb: boolean) => {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};
// média (luminância sRGB → linear aproximada) da imagem inteira, para a variação de cor ficar centrada em 1
const media = (img: CanvasImageSource, canal: "lum" | "g") => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lin = (x: number) => Math.pow(x / 255, 2.2);
    s += canal === "g" ? d[i + 1] / 255 : 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
  }
  return s / (d.length / 4);
};
export const carregarPBR = (nome: string) =>
  uma(`pbr:${nome}`, async (): Promise<TexPBR> => {
    const b = `look/tex/${nome}/${nome}_`;
    const [dif, nor, rou] = await Promise.all([ld.loadAsync(staticFile(b + "diff_1k.jpg")), ld.loadAsync(staticFile(b + "nor_gl_1k.jpg")), ld.loadAsync(staticFile(b + "rough_1k.jpg"))]);
    return { dif: prep(dif, true), nor: prep(nor, false), rou: prep(rou, false), difMedia: media(dif.image as HTMLImageElement, "lum"), rouMedia: media(rou.image as HTMLImageElement, "g") };
  });
