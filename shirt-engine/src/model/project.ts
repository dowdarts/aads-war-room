// Portable project format (.mdshirt). Plain JSON, assets embedded as base64
// with their original bytes untouched, so a file opens identically on web,
// desktop and (later) from the cloud. The master stencil is implicit — never
// stored in the project.

import { newId, sha256Hex, base64ToBytes, bytesToBase64 } from './ids';
import { PLACEMENTS, ZONES, type ContentKind, type ViewId } from './zones';

export const SCHEMA_VERSION = 1;
export const FILE_FORMAT = 'mdshirt';

export interface Asset {
  id: string;
  name: string;
  mime: string;
  sha256: string;
  width: number;
  height: number;
  /** Original file bytes, base64. */
  data: string;
}

interface LayerBase {
  id: string;
  /** Physical zone the layer was placed in (metadata; x/y are absolute). */
  zoneId: string;
  /** Placement code chosen, e.g. N01 or TN01. */
  code: string;
  content: ContentKind;
  /** Top-left in master stencil pixels. */
  x: number;
  y: number;
  w: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

/** Crop window in the asset's own pixels. Non-destructive: the original
 *  bytes are always kept, so a crop can be changed or removed later. */
export interface Crop { x: number; y: number; w: number; h: number }

export interface ImageLayer extends LayerBase { kind: 'image'; assetId: string; h: number; crop?: Crop }

/** Visible part of an image layer's asset (the crop, or the whole image). */
export function cropOf(l: ImageLayer, a: Asset): Crop {
  return l.crop ?? { x: 0, y: 0, w: a.width, h: a.height };
}

/**
 * Applies a new crop while keeping the artwork where it was on the shirt:
 * same scale (shirt px per image px), same rotation, and the pixels that
 * remain visible stay in place.
 */
export function recropLayer(l: ImageLayer, a: Asset, next: Crop | undefined): ImageLayer {
  const old = cropOf(l, a);
  const nc = next ?? { x: 0, y: 0, w: a.width, h: a.height };
  const s = l.w / old.w;
  const dx = (nc.x - old.x) * s, dy = (nc.y - old.y) * s;
  const r = (l.rotation * Math.PI) / 180;
  const isFull = nc.x === 0 && nc.y === 0 && nc.w === a.width && nc.h === a.height;
  const { crop: _c, ...rest } = l;
  return {
    ...rest,
    ...(isFull ? {} : { crop: nc }),
    x: l.x + dx * Math.cos(r) - dy * Math.sin(r),
    y: l.y + dx * Math.sin(r) + dy * Math.cos(r),
    w: nc.w * s,
    h: nc.h * s,
  };
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  fontSize: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export type Layer = ImageLayer | TextLayer;

export type PatternMode = 'tile' | 'single';

/** Base pattern/design for one garment view. Each view may use its own image. */
export interface PatternView {
  assetId: string;
  mode: PatternMode;
  /** Stencil pixels per pattern pixel. */
  scale: number;
  /** Pattern centre relative to the view centre, stencil pixels. */
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
}

export interface PatternSettings {
  views: Partial<Record<ViewId, PatternView>>;
}

export function patternAssetIds(p: Project): string[] {
  return Object.values(p.pattern?.views ?? {}).map(v => v!.assetId);
}

export interface Project {
  schema: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Increments on every saved change; used for cloud conflict detection. */
  revision: number;
  assets: Record<string, Asset>;
  /** Array order is z-order, bottom first. */
  layers: Layer[];
  pattern?: PatternSettings;
}

export function newProject(name = 'Untitled shirt'): Project {
  const now = new Date().toISOString();
  return { schema: SCHEMA_VERSION, id: newId(), name, createdAt: now, updatedAt: now, revision: 0, assets: {}, layers: [] };
}

export async function makeAsset(name: string, mime: string, bytes: Uint8Array, width: number, height: number): Promise<Asset> {
  const sha256 = await sha256Hex(bytes);
  return { id: sha256.slice(0, 32), name, mime, sha256, width, height, data: bytesToBase64(bytes) };
}

/** Adds an asset, reusing an identical one already in the project. */
export function withAsset(p: Project, a: Asset): { project: Project; assetId: string } {
  const existing = Object.values(p.assets).find(x => x.sha256 === a.sha256);
  if (existing) return { project: p, assetId: existing.id };
  return { project: { ...p, assets: { ...p.assets, [a.id]: a } }, assetId: a.id };
}

/** Drops assets no longer referenced by a layer or the pattern. */
export function pruneAssets(p: Project): Project {
  const used = new Set<string>();
  for (const l of p.layers) if (l.kind === 'image') used.add(l.assetId);
  for (const id of patternAssetIds(p)) used.add(id);
  const keys = Object.keys(p.assets);
  if (keys.every(k => used.has(k))) return p;
  return { ...p, assets: Object.fromEntries(keys.filter(k => used.has(k)).map(k => [k, p.assets[k]])) };
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ format: FILE_FORMAT, ...pruneAssets(p) });
}

