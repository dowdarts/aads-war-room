import { describe, expect, it } from 'vitest';
import { newProject, parseProject, pruneAssets, serializeProject, type Asset, type Project } from '../src/model/project';
import { coverScale, defaultPatternView, VIEW_BOUNDS } from '../src/render/pattern';

const asset = (id: string, w = 800, h = 600): Asset => ({ id, name: `${id}.png`, mime: 'image/png', sha256: id, width: w, height: h, data: 'AA==' });

function withPattern(): Project {
  return {
    ...newProject(),
    assets: { front: asset('front'), back: asset('back') },
    pattern: { views: { front: defaultPatternView('front', 'front', 800, 600), back: { ...defaultPatternView('back', 'back', 800, 600), mode: 'tile', rotation: 45, opacity: 0.5 } } },
  };
}

describe('base pattern', () => {
  it('cover scale fills the whole view in both directions', () => {
    for (const view of ['rs', 'front', 'back', 'ls'] as const) {
      const s = coverScale(view, 800, 600);
      expect(800 * s).toBeGreaterThanOrEqual(VIEW_BOUNDS[view].w - 1e-9);
      expect(600 * s).toBeGreaterThanOrEqual(VIEW_BOUNDS[view].h - 1e-9);
    }
  });
  it('per-view designs survive save → open', async () => {
    const p = withPattern();
    const back = await parseProject(serializeProject(p));
    expect(back.pattern).toEqual(p.pattern);
    expect(Object.keys(back.assets).sort()).toEqual(['back', 'front']);
  });
  it('pattern images are kept when no layer uses them, dropped when removed', () => {
    const p = withPattern();
    expect(Object.keys(pruneAssets(p).assets)).toHaveLength(2);
    expect(Object.keys(pruneAssets({ ...p, pattern: undefined }).assets)).toHaveLength(0);
  });
  it('rejects damaged pattern settings', async () => {
    const p = withPattern();
    const bad = (mut: (v: any) => void) => { const j = JSON.parse(serializeProject(p)); mut(j); return parseProject(JSON.stringify(j)); };
    await expect(bad(j => { j.pattern.views.front.scale = 0; })).rejects.toThrow(/bad scale/);
    await expect(bad(j => { j.pattern.views.front.mode = 'warp'; })).rejects.toThrow(/bad mode/);
    await expect(bad(j => { j.pattern.views.collar = j.pattern.views.front; })).rejects.toThrow(/unknown pattern view/);
    await expect(bad(j => { delete j.assets.back; })).rejects.toThrow(/missing image/);
  });
});
