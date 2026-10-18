import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  cropOf, makeAsset, newProject, parseProject, recropLayer, serializeProject, withAsset, type Crop, type PatternView,
  type ImageLayer, type Layer, type Project, type TextLayer,
} from '../model/project';
import { historyReducer, initHistory, type History, type HistoryAction } from '../model/history';
import { fitInZone, placementByCode, zoneById, PLACEMENTS, ZONES, type Rect, type ViewId } from '../model/zones';
import { coverScale, defaultPatternView, VIEW_ORDER } from '../render/pattern';
import { newId } from '../model/ids';
import { readImageFile } from '../render/images';
import { fitFontSize } from '../render/layerAttrs';
import { renderToBlob } from '../render/exportImage';
import type { ExportPreset } from '../render/frame';
import { library } from '../io/library';
import { safeFileName, storage } from '../io/storage';

const OVERRIDES_KEY = 'mdshirt.zoneOverrides';
const LAST_KEY = 'mdshirt.lastProjectId';

function readLS<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function writeLS(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export type Notice = { kind: 'info' | 'error'; text: string } | null;

export function useEditor() {
  const [hist, dispatch] = useReducer(historyReducer as (h: History<Project>, a: HistoryAction<Project>) => History<Project>, undefined, () => initHistory(newProject()));
  const project = hist.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placementCode, setPlacementCode] = useState('N01');
  // Overrides identical to the built-in geometry are dropped so they never
  // shadow later calibration updates shipped in zones.ts.
  const [zoneOverrides, setZoneOverrides] = useState<Record<string, Rect>>(() => Object.fromEntries(
    Object.entries(readLS<Record<string, Rect>>(OVERRIDES_KEY, {})).filter(([id, r]) => {
      const z = ZONES.find(q => q.id === id);
      return z && (z.x !== r.x || z.y !== r.y || z.w !== r.w || z.h !== r.h);
    })));
  const [filePath, setFilePath] = useState<string | undefined>();
  const [savedRef, setSavedRef] = useState<Project | null>(project);
  const [persisted, setPersisted] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [ready, setReady] = useState(false);

  const placement = placementByCode(placementCode) ?? PLACEMENTS[0];
  const zone = zoneById(placement.zoneId, zoneOverrides)!;
  const selected = project.layers.find(l => l.id === selectedId) ?? null;
  const dirty = savedRef !== project;

  const say = useCallback((text: string, kind: 'info' | 'error' = 'info') => setNotice({ kind, text }), []);

  const apply = useCallback((next: Project, key?: string) => {
    dispatch({ type: 'apply', next: { ...next, updatedAt: new Date().toISOString() }, key });
  }, []);

  const load = useCallback((p: Project, path?: string) => {
    dispatch({ type: 'reset', present: p });
    setSelectedId(null);
    setFilePath(path);
    setSavedRef(p);
    writeLS(LAST_KEY, p.id);
  }, []);

  // Restore the last open project from the local library.
  useEffect(() => {
    (async () => {
      try {
        const id = readLS<string | null>(LAST_KEY, null);
        const entry = id ? await library.get(id) : undefined;
        if (entry) load(await parseProject(entry.json));
      } catch { /* start fresh */ }
      setReady(true);
    })();
  }, [load]);

  // Autosave to the library shortly after each change.
  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    if (!ready) return;
    setPersisted(false);
    const t = setTimeout(async () => {
      try {
        const p = projectRef.current;
        await library.put({ id: p.id, name: p.name, updatedAt: p.updatedAt, layerCount: p.layers.length, json: serializeProject(p) });
        writeLS(LAST_KEY, p.id);
        setPersisted(true);
      } catch (e) {
        say(`Autosave failed: ${(e as Error).message}`, 'error');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [project, ready, say]);

  useEffect(() => { window.mdshirt?.setDirty(dirty); }, [dirty]);

  // ---- layer edits ----
  const updateLayer = useCallback((id: string, patch: Partial<Layer>, key?: string) => {
    const p = projectRef.current;
    apply({ ...p, layers: p.layers.map(l => (l.id === id ? { ...l, ...patch } as Layer : l)) }, key);
  }, [apply]);

  const addLayer = useCallback((p: Project, l: Layer) => {
    apply({ ...p, layers: [...p.layers, l] });
    setSelectedId(l.id);
  }, [apply]);

  const base = () => ({
    id: newId(), zoneId: placement.zoneId, code: placement.code, content: placement.content,
    rotation: 0, opacity: 1, visible: true, locked: false,
  });

  async function addImageFiles(files: FileList | File[]) {
    let p = projectRef.current;
    let last: ImageLayer | null = null;
    for (const file of Array.from(files)) {
      try {
        const img = await readImageFile(file);
        const asset = await makeAsset(file.name, img.mime, img.bytes, img.width, img.height);
        const r = withAsset(p, asset);
        const box = fitInZone(zone, img.width / img.height);
        last = { ...base(), kind: 'image', assetId: r.assetId, ...box };
        p = { ...r.project, layers: [...r.project.layers, last] };
      } catch (e) {
        say((e as Error).message, 'error');
      }
    }
    if (last) { apply(p); setSelectedId(last.id); }
  }

  function addText(text: string) {
    const t = text.trim();
    if (!t) return;
    const fontFamily = 'Arial', fontStyle = 'bold' as const;
    const fontSize = fitFontSize(t, fontFamily, fontStyle, zone.w, zone.h);
    const l: TextLayer = {
      ...base(), kind: 'text', text: t, fontFamily, fontStyle, fontSize, fill: '#151515', align: 'center', letterSpacing: 0,
      x: zone.x, y: zone.y + (zone.h - fontSize * 1.05) / 2, w: zone.w,
    };
    addLayer(projectRef.current, l);
  }

  function removeLayer(id: string) {
    const p = projectRef.current;
    apply({ ...p, layers: p.layers.filter(l => l.id !== id) });
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateLayer(id: string) {
    const p = projectRef.current;
    const i = p.layers.findIndex(l => l.id === id);
    if (i < 0) return;
    const copy = { ...p.layers[i], id: newId(), x: p.layers[i].x + 12, y: p.layers[i].y + 12 };
    const layers = [...p.layers];
    layers.splice(i + 1, 0, copy);
    apply({ ...p, layers });
    setSelectedId(copy.id);
  }

  function moveLayer(id: string, dir: 1 | -1 | 'top' | 'bottom') {
    const p = projectRef.current;
    const i = p.layers.findIndex(l => l.id === id);
    if (i < 0) return;
    const layers = [...p.layers];
    const [l] = layers.splice(i, 1);
    const to = dir === 'top' ? layers.length : dir === 'bottom' ? 0 : Math.max(0, Math.min(layers.length, i + dir));
    layers.splice(to, 0, l);
    apply({ ...p, layers });
  }

  /** Re-fit a layer into its zone (current calibration). */
  function refit(id: string) {
    const l = projectRef.current.layers.find(q => q.id === id);
    const z = l && zoneById(l.zoneId, zoneOverrides);
    if (!l || !z) return;
    if (l.kind === 'image') {
      const a = projectRef.current.assets[l.assetId];
      const c = a ? cropOf(l, a) : { w: l.w, h: l.h };
      updateLayer(id, { ...fitInZone(z, c.w / c.h), rotation: 0 });
    } else {
      const fontSize = fitFontSize(l.text, l.fontFamily, l.fontStyle, z.w, z.h);
      updateLayer(id, { x: z.x, y: z.y + (z.h - fontSize * 1.05) / 2, w: z.w, fontSize, rotation: 0 });
    }
  }

  /** Non-destructive crop (undefined = show the whole original image). */
  function cropLayer(id: string, crop: Crop | undefined) {
    const p = projectRef.current;
    apply({ ...p, layers: p.layers.map(l => (l.id === id && l.kind === 'image' && p.assets[l.assetId] ? recropLayer(l, p.assets[l.assetId], crop) : l)) });
  }

  // ---- base pattern ----
  async function setPatternImage(file: File, views: ViewId[]) {
    if (!views.length) return say('Choose at least one view for the pattern.', 'error');
    try {
      const img = await readImageFile(file);
      const asset = await makeAsset(file.name, img.mime, img.bytes, img.width, img.height);
      const r = withAsset(projectRef.current, asset);
      const cur = r.project.pattern?.views ?? {};
      const next = { ...cur };
      for (const v of views) next[v] = defaultPatternView(v, r.assetId, img.width, img.height);
      apply({ ...r.project, pattern: { views: next } });
    } catch (e) {
      say((e as Error).message, 'error');
    }
  }

  function updatePatternView(view: ViewId, patch: Partial<PatternView>, key?: string) {
    const p = projectRef.current;
    const v = p.pattern?.views[view];
    if (!v) return;
    apply({ ...p, pattern: { views: { ...p.pattern!.views, [view]: { ...v, ...patch } } } }, key ? `pattern:${view}:${key}` : undefined);
  }

  function removePatternView(view: ViewId | 'all') {
    const p = projectRef.current;
    if (!p.pattern) return;
    const views = { ...p.pattern.views };
    if (view === 'all') for (const k of Object.keys(views)) delete views[k as ViewId];
    else delete views[view];
    apply({ ...p, pattern: Object.keys(views).length ? { views } : undefined });
  }

  /** Copies one view's image and settings to the other views (re-fitted to each). */
  function copyPatternToAll(from: ViewId) {
    const p = projectRef.current;
    const src = p.pattern?.views[from];
    const a = src && p.assets[src.assetId];
    if (!src || !a) return;
    const k = src.scale / coverScale(from, a.width, a.height); // keep relative zoom
    const views = { ...p.pattern!.views };
    for (const v of VIEW_ORDER) if (v !== from) views[v] = { ...src, scale: coverScale(v, a.width, a.height) * k, offsetX: 0, offsetY: 0 };
    apply({ ...p, pattern: { views } });
  }

  function fitPatternView(view: ViewId) {
    const v = projectRef.current.pattern?.views[view];
    const a = v && projectRef.current.assets[v.assetId];
    if (a) updatePatternView(view, { scale: coverScale(view, a.width, a.height), offsetX: 0, offsetY: 0, rotation: 0 });
  }

  function rename(name: string) { apply({ ...projectRef.current, name }, 'rename'); }

  // ---- files ----
  async function saveFile(saveAs = false) {
    const p = projectRef.current;
    try {
      const r = await storage.saveProjectFile(serializeProject(p), `${safeFileName(p.name)}.mdshirt`, saveAs ? undefined : filePath);
      if (!r) return;
      setSavedRef(p);
      if (r.path) setFilePath(r.path);
      say(r.path ? `Saved ${r.path}` : 'Project file saved.');
    } catch (e) {
      say(`Save failed: ${(e as Error).message}`, 'error');
    }
  }

  async function openText(text: string, path?: string) {
    try {
      load(await parseProject(text), path);
      say('Project opened.');
    } catch (e) {
      say((e as Error).message, 'error');
    }
  }

  async function openFile() {
    const f = await storage.openProjectFile();
    if (f) await openText(f.text, f.path);
  }

  async function openFromLibrary(id: string) {
    const e = await library.get(id);
    if (e) await openText(e.json);
  }

  function newFile() { load(newProject()); }

  async function exportPNG(preset: ExportPreset) {
    try {
      const blob = await renderToBlob(projectRef.current, preset);
      const r = await storage.saveExport(blob, `${safeFileName(projectRef.current.name)}-${preset}.png`);
      if (r) say(r.path ? `Exported ${r.path}` : 'PNG exported.');
    } catch (e) {
      say(`Export failed: ${(e as Error).message}`, 'error');
    }
  }

  // ---- calibration ----
  function setZone(id: string, r: Rect) {
    setZoneOverrides(o => { const n = { ...o, [id]: r }; writeLS(OVERRIDES_KEY, n); return n; });
  }
  function resetZones() { setZoneOverrides({}); writeLS(OVERRIDES_KEY, {}); }

  const history = useMemo(() => ({
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  }), [hist.past.length, hist.future.length]);

  return {
    project, selected, selectedId, setSelectedId, placement, placementCode, setPlacementCode, zone,
    zoneOverrides, setZone, resetZones, dirty, persisted, filePath, notice, setNotice, say, history,
    updateLayer, addImageFiles, addText, removeLayer, duplicateLayer, moveLayer, refit, cropLayer, rename, apply,
    setPatternImage, updatePatternView, removePatternView, copyPatternToAll, fitPatternView,
    saveFile, openFile, openText, openFromLibrary, newFile, exportPNG,
  };
}

export type Editor = ReturnType<typeof useEditor>;
