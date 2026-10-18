import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Box, Download, FilePlus, FolderOpen, Library, Redo2, Save, Undo2 } from 'lucide-react';
import { useEditor } from './editor/useEditor';
import { StageView } from './render/StageView';
import { Sidebar } from './components/Sidebar';
import { Inspector } from './components/Inspector';
import { LayerList } from './components/LayerList';
import { LibraryDialog } from './components/LibraryDialog';
import { CalibratePanel } from './components/CalibratePanel';
import { PatternPanel } from './components/PatternPanel';

// three.js is only downloaded when the 3D preview is opened.
const Shirt3DDialog = lazy(() => import('./components/Shirt3DDialog').then(m => ({ default: m.Shirt3DDialog })));
import { CropDialog } from './components/CropDialog';
import { EXPORT_PRESETS, type ExportPreset } from './render/frame';
import { MASTER_W, MASTER_H, type ViewId } from './model/zones';
import { storage } from './io/storage';

export function App() {
  const ed = useEditor();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [guides, setGuides] = useState(false);
  const [calibrate, setCalibrate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);
  const [preset, setPreset] = useState<ExportPreset>('1080p');
  const [busy, setBusy] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const [patternMode, setPatternMode] = useState(false);
  const [patternTab, setPatternTab] = useState<ViewId>('front');

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); ed.saveFile(e.shiftKey); return; }
      if (mod && k === 'o') { e.preventDefault(); ed.openFile(); return; }
      if (typing) return;
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? ed.history.redo() : ed.history.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); ed.history.redo(); return; }
      if (mod && k === 'd' && ed.selected && !patternMode) { e.preventDefault(); ed.duplicateLayer(ed.selected.id); return; }
      if (mod) return;
      const step = e.shiftKey ? 10 : 1;
      const d = ({ arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] } as Record<string, number[]>)[k];
      const zoom = e.key === '+' || e.key === '=' ? 1.05 : e.key === '-' || e.key === '_' ? 1 / 1.05 : 0;
      const turn = e.key === '[' || e.key === '{' ? -(e.shiftKey ? 15 : 1) : e.key === ']' || e.key === '}' ? (e.shiftKey ? 15 : 1) : 0;

      // Base-pattern adjust mode: keys edit the active view's pattern.
      if (patternMode) {
        if (k === 'escape') { setPatternMode(false); return; }
        if (!ed.project.pattern?.views[patternTab]) return;
        if (d) { e.preventDefault(); ed.nudgePattern(patternTab, d[0], d[1]); }
        else if (zoom) { e.preventDefault(); ed.zoomPattern(patternTab, zoom); }
        else if (turn) { e.preventDefault(); ed.rotatePattern(patternTab, turn); }
        else if (e.key === '0') { e.preventDefault(); ed.fitPatternView(patternTab); }
        return;
      }

      const l = ed.selected;
      if (!l) return;
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); ed.removeLayer(l.id); return; }
      if (k === 'escape') { ed.setSelectedId(null); return; }
      if (l.locked) return;
      if (d) { e.preventDefault(); ed.updateLayer(l.id, { x: l.x + d[0], y: l.y + d[1] }, `${l.id}:nudge`); }
      else if (zoom) { e.preventDefault(); ed.transformLayer(l.id, zoom, 0, 'kzoom'); }
      else if (turn) { e.preventDefault(); ed.transformLayer(l.id, 1, turn, 'kturn'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ed, patternMode, patternTab]);

  // Browser: warn only if the latest change has not reached the local library yet.
  useEffect(() => {
    if (storage.kind !== 'web') return;
    const h = (e: BeforeUnloadEvent) => { if (!ed.persisted) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [ed.persisted]);

  useEffect(() => {
    if (!ed.notice) return;
    const t = setTimeout(() => ed.setNotice(null), ed.notice.kind === 'error' ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [ed.notice, ed]);

  const cropTarget = ed.project.layers.find(l => l.id === cropId);
  const cropLayer = cropTarget?.kind === 'image' && ed.project.assets[cropTarget.assetId] ? cropTarget : null;

  async function doExport() {
    setBusy(true);
    try { await ed.exportPNG(preset); } finally { setBusy(false); }
  }

  return (
    <div className="app">
      <header>
        <div className="brand"><strong>MD<span>STUDIOS</span></strong><small>SHIRT MOCKUP ENGINE <b>V2</b></small></div>
        <input aria-label="Project name" className="projName" value={ed.project.name} onChange={e => ed.rename(e.target.value)} />
        <div className="actions">
          <button title="New project" onClick={() => ed.newFile()}><FilePlus size={16} /><span>New</span></button>
          <button title="Projects on this device" onClick={() => setShowLibrary(true)}><Library size={16} /><span>Projects</span></button>
          <button title="Open .mdshirt file (Ctrl+O)" onClick={() => ed.openFile()}><FolderOpen size={16} /><span>Open</span></button>
          <button title="Save .mdshirt file (Ctrl+S, Shift = Save as)" onClick={() => ed.saveFile()}><Save size={16} /><span>Save file{ed.dirty ? ' •' : ''}</span></button>
          <button title="Undo (Ctrl+Z)" disabled={!ed.history.canUndo} onClick={ed.history.undo}><Undo2 size={16} /></button>
          <button title="Redo (Ctrl+Y)" disabled={!ed.history.canRedo} onClick={ed.history.redo}><Redo2 size={16} /></button>
          <select aria-label="Export size" value={preset} onChange={e => setPreset(e.target.value as ExportPreset)}>
            {Object.entries(EXPORT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button title="Rotating 3D preview" onClick={() => setShow3d(true)}><Box size={16} /><span>3D view</span></button>
          <button className="primary" disabled={busy} onClick={doExport}><Download size={16} /><span>{busy ? 'Exporting…' : 'Export PNG'}</span></button>
        </div>
      </header>
      <main>
        <aside>
          <Sidebar ed={ed} />
          <PatternPanel ed={ed} tab={patternTab} setTab={setPatternTab} adjusting={patternMode} setAdjusting={on => { setPatternMode(on); if (on) { ed.setSelectedId(null); setCalibrate(false); } }} />
          {calibrate && <CalibratePanel ed={ed} />}
          <section className="panel">
            <label className="check"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Show all placement guides</label>
            <label className="check"><input type="checkbox" checked={calibrate} onChange={e => { setCalibrate(e.target.checked); if (e.target.checked) { ed.setSelectedId(null); setPatternMode(false); } }} /> Calibrate zones</label>
            <p className="note">The master stencil is locked: artwork never changes its pixels, size or layout. Zone boundaries are estimates — not manufacturer measurements.</p>
          </section>
        </aside>
        <section className="workspace">
          <div className="topline">
            <div><b>Four-view master stencil</b><p>WEARER'S RIGHT SLEEVE · FRONT · BACK · WEARER'S LEFT SLEEVE</p></div>
            <span>LOCKED TEMPLATE</span>
          </div>
          <StageView
            stageRef={stageRef}
            project={ed.project}
            selectedId={calibrate || patternMode ? null : ed.selectedId}
            onSelect={id => !calibrate && ed.setSelectedId(id)}
            onLayerChange={(id, patch) => ed.updateLayer(id, patch)}
            activeZoneId={ed.placement.zoneId}
            guides={guides}
            calibrate={calibrate}
            zoneOverrides={ed.zoneOverrides}
            onZoneChange={ed.setZone}
            onImageDblClick={setCropId}
            onLayerWheel={(id, f, deg) => ed.transformLayer(id, f, deg, 'wheel')}
            patternMode={patternMode}
            patternView={patternTab}
            onPatternView={setPatternTab}
            onPatternChange={(v, patch, key) => ed.updatePatternView(v, patch, key)}
            onPatternZoom={(v, f, at) => ed.zoomPattern(v, f, at, 'wheel')}
            onPatternRotate={(v, deg, at) => ed.rotatePattern(v, deg, at, 'wheel')}
          />
          <div className="bottomline">
            <span>{ed.persisted ? 'Saved on this device' : 'Saving…'}{ed.filePath ? ` · ${ed.filePath}` : ''}</span>
            <span>Master {MASTER_W} × {MASTER_H} px · export {EXPORT_PRESETS[preset].w} × {EXPORT_PRESETS[preset].h}</span>
          </div>
          <LayerList ed={ed} />
        </section>
        <aside className="right">
          <Inspector ed={ed} onCrop={setCropId} />
        </aside>
      </main>
      {ed.notice && <div className={`toast ${ed.notice.kind}`} role="status" onClick={() => ed.setNotice(null)}>{ed.notice.text}</div>}
      {showLibrary && <LibraryDialog ed={ed} onClose={() => setShowLibrary(false)} />}
      {show3d && <Suspense fallback={<div className="toast">Loading 3D…</div>}><Shirt3DDialog project={ed.project} say={ed.say} onClose={() => setShow3d(false)} /></Suspense>}
      {cropLayer && <CropDialog layer={cropLayer} asset={ed.project.assets[cropLayer.assetId]} onClose={() => setCropId(null)} onApply={c => { ed.cropLayer(cropLayer.id, c); setCropId(null); }} />}
    </div>
  );
}
