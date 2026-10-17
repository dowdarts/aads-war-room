// Konva attributes for a layer. Shared by the editor stage and the export
// renderer so what you see is exactly what gets exported.

import type { ImageLayer, TextLayer } from '../model/project';

export function imageAttrs(l: ImageLayer) {
  return { x: l.x, y: l.y, width: l.w, height: l.h, rotation: l.rotation, opacity: l.opacity, visible: l.visible };
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
