import { describe, expect, it } from 'vitest';
import { fitFrame, fromOutput, toOutput, EXPORT_PRESETS } from '../src/render/frame';
import { MASTER_W, MASTER_H } from '../src/model/zones';

describe('16:9 framing', () => {
  it('1920×1080 keeps the master aspect ratio exactly (no stretch)', () => {
    const f = fitFrame(1920, 1080);
    const w = MASTER_W * f.scale, h = MASTER_H * f.scale;
    expect(w / h).toBeCloseTo(MASTER_W / MASTER_H, 12);
    expect(h).toBeCloseTo(1080, 9); // master is slightly narrower than 16:9 → fills height
    expect(f.offsetY).toBeCloseTo(0, 9);
    expect(f.offsetX).toBeGreaterThan(0);
    expect(f.offsetX).toBeLessThan(1); // ~0.5 px neutral padding per side
    expect(f.offsetX * 2 + w).toBeCloseTo(1920, 9);
  });
  it('native preset is 1:1 with no padding', () => {
    expect(fitFrame(MASTER_W, MASTER_H)).toMatchObject({ scale: 1, offsetX: 0, offsetY: 0 });
  });
  it('coordinates round-trip through the output transform', () => {
    for (const [w, h] of [[1920, 1080], [3840, 2160], [MASTER_W, MASTER_H]]) {
      const f = fitFrame(w, h);
      for (const p of [{ x: 0, y: 0 }, { x: 598, y: 311 }, { x: MASTER_W, y: MASTER_H }]) {
        const back = fromOutput(f, toOutput(f, p));
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
      }
    }
  });
  it('all 16:9 presets are exactly 16:9', () => {
    for (const k of ['1080p', '4k', 'artwork-1080p'] as const) expect(EXPORT_PRESETS[k].w * 9).toBe(EXPORT_PRESETS[k].h * 16);
  });
});