export class ProjectError extends Error {}

/** Parses a .mdshirt / .json file, migrating older formats. */
export async function parseProject(text: string): Promise<Project> {
  let raw: any;
  try { raw = JSON.parse(text); } catch { throw new ProjectError('This file is not valid JSON.'); }
  if (!raw || typeof raw !== 'object') throw new ProjectError('This file is not a shirt project.');
  if (Array.isArray(raw.items) && raw.schema === undefined) return migratePrototype(raw);
  if (typeof raw.schema !== 'number') throw new ProjectError('This file is not a shirt project.');
  if (raw.schema > SCHEMA_VERSION) throw new ProjectError(`This project was made by a newer version (schema ${raw.schema}). Please update the app.`);
  const { format: _f, ...rest } = raw;
  return validateProject(rest);
}

function validateProject(p: any): Project {
  const fail = (m: string) => { throw new ProjectError(`Project file is damaged: ${m}`); };
  if (typeof p.id !== 'string' || typeof p.name !== 'string') fail('missing id/name');
  if (!p.assets || typeof p.assets !== 'object') fail('missing assets');
  if (!Array.isArray(p.layers)) fail('missing layers');
  for (const l of p.layers) {
    if (l.kind !== 'image' && l.kind !== 'text') fail(`unknown layer type ${l.kind}`);
    for (const k of ['x', 'y', 'w', 'rotation']) if (!Number.isFinite(l[k])) fail(`layer ${l.id} has bad ${k}`);
    if (l.kind === 'image' && !p.assets[l.assetId]) fail(`layer ${l.id} references a missing image`);
    if (l.kind === 'image' && l.crop !== undefined) {
      const c = l.crop, a = p.assets[l.assetId];
      const ok = c && [c.x, c.y, c.w, c.h].every(Number.isFinite) && c.w > 0 && c.h > 0 && c.x >= 0 && c.y >= 0
        && c.x + c.w <= a.width + 0.5 && c.y + c.h <= a.height + 0.5;
      if (!ok) fail(`layer ${l.id} has an invalid crop`);
    }
  }
  if (p.pattern !== undefined) {
    if (!p.pattern || typeof p.pattern.views !== 'object') fail('bad pattern settings');
    for (const [view, v] of Object.entries<any>(p.pattern.views)) {
      if (!['rs', 'front', 'back', 'ls'].includes(view)) fail(`unknown pattern view ${view}`);
      if (!p.assets[v.assetId]) fail(`${view} pattern references a missing image`);
      if (v.mode !== 'tile' && v.mode !== 'single') fail(`${view} pattern has bad mode`);
      for (const k of ['scale', 'offsetX', 'offsetY', 'rotation', 'opacity']) if (!Number.isFinite(v[k])) fail(`${view} pattern has bad ${k}`);
      if (v.scale <= 0) fail(`${view} pattern has bad scale`);
    }
  }
  return { revision: 0, ...p, schema: SCHEMA_VERSION } as Project;
}

/** Imports the MVP prototype's `{name, items, baseSrc}` JSON. */
async function migratePrototype(raw: any): Promise<Project> {
  const p = newProject(typeof raw.name === 'string' ? raw.name : 'Imported shirt');
  const zoneMap: Record<string, string> = { 'N01 / TN01': 'N01', 'N02 / TN02': 'N02' };
  let project = p;
  for (const it of raw.items) {
    const code = zoneMap[it.zone] ?? it.zone;
    const pl = PLACEMENTS.find(q => q.code === code) ?? { code, zoneId: ZONES.some(z => z.id === code) ? code : 'F02', content: 'other' as ContentKind };
    const base = {
      id: newId(), zoneId: pl.zoneId, code: pl.code, content: pl.content,
      x: Number(it.x) || 0, y: Number(it.y) || 0, w: Number(it.w) || 50, rotation: Number(it.rotation) || 0,
      opacity: 1, visible: true, locked: false,
    };
    if (it.kind === 'text') {
      project = { ...project, layers: [...project.layers, {
        ...base, kind: 'text', text: String(it.text ?? ''), fontFamily: 'Arial', fontStyle: 'bold',
        fontSize: Math.max(12, (Number(it.h) || 40) * 0.75), fill: '#151515', align: 'center', letterSpacing: 0,
      }] };
    } else if (typeof it.src === 'string' && it.src.startsWith('data:')) {
      const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(it.src);
      if (!m) continue;
      const bytes = m[2] ? base64ToBytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3]));
      const h = Number(it.h) || 50;
      const asset = await makeAsset('imported', m[1], bytes, Math.round(base.w), Math.round(h));
      const r = withAsset(project, asset);
      project = { ...r.project, layers: [...r.project.layers, { ...base, kind: 'image', assetId: r.assetId, h }] };
    }
  }
  return project;
}
