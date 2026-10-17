// Output framing: the master is placed aspect-locked and centred on the
// output canvas. Any leftover area is padding — never stretch or crop.

import { MASTER_W, MASTER_H } from '../model/zones';

export interface Frame {
  outW: number;
  outH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fitFrame(outW: number, outH: number, srcW = MASTER_W, srcH = MASTER_H): Frame {
  const scale = Math.min(outW / srcW, outH / srcH);
  return { outW, outH, scale, offsetX: (outW - srcW * scale) / 2, offsetY: (outH - srcH * scale) / 2 };
}

export function toOutput(f: Frame, p: { x: number; y: number }) {
  return { x: f.offsetX + p.x * f.scale, y: f.offsetY + p.y * f.scale };
}

export function fromOutput(f: Frame, p: { x: number; y: number }) {
  return { x: (p.x - f.offsetX) / f.scale, y: (p.y - f.offsetY) / f.scale };
}

export type ExportPreset = '1080p' | '4k' | 'native' | 'artwork-1080p' | 'artwork-native';

export const EXPORT_PRESETS: Record<ExportPreset, { label: string; w: number; h: number; artworkOnly: boolean }> = {
  '1080p': { label: '16:9 · 1920 × 1080', w: 1920, h: 1080, artworkOnly: false },
  '4k': { label: '16:9 · 3840 × 2160', w: 3840, h: 2160, artworkOnly: false },
  native: { label: `Native master · ${MASTER_W} × ${MASTER_H}`, w: MASTER_W, h: MASTER_H, artworkOnly: false },
  'artwork-1080p': { label: 'Artwork only (transparent) · 1920 × 1080', w: 1920, h: 1080, artworkOnly: true },
  'artwork-native': { label: `Artwork only (transparent) · ${MASTER_W} × ${MASTER_H}`, w: MASTER_W, h: MASTER_H, artworkOnly: true },
};
