// Konva attributes for a layer. Shared by the editor stage and the export
// renderer so what you see is exactly what gets exported.

import type { Asset, ImageLayer, TextLayer } from '../model/project';

export function imageAttrs(l: ImageLayer, a?: Asset, im?: HTMLImageElement | null) {
  const base = { x: l.x, y: l.y, width: l.w, height: l.h, rotation: l.rotation, opacity: l.opacity, visible: l.visible };
  // A zero-size crop means "whole image" to Konva; always passing one lets
  // a crop be removed again without leaving a stale crop on the node.
  if (!l.crop) return { ...base, crop: { x: 0, y: 0, width: 0, height: 0 } };
  // Crop is stored in the asset's recorded pixels; the decoded image can have
  // another intrinsic size (e.g. an SVG whose width differs from its viewBox).
  const n = im?.naturalWidth || im?.width || 0;
  const k = a && n ? n / a.width : 1;
  return { ...base, crop: { x: l.crop.x * k, y: l.crop.y * k, width: l.crop.w * k, height: l.crop.h * k } };
}

export function textAttrs(l: TextLayer) {
  return {
    x: l.x, y: l.y, width: l.w, rotation: l.rotation, opacity: l.opacity, visible: l.visible,
    text: l.text, fontFamily: l.fontFamily, fontStyle: l.fontStyle, fontSize: l.fontSize,
    fill: l.fill, align: l.align, letterSpacing: l.letterSpacing, lineHeight: 1.05, wrap: 'none' as const,
  };
}

export const TEXT_FONTS = ['Arial', 'Arial Black', 'Impact', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'];

/** Font size so `text` fits inside a w×h box on one line. */
export function fitFontSize(text: string, fontFamily: string, fontStyle: string, w: number, h: number): number {
  const ctx = document.createElement('canvas').getContext('2d');
  let size = h * 0.8;
  if (!ctx || !text) return Math.max(8, size);
  ctx.font = `${fontStyle} 100px "${fontFamily}"`;
  const at100 = ctx.measureText(text).width;
  if (at100 > 0) size = Math.min(size, (w * 0.95 * 100) / at100);
  return Math.max(8, Math.round(size * 10) / 10);
}
