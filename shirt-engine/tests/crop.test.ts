import { describe, expect, it } from 'vitest';
import { cropOf, newProject, parseProject, recropLayer, serializeProject, type Asset, type ImageLayer } from '../src/model/project';

const asset: Asset = { id: 'a', name: 'logo.png', mime: 'image/png', sha256: 'x', width: 400, height: 200, data: 'AA==' };
const layer: ImageLayer = {
  id: 'l', kind: 'image', assetId: 'a', zoneId: 'F02', code: 'F02', content: 'other',
  x: 500, y: 450, w: 200, h: 100, rotation: 0, opacity: 1, visible: true, locked: false,
};

// Shirt position of an asset pixel, for checking that kept pixels don't move.
function shirtPos(l: ImageLayer, px: number, py: number) {
  const c = cropOf(l, asset);
  const s = l.w / c.w;
  const lx = (px - c.x) * s, ly = (py - c.y) * s;
  const r = (l.rotation * Math.PI) / 180;
  return { x: l.x + lx * Math.cos(r) - ly * Math.sin(r), y: l.y + lx * Math.sin(r) + ly * Math.cos(r) };
}

describe('crop', () => {
  it('keeps scale and keeps the remaining pixels in place', () => {
    const c = recropLayer(layer, asset, { x: 200, y: 50, w: 100, h: 100 });
    expect(c.crop).toEqual({ x: 200, y: 50, w: 100, h: 100 });
    expect(c.w).toBeCloseTo(50); // 0.5 shirt px per image px, unchanged
    expect(c.h).toBeCloseTo(50);
    for (const [px, py] of [[200, 50], [250, 100], [300, 150]]) {
      const before = shirtPos(layer, px, py), after = shirtPos(c, px, py);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });
  it('keeps pixels in place when the layer is rotated', () => {
    const rotated = { ...layer, rotation: 37 };
    const c = recropLayer(rotated, asset, { x: 120, y: 30, w: 160, h: 90 });
    for (const [px, py] of [[120, 30], [200, 75], [280, 120]]) {
      const before = shirtPos(rotated, px, py), after = shirtPos(c, px, py);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });
  it('re-cropping and removing the crop restore the original placement', () => {
    const once = recropLayer(layer, asset, { x: 200, y: 50, w: 100, h: 100 });
    const twice = recropLayer(once, asset, { x: 0, y: 0, w: 400, h: 200 });
    expect(twice.crop).toBeUndefined();
    const reset = recropLayer(once, asset, undefined);
    for (const l of [twice, reset]) {
      expect(l.x).toBeCloseTo(layer.x);
      expect(l.y).toBeCloseTo(layer.y);
      expect(l.w).toBeCloseTo(layer.w);
      expect(l.h).toBeCloseTo(layer.h);
    }
  });
  it('crops survive save → open, and bad crops are rejected', async () => {
    const p = { ...newProject(), assets: { a: asset }, layers: [recropLayer(layer, asset, { x: 10, y: 20, w: 30, h: 40 })] };
    const back = await parseProject(serializeProject(p));
    expect((back.layers[0] as ImageLayer).crop).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    const bad = { ...p, layers: [{ ...layer, crop: { x: 390, y: 0, w: 50, h: 10 } }] };
    await expect(parseProject(serializeProject(bad))).rejects.toThrow(/invalid crop/);
  });
});
