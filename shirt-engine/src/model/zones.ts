// Physical placement zones on the locked four-view master (stencil pixels).
// Left/right always refer to the WEARER. A zone is a physical region; the
// codes (N01, TN01, …) are semantic names for content placed there, so N01 and
// TN01 resolve to the same zone and therefore the same coordinates.
//
// Rectangles were set by the owner in calibrate mode (2026-10-17). They are
// placement positions on the mockup, not manufacturer dimensions.

export const MASTER_W = 1672;
export const MASTER_H = 941;

export type ViewId = 'rs' | 'front' | 'back' | 'ls';

export const VIEW_LABELS: Record<ViewId, string> = {
  rs: "Wearer's right sleeve",
  front: 'Front',
  back: 'Back',
  ls: "Wearer's left sleeve",
};

export interface Rect { x: number; y: number; w: number; h: number }

export interface Zone extends Rect {
  id: string;
  view: ViewId;
  label: string;
  /** Hint for auto-fit: stacked logos fill height, horizontal ones fill width. */
  orientation: 'stacked' | 'horizontal' | 'any';
}

export const ZONES: Zone[] = [
  { id: 'RS01', view: 'rs', label: 'Right sleeve · upper / stacked', orientation: 'stacked', x: 62.7, y: 385, w: 117.8, h: 137.2 },
  { id: 'RS02', view: 'rs', label: 'Right sleeve · lower near cuff / horizontal', orientation: 'horizontal', x: 47.6, y: 490.3, w: 138.1, h: 31 },
  { id: 'FRONT_CHEST_L', view: 'front', label: "Front · wearer's left chest", orientation: 'any', x: 544.3, y: 314.4, w: 114.5, h: 64.3 },
  { id: 'F02', view: 'front', label: 'Front · centre artwork', orientation: 'any', x: 400.5, y: 400.1, w: 252, h: 238 },
  { id: 'F03', view: 'front', label: "Front · lower hem (wearer's right)", orientation: 'horizontal', x: 373.6, y: 702.6, w: 117, h: 38 },
  { id: 'F04', view: 'front', label: "Front · lower hem (wearer's left)", orientation: 'horizontal', x: 569.2, y: 702.6, w: 117, h: 38 },
  { id: 'BACK_NAME', view: 'back', label: 'Back · upper, below collar', orientation: 'horizontal', x: 992.4, y: 214.6, w: 263, h: 60 },
  { id: 'B02', view: 'back', label: 'Back · main logo', orientation: 'any', x: 993.3, y: 290.9, w: 260, h: 220 },
  { id: 'B03', view: 'back', label: 'Back · lower artwork', orientation: 'horizontal', x: 994.3, y: 522.8, w: 256, h: 73 },
  { id: 'B04', view: 'back', label: 'Back · lower hem, left of image', orientation: 'horizontal', x: 975, y: 710, w: 79.4, h: 30.5 },
  { id: 'B05', view: 'back', label: 'Back · lower hem, centre', orientation: 'horizontal', x: 1089.6, y: 713.3, w: 86.1, h: 30.5 },
  { id: 'B06', view: 'back', label: 'Back · lower hem, right of image', orientation: 'horizontal', x: 1204.6, y: 706.6, w: 71, h: 29.4 },
  { id: 'LS01', view: 'ls', label: 'Left sleeve · upper / stacked', orientation: 'stacked', x: 1501.2, y: 394.4, w: 108.7, h: 127.9 },
  { id: 'LS02', view: 'ls', label: 'Left sleeve · lower near cuff / horizontal', orientation: 'horizontal', x: 1481.4, y: 491.6, w: 148.1, h: 33.3 },
];

/** What a layer is used for. Any content may go in any zone. */
export type ContentKind = 'player-name' | 'surname' | 'team-name' | 'team-logo' | 'sponsor' | 'other';

export const CONTENT_LABELS: Record<ContentKind, string> = {
  'player-name': 'Player name / nickname',
  surname: 'Player surname',
  'team-name': 'Team name',
  'team-logo': 'Team logo',
  sponsor: 'Sponsor',
  other: 'Other artwork',
};

/** Placement codes shown to the user. Several codes may share one zone. */
export interface Placement { code: string; zoneId: string; content: ContentKind; label: string }

export const PLACEMENTS: Placement[] = [
  { code: 'RS01', zoneId: 'RS01', content: 'sponsor', label: 'Right sleeve · upper / stacked' },
  { code: 'RS02', zoneId: 'RS02', content: 'sponsor', label: 'Right sleeve · cuff / horizontal' },
  { code: 'N01', zoneId: 'FRONT_CHEST_L', content: 'player-name', label: "Front left chest · player name" },
  { code: 'TN01', zoneId: 'FRONT_CHEST_L', content: 'team-name', label: "Front left chest · team name" },
  { code: 'F02', zoneId: 'F02', content: 'other', label: 'Front · centre artwork' },
  { code: 'F03', zoneId: 'F03', content: 'sponsor', label: "Front · hem (wearer's right)" },
  { code: 'F04', zoneId: 'F04', content: 'sponsor', label: "Front · hem (wearer's left)" },
  { code: 'N02', zoneId: 'BACK_NAME', content: 'surname', label: 'Back upper · player surname' },
  { code: 'TN02', zoneId: 'BACK_NAME', content: 'team-name', label: 'Back upper · team name' },
  { code: 'B02', zoneId: 'B02', content: 'team-logo', label: 'Back · main logo' },
  { code: 'B03', zoneId: 'B03', content: 'other', label: 'Back · lower artwork' },
  { code: 'B04', zoneId: 'B04', content: 'sponsor', label: 'Back · hem, left of image' },
  { code: 'B05', zoneId: 'B05', content: 'sponsor', label: 'Back · hem, centre' },
  { code: 'B06', zoneId: 'B06', content: 'sponsor', label: 'Back · hem, right of image' },
  { code: 'LS01', zoneId: 'LS01', content: 'sponsor', label: 'Left sleeve · upper / stacked' },
  { code: 'LS02', zoneId: 'LS02', content: 'sponsor', label: 'Left sleeve · cuff / horizontal' },
];

export function placementByCode(code: string): Placement | undefined {
  return PLACEMENTS.find(p => p.code === code);
}

/** Zone geometry, honouring calibration overrides when given. */
export function zoneById(id: string, overrides?: Record<string, Rect>): Zone | undefined {
  const z = ZONES.find(q => q.id === id);
  if (!z) return undefined;
  const o = overrides?.[id];
  return o ? { ...z, ...o } : z;
}

/** Largest box with the given aspect ratio that fits the zone, centred. */
export function fitInZone(zone: Rect, aspect: number): Rect {
  let w = zone.w;
  let h = w / aspect;
  if (h > zone.h) { h = zone.h; w = h * aspect; }
  return { x: zone.x + (zone.w - w) / 2, y: zone.y + (zone.h - h) / 2, w, h };
}
