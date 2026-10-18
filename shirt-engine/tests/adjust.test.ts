import { describe, expect, it } from 'vitest';
import { layerHeight, transformAboutCenter, type ImageLayer, type PatternView, type TextLayer } from '../src/model/project';
import { rotatePatternAt, VIEW_BOUNDS, viewAtX, zoomPatternAt } from '../src/render/pattern';

const img: ImageLayer = { id: 'i', kind: 'image', assetId: 'a', zoneId: 'F02', code: 'F02', content: 'other', x: 500, y: 400, w: 120, h: 60, rotation: 30, opacity: 1, visible: true, locked: false };
const txt: TextLayer = { id: 't', kind: 'text', text: 'SMITH', fontFamily: 'Arial', fontStyle: 'bold', fontSize: 40, fill: '#000', align: 'center', letterSpacing: 0, zoneId: 'BACK_NAME', code: 'N02', content: 'surname', x: 1000, y: 230, w: 200, rotation: 0, opacity: 1, visible: true, locked: false };

function centre(l: ImageLayer | TextLayer) {
  const h = layerHeight(l), r = (l.rotation * Math.PI) / 180;
  return { x: l.x + (l.w / 2) * Math.cos(r) - (h / 2) * Math.sin(r), y: l.y + (l.w / 2) * Math.sin(r) + (h / 2) * Math.cos(r) };
}

describe('scale/rotate about centre (scroll and + / − / [ / ] on logos)', () => {
  for (const l of [img, txt]) {
    it(`${l.kind}: centre stays put, aspect kept`, () => {
      const c0 = centre(l);
      for (const [s, r] of [[1.2, 0], [0.8, 0], [1, 15], [1.1, -40]]) {
        const n = transformAboutCenter(l, s, r);
        const c1 = centre(n);
        expect(c1.x).toBeCloseTo(c0.x, 6);
        expect(c1.y).toBeCloseTo(c0.y, 6);
        expect(n.w).toBeCloseTo(l.w * s, 9);
        expect(layerHeight(n) / n.w).toBeCloseTo(layerHeight(l) / l.w, 9);
        expect(n.rotation).toBeCloseTo(l.rotation + r, 9);
      }
    });
  }
});

describe('base pattern zoom/rotate at pointer', () => {
  const v: PatternView = { assetId: 'a', mode: 'single', scale: 0.8, offsetX: 20, offsetY: -10, rotation: 0, opacity: 1 };
  const b = VIEW_BOUNDS.front;
  // Stencil position of a pattern-space point (relative to the pattern centre).
  const at = (pv: PatternView, u: number, w: number) => {
    const r = (pv.rotation * Math.PI) / 180;
    return { x: b.x + b.w / 2 + pv.offsetX + pv.scale * (u * Math.cos(r) - w * Math.sin(r)), y: b.y + b.h / 2 + pv.offsetY + pv.scale * (u * Math.sin(r) + w * Math.cos(r)) };
  };
  it('zoom keeps the point under the mouse fixed', () => {
    const mouse = { x: 600, y: 420 };
    const n = { ...v, ...zoomPatternAt('front', v, 1.3, mouse) };
    // pattern point that was under the mouse before
    const c = { x: b.x + b.w / 2 + v.offsetX, y: b.y + b.h / 2 + v.offsetY };
    const u = (mouse.x - c.x) / v.scale, w = (mouse.y - c.y) / v.scale;
    const p = at(n, u, w);
    expect(p.x).toBeCloseTo(mouse.x, 6);
    expect(p.y).toBeCloseTo(mouse.y, 6);
    expect(n.scale).toBeCloseTo(0.8 * 1.3, 9);
  });
  it('rotate keeps the point under the mouse fixed', () => {
    const mouse = { x: 450, y: 300 };
    const n = { ...v, ...rotatePatternAt('front', v, 25, mouse) };
    const c = { x: b.x + b.w / 2 + v.offsetX, y: b.y + b.h / 2 + v.offsetY };
    const p = at(n, (mouse.x - c.x) / v.scale, (mouse.y - c.y) / v.scale);
    expect(p.x).toBeCloseTo(mouse.x, 6);
    expect(p.y).toBeCloseTo(mouse.y, 6);
    expect(n.rotation).toBe(25);
  });
  it('finds the view under the pointer', () => {
    expect(viewAtX(100)).toBe('rs');
    expect(viewAtX(520)).toBe('front');
    expect(viewAtX(1100)).toBe('back');
    expect(viewAtX(1550)).toBe('ls');
  });
});
