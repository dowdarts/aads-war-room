import { useEffect, useState } from 'react';
import { Copy, Maximize, Move, Paintbrush, Trash2 } from 'lucide-react';
import type { Editor } from '../editor/useEditor';
import { VIEW_LABELS, type ViewId } from '../model/zones';
import { VIEW_ORDER, coverScale } from '../render/pattern';

const SHORT: Record<ViewId, string> = { rs: 'R sleeve', front: 'Front', back: 'Back', ls: 'L sleeve' };

/** Base shirt pattern / full design, per garment view. */
export function PatternPanel({ ed, tab, setTab, adjusting, setAdjusting }: {
  ed: Editor; tab: ViewId; setTab(v: ViewId): void; adjusting: boolean; setAdjusting(on: boolean): void;
}) {
  const views = ed.project.pattern?.views ?? {};
  const [targets, setTargets] = useState<ViewId[]>(VIEW_ORDER);
  const v = views[tab];
  const a = v && ed.project.assets[v.assetId];
  const any = Object.keys(views).length > 0;
  useEffect(() => { if (!any && adjusting) setAdjusting(false); }, [any, adjusting, setAdjusting]);

  const upload = (only?: ViewId) => (
    <input type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp"
      onChange={e => { const f = e.target.files?.[0]; if (f) ed.setPatternImage(f, only ? [only] : targets); e.target.value = ''; }} />
  );

  const set = (patch: Parameters<Editor['updatePatternView']>[1], key?: string) => ed.updatePatternView(tab, patch, key);
  const cover = a ? coverScale(tab, a.width, a.height) : 1;

  return (
    <section className="panel">
      <h3><Paintbrush size={14} /> Base shirt pattern</h3>
      {!any ? (
        <>
          <p className="muted tiny">Upload a full design or a repeating pattern. It fills the shirt fabric only, and the shirt's folds and shading show through. Logos and text sit on top.</p>
          <div className="viewChecks">
            {VIEW_ORDER.map(view => (
              <label key={view} className="check">
                <input type="checkbox" checked={targets.includes(view)}
                  onChange={e => setTargets(t => e.target.checked ? [...t, view] : t.filter(x => x !== view))} /> {SHORT[view]}
              </label>
            ))}
          </div>
          <label className="upload">Upload pattern / design{upload()}</label>
        </>
      ) : (
        <>
          <div className="tabs">
            {VIEW_ORDER.map(view => (
              <button key={view} className={`${tab === view ? 'on' : ''}${views[view] ? ' has' : ''}`} onClick={() => setTab(view)} title={VIEW_LABELS[view]}>
                {SHORT[view]}
              </button>
            ))}
          </div>
          {!v || !a ? (
            <>
              <p className="muted tiny">No pattern on the {VIEW_LABELS[tab].toLowerCase()}.</p>
              <label className="upload small">Upload for {SHORT[tab]}{upload(tab)}</label>
            </>
          ) : (
            <>
              <p className="muted tiny">{a.name} · {a.width}×{a.height}</p>
              <div className="row2">
                <label className="field small">Mode
                  <select value={v.mode} onChange={e => set({ mode: e.target.value as 'tile' | 'single' })}>
                    <option value="single">Single design</option>
                    <option value="tile">Repeat (tile)</option>
                  </select>
                </label>
                <label className="field small">Size %
                  <input type="number" min={1} step={1} value={Math.round((v.scale / cover) * 100)}
                    onChange={e => { const n = Number(e.target.value); if (n > 0) set({ scale: (cover * n) / 100 }, 'scale'); }} />
                </label>
              </div>
              <input className="slider" type="range" min={5} max={300} value={Math.round((v.scale / cover) * 100)}
                onChange={e => set({ scale: (cover * Number(e.target.value)) / 100 }, 'scale')} aria-label="Pattern size" />
              <div className="row2">
                <label className="field small">Move X<input type="number" value={Math.round(v.offsetX)} onChange={e => set({ offsetX: Number(e.target.value) || 0 }, 'x')} /></label>
                <label className="field small">Move Y<input type="number" value={Math.round(v.offsetY)} onChange={e => set({ offsetY: Number(e.target.value) || 0 }, 'y')} /></label>
                <label className="field small">Rotation °<input type="number" value={Math.round(v.rotation)} onChange={e => set({ rotation: Number(e.target.value) || 0 }, 'rot')} /></label>
                <label className="field small">Opacity %<input type="number" min={0} max={100} value={Math.round(v.opacity * 100)} onChange={e => set({ opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 }, 'op')} /></label>
              </div>
              <button className={`full adjustBtn${adjusting ? ' on' : ''}`} onClick={() => setAdjusting(!adjusting)}>
                <Move size={15} /> {adjusting ? 'Done adjusting (Esc)' : 'Adjust on shirt'}
              </button>
              {adjusting && (
                <p className="hint">
                  <b>Drag</b> to move · <b>scroll</b> to zoom · <b>Shift+scroll</b> to rotate<br />
                  <b>Arrows</b> move (Shift ×10) · <b>+ / −</b> zoom · <b>[ / ]</b> rotate (Shift 15°) · <b>0</b> fit
                </p>
              )}
              <div className="btnRow">
                <button title="Cover the whole view" onClick={() => ed.fitPatternView(tab)}><Maximize size={14} /> Fit</button>
                <button title="Use this image and size on all views" onClick={() => ed.copyPatternToAll(tab)}><Copy size={14} /> All views</button>
                <label className="btnLike" title="Replace image for this view">Replace{upload(tab)}</label>
                <button className="danger" title="Remove from this view" onClick={() => ed.removePatternView(tab)}><Trash2 size={14} /></button>
              </div>
            </>
          )}
          <button className="linkBtn" onClick={() => { if (confirm('Remove the pattern from every view?')) ed.removePatternView('all'); }}>Remove pattern from all views</button>
        </>
      )}
    </section>
  );
}
