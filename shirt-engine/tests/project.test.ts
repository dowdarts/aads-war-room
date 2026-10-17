import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { makeAsset, newProject, parseProject, pruneAssets, serializeProject, withAsset, type Project } from '../src/model/project';
import { sha256Fallback, base64ToBytes } from '../src/model/ids';

const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 250, 0, 255]);

async function sample(): Promise<Project> {
  let p = newProject('Test kit');
  const r = withAsset(p, await makeAsset('sponsor.png', 'image/png', bytes, 400, 100));
  p = r.project;
  return { ...p, layers: [
    { id: 'l1', kind: 'image', assetId: r.assetId, zoneId: 'RS01', code: 'RS01', content: 'sponsor', x: 120.5, y: 400.25, w: 150, h: 37.5, rotation: -90, opacity: 0.8, visible: true, locked: false },
    { id: 'l2', kind: 'text', text: 'SMITH', fontFamily: 'Impact', fontStyle: 'bold', fontSize: 41.2, fill: '#ff0000', align: 'center', letterSpacing: 2, zoneId: 'BACK_NAME', code: 'N02', content: 'surname', x: 960, y: 290, w: 263, rotation: 0, opacity: 1, visible: true, locked: true },
  ] };
}

describe('project file', () => {
  it('save → open round-trips positions, text and original asset bytes', async () => {
    const p = await sample();
    const back = await parseProject(serializeProject(p));
    expect(back.layers).toEqual(p.layers);
    expect(back.name).toBe('Test kit');
    const a = Object.values(back.assets)[0];
    expect([...base64ToBytes(a.data)]).toEqual([...bytes]);
    expect(a.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
  it('identical uploads are stored once', async () => {
    let p = newProject();
    const r1 = withAsset(p, await makeAsset('a.png', 'image/png', bytes, 1, 1));
    p = r1.project;
    const r2 = withAsset(p, await makeAsset('copy.png', 'image/png', bytes, 1, 1));
    expect(r2.assetId).toBe(r1.assetId);
    expect(Object.keys(r2.project.assets)).toHaveLength(1);
  });
  it('drops assets no layer uses', async () => {
    const p = await sample();
    expect(Object.keys(pruneAssets({ ...p, layers: [] }).assets)).toHaveLength(0);
  });
  it('rejects garbage and newer schemas with a clear message', async () => {
    await expect(parseProject('not json')).rejects.toThrow(/not valid JSON/);
    await expect(parseProject('{"hello":1}')).rejects.toThrow(/not a shirt project/);
    await expect(parseProject(JSON.stringify({ ...newProject(), schema: 99 }))).rejects.toThrow(/newer version/);
    const broken = JSON.parse(serializeProject(await sample()));
    broken.assets = {};
    await expect(parseProject(JSON.stringify(broken))).rejects.toThrow(/missing image/);
  });
  it('imports the MVP prototype JSON, splitting combined zone ids', async () => {
    const png = 'data:image/png;base64,' + Buffer.from(bytes).toString('base64');
    const old = { name: 'Old', baseSrc: 'http://localhost:5173/master-stencil.png', items: [
      { id: 'a', zone: 'N01 / TN01', kind: 'image', src: png, x: 600, y: 320, w: 100, h: 50, rotation: 0 },
      { id: 'b', zone: 'N02 / TN02', kind: 'text', text: 'JONES', x: 960, y: 300, w: 263, h: 40, rotation: 0 },
      { id: 'c', zone: 'LS02', kind: 'image', src: png, x: 1390, y: 550, w: 120, h: 30, rotation: 0 },
    ] };
    const p = await parseProject(JSON.stringify(old));
    expect(p.layers.map(l => [l.code, l.zoneId])).toEqual([['N01', 'FRONT_CHEST_L'], ['N02', 'BACK_NAME'], ['LS02', 'LS02']]);
    expect(Object.keys(p.assets)).toHaveLength(1); // same image deduped
    expect(p.layers[0]).toMatchObject({ x: 600, y: 320, w: 100, h: 50 });
    expect(JSON.stringify(p)).not.toContain('baseSrc');
  });
  it('empty projects stay empty (no auto-filled artwork)', async () => {
    const p = await parseProject(serializeProject(newProject()));
    expect(p.layers).toEqual([]);
    expect(p.assets).toEqual({});
  });
  it('fallback SHA-256 matches Node crypto', () => {
    for (const len of [0, 1, 55, 56, 63, 64, 65, 1000]) {
      const b = new Uint8Array(len).map((_, i) => (i * 31 + 7) & 255);
      expect(Buffer.from(sha256Fallback(b)).toString('hex')).toBe(createHash('sha256').update(b).digest('hex'));
    }
  });
});
