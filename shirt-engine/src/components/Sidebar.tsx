import { useState } from 'react';
import { ImagePlus, Type } from 'lucide-react';
import { PLACEMENTS, VIEW_LABELS, ZONES } from '../model/zones';
import type { Editor } from '../editor/useEditor';

export function Sidebar({ ed }: { ed: Editor }) {
  const [text, setText] = useState('YOUR NAME');
  const [dragOver, setDragOver] = useState(false);
  const zone = ZONES.find(z => z.id === ed.placement.zoneId)!;
  const sharing = PLACEMENTS.filter(p => p.zoneId === zone.id && p.code !== ed.placement.code);

  return (
    <section className="panel">
      <h3>Add artwork</h3>
      <label className="field">Placement
        <select value={ed.placementCode} onChange={e => ed.setPlacementCode(e.target.value)}>
          {(['rs', 'front', 'back', 'ls'] as const).map(v => (
            <optgroup key={v} label={VIEW_LABELS[v]}>
              {PLACEMENTS.filter(p => ZONES.find(z => z.id === p.zoneId)!.view === v).map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="zoneInfo">
        {zone.label}
        <small>
          {sharing.length > 0 && <>Same position as {sharing.map(s => s.code).join(', ')}. </>}
          Optional · wearer's perspective · {Math.round(ed.zone.w)}×{Math.round(ed.zone.h)} px
        </small>
      </div>
      <label
        className={`upload${dragOver ? ' over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) ed.addImageFiles(e.dataTransfer.files); }}
      >
        <ImagePlus size={18} /> Upload logo (PNG / SVG / JPG / WebP)
        <small>or drop files here — original file is kept unchanged</small>
        <input type="file" multiple accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden
          onChange={e => { if (e.target.files?.length) ed.addImageFiles(e.target.files); e.target.value = ''; }} />
      </label>
      <label className="field">Name or text
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ed.addText(text); }} />
      </label>
      <button className="full" onClick={() => ed.addText(text)}><Type size={16} /> Add text to {ed.placement.code}</button>
    </section>
  );
}
