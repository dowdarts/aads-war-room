import { describe, expect, it } from 'vitest';
import { inflate } from '../src/three/inflate';

describe('3D inflation', () => {
  it('a long strip of width w inflates to ≈ w²/8 (so depth ∝ width: sleeves slim, torso deep)', () => {
    const cols = 200, rows = 30, cell = 1; // strip 29 cells tall, long in x
    const inside = new Uint8Array((cols + 1) * (rows + 1));
    for (let j = 1; j < rows; j++) for (let i = 1; i < cols; i++) inside[j * (cols + 1) + i] = 1;
    const h = inflate(inside, cols, rows, cell, 1500);
    const mid = h[(rows / 2) * (cols + 1) + cols / 2];
    expect(mid).toBeGreaterThan(0.9 * (rows * rows) / 8);
    expect(mid).toBeLessThan(1.05 * (rows * rows) / 8);
  });
  it('is zero outside the outline and never negative', () => {
    const cols = 40, rows = 40;
    const inside = new Uint8Array((cols + 1) * (rows + 1));
    for (let j = 10; j < 30; j++) for (let i = 10; i < 30; i++) inside[j * (cols + 1) + i] = 1;
    const h = inflate(inside, cols, rows, 2);
    for (let k = 0; k < h.length; k++) {
      if (!inside[k]) expect(h[k]).toBe(0);
      expect(h[k]).toBeGreaterThanOrEqual(0);
    }
  });
});
