// Decoded images for assets, cached by asset id. Images come from blob: URLs
// built from the embedded bytes, so canvases stay same-origin (exportable).

import { useEffect, useState } from 'react';
import type { Asset } from '../model/project';
import { base64ToBytes } from '../model/ids';

const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Could not load image ${src.slice(0, 60)}`));
    im.src = src;
  });
}

export function assetImage(a: Asset): Promise<HTMLImageElement> {
  let p = cache.get(a.id);
  if (!p) {
    const url = URL.createObjectURL(new Blob([base64ToBytes(a.data) as BlobPart], { type: a.mime }));
    p = loadImage(url).then(im => {
      // SVGs without width/height attributes decode at 0×0 in some browsers.
      if (!im.naturalWidth) { im.width = a.width; im.height = a.height; }
      return im;
    });
    cache.set(a.id, p);
  }
  return p;
}

export const MASTER_URL = `${import.meta.env.BASE_URL}master-stencil.png`;

let masterPromise: Promise<HTMLImageElement> | null = null;
export function masterImage(): Promise<HTMLImageElement> {
  return (masterPromise ??= loadImage(MASTER_URL));
}

function usePromise<T>(make: () => Promise<T> | null, deps: unknown[]): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    const p = make();
    if (!p) { setV(null); return; }
    p.then(r => { if (live) setV(r); }, () => { if (live) setV(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export function useAssetImage(a: Asset | undefined) {
  return usePromise(() => (a ? assetImage(a) : null), [a?.id]);
}

export function useMasterImage() {
  return usePromise(masterImage, []);
}

/** Reads a user-chosen image file: original bytes + intrinsic size. */
export async function readImageFile(file: File): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || guessMime(file.name);
  if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(mime)) throw new Error(`${file.name}: unsupported file type (${mime || 'unknown'}). Use PNG, SVG, JPG or WebP.`);
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    let width = im.naturalWidth, height = im.naturalHeight;
    if ((!width || !height) && mime === 'image/svg+xml') ({ width, height } = svgSize(new TextDecoder().decode(bytes)));
    if (!width || !height) throw new Error(`${file.name}: image has no size.`);
    return { bytes, mime, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function guessMime(name: string) {
  const ext = name.toLowerCase().split('.').pop();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' } as Record<string, string>)[ext ?? ''] ?? '';
}

function svgSize(svg: string) {
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  return vb ? { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) } : { width: 0, height: 0 };
}
