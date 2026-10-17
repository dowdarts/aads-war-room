import { Copy, Crop as CropIcon, Crosshair, Lock, Trash2, Unlock, Eye, EyeOff } from 'lucide-react';
import type { Editor } from '../editor/useEditor';
import type { Layer, TextLayer } from '../model/project';
import { CONTENT_LABELS, PLACEMENTS, placementByCode, type ContentKind } from '../model/zones';
import { TEXT_FONTS } from '../render/layerAttrs';

function Num({ label, value, onChange, step = 1, min }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number }) {
  return (
    <label className="field small">{label}
      <input type="number" step={step} min={min} value={Math.round(value * 10) / 10}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && (min === undefined || v >= min)) onChange(v); }} />
    </label>
  );
}

export function Inspector({ ed, onCrop }: { ed: Editor; onCrop(id: string): void }) {
  const l = ed.selected;
  if (!l) return (
    <section className="panel">
      <h3>Selected artwork</h3>
      <p className="muted">Click a logo or text on the shirt to move, resize or edit it. Empty placements stay empty.</p>
    </section>
  );

  const set = (patch: Partial<Layer>, field?: string) => ed.updateLayer(l.id, patch, field ? `${l.id}:${field}` : undefined);
  const setW = (w: number) => {
    if (l.kind === 'image') set({ w, h: w * (l.h / l.w) }, 'size'); // keep aspect ratio
    else set({ w }, 'w');
  };

  return (
    <section className="panel">
      <h3>Selected {l.kind === 'image' ? 'logo' : 'text'}</h3>
      <div className="row2">
        <label className="field small">Placement code
          <select value={l.code} onChange={e => { const p = placementByCode(e.target.value)!; set({ code: p.code, zoneId: p.zoneId, content: p.content }); }}>
            {PLACEMENTS.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
          </select>
        </label>
        <label className="field small">Used for
          <select value={l.content} onChange={e => set({ content: e.target.value as ContentKind })}>
            {Object.entries(CONTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      {l.kind === 'text' && <TextFields l={l} set={set} />}
      <div className="row2">
        <Num label="X (px)" value={l.x} onChange={x => set({ x }, 'x')} />
        <Num label="Y (px)" value={l.y} onChange={y => set({ y }, 'y')} />
        <Num label="Width (px)" value={l.w} min={4} onChange={setW} />
        {l.kind === 'image'
          ? <Num label="Height (px)" value={l.h} min={4} onChange={h => set({ h, w: h * (l.w / l.h) }, 'size')} />
          : <Num label="Font size" value={l.fontSize} min={4} onChange={fontSize => set({ fontSize }, 'fontSize')} />}
        <Num label="Rotation °" value={l.rotation} onChange={rotation => set({ rotation }, 'rotation')} />
        <Num label="Opacity %" value={l.opacity * 100} min={0} onChange={v => set({ opacity: Math.min(100, v) / 100 }, 'opacity')} />
      </div>
      <div className="btnRow">
        {l.kind === 'image' && <button title="Crop (or double-click the logo)" onClick={() => onCrop(l.id)}><CropIcon size={15} /> Crop</button>}
        <button title="Fit back into its placement" onClick={() => ed.refit(l.id)}><Crosshair size={15} /> Re-fit</button>
        <button title="Duplicate (Ctrl+D)" onClick={() => ed.duplicateLayer(l.id)}><Copy size={15} /></button>
        <button title={l.visible ? 'Hide' : 'Show'} onClick={() => set({ visible: !l.visible })}>{l.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
        <button title={l.locked ? 'Unlock' : 'Lock'} onClick={() => set({ locked: !l.locked })}>{l.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
        <button className="danger" title="Delete (Del)" onClick={() => ed.removeLayer(l.id)}><Trash2 size={15} /></button>
      </div>
      {l.kind === 'image' && ed.project.assets[l.assetId] && (
        <p className="muted tiny">Original: {ed.project.assets[l.assetId].name} · {ed.project.assets[l.assetId].width}×{ed.project.assets[l.assetId].height}{l.crop ? ` · cropped to ${Math.round(l.crop.w)}×${Math.round(l.crop.h)}` : ''}{l.crop && <> · <a href="#" onClick={e => { e.preventDefault(); ed.cropLayer(l.id, undefined); }}>remove crop</a></>}</p>
      )}
    </section>
  );
}

function TextFields({ l, set }: { l: TextLayer; set(p: Partial<TextLayer>, field?: string): void }) {
  return (
    <>
      <label className="field">Text<input value={l.text} onChange={e => set({ text: e.target.value }, 'text')} /></label>
      <div className="row2">
        <label className="field small">Font
          <select value={l.fontFamily} onChange={e => set({ fontFamily: e.target.value })}>
            {TEXT_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
        </label>
        <label className="field small">Style
          <select value={l.fontStyle} onChange={e => set({ fontStyle: e.target.value as TextLayer['fontStyle'] })}>
            {['normal', 'bold', 'italic', 'bold italic'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field small">Colour<input type="color" value={l.fill} onChange={e => set({ fill: e.target.value }, 'fill')} /></label>
        <label className="field small">Align
          <select value={l.align} onChange={e => set({ align: e.target.value as TextLayer['align'] })}>
            {['left', 'center', 'right'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <Num label="Letter spacing" value={l.letterSpacing} step={0.5} onChange={letterSpacing => set({ letterSpacing }, 'ls')} />
      </div>
    </>
  );
}
