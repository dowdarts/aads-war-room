import { describe, expect, it } from 'vitest';
import { PLACEMENTS, ZONES, fitInZone, placementByCode, zoneById, MASTER_W, MASTER_H } from '../src/model/zones';

const rectOf = (code: string) => { const z = zoneById(placementByCode(code)!.zoneId)!; return { x: z.x, y: z.y, w: z.w, h: z.h }; };

describe('zones', () => {
  it('N01 and TN01 share the front wearer-left chest position', () => {
    expect(rectOf('N01')).toEqual(rectOf('TN01'));
    expect(placementByCode('N01')!.content).not.toBe(placementByCode('TN01')!.content);
  });
  it('N02 and TN02 share the back upper position', () => {
    expect(rectOf('N02')).toEqual(rectOf('TN02'));
  });
  it('wearer-left chest is on the image-right half of the front view', () => {
    const front = ZONES.find(z => z.id === 'F02')!;
    const chest = zoneById('FRONT_CHEST_L')!;
    expect(chest.x + chest.w / 2).toBeGreaterThan(front.x + front.w / 2);
  });
  it('sleeve cuff zones sit lower than the upper zones', () => {
    // The owner's calibration lets the cuff zone overlap the bottom of the upper zone.
    const cy = (id: string) => zoneById(id)!.y + zoneById(id)!.h / 2;
    for (const [up, low] of [['RS01', 'RS02'], ['LS01', 'LS02']]) {
      expect(cy(low)).toBeGreaterThan(cy(up));
      expect(zoneById(low)!.orientation).toBe('horizontal');
    }
  });
  it('every placement points at a zone inside the master', () => {
    for (const p of PLACEMENTS) {
      const z = zoneById(p.zoneId)!;
      expect(z).toBeTruthy();
      expect(z.x >= 0 && z.y >= 0 && z.x + z.w <= MASTER_W && z.y + z.h <= MASTER_H).toBe(true);
    }
  });
  it('codes are unique', () => {
    expect(new Set(PLACEMENTS.map(p => p.code)).size).toBe(PLACEMENTS.length);
  });
  it('calibration overrides replace geometry only', () => {
    const z = zoneById('LS02', { LS02: { x: 1, y: 2, w: 3, h: 4 } })!;
    expect(z).toMatchObject({ id: 'LS02', view: 'ls', x: 1, y: 2, w: 3, h: 4 });
  });
  it('fitInZone keeps aspect ratio and stays centred inside the zone', () => {
    const zone = zoneById('LS02')!; // 185×49 cuff zone
    const r = fitInZone(zone, 4); // wide 4:1 logo
    expect(r.w / r.h).toBeCloseTo(4);
    expect(r.h).toBeLessThanOrEqual(zone.h + 1e-9);
    expect(r.w).toBeLessThanOrEqual(zone.w + 1e-9);
    expect(r.x + r.w / 2).toBeCloseTo(zone.x + zone.w / 2);
    expect(r.y + r.h / 2).toBeCloseTo(zone.y + zone.h / 2);
  });
});
