import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import type { Editor } from '../editor/useEditor';

export function LayerList({ ed }: { ed: Editor }) {
  const layers = [...ed.project.layers].reverse(); // top of stack first
  return (
    <section className="layerList">
      <h3>Artwork layers <small>{layers.length}</small></h3>
      {layers.length === 0
        ? <p className="muted">No artwork yet. Choose a placement and upload a logo or add text.</p>
        : layers.map(l => {
          const a = l.kind === 'image' ? ed.project.assets[l.assetId] : undefined;
          return (
            <div key={l.id} className={`layerRow${ed.selectedId === l.id ? ' chosen' : ''}${l.visible ? '' : ' hidden'}`}>
              <button className="layerName" onClick={() => ed.setSelectedId(l.id)}>
                <b>{l.code}</b> {l.kind === 'text' ? `“${l.text}”` : a?.name ?? 'logo'}
              </button>
              <button title="Bring forward" onClick={() => ed.moveLayer(l.id, 1)}><ChevronUp size={14} /></button>
              <button title="Send backward" onClick={() => ed.moveLayer(l.id, -1)}><ChevronDown size={14} /></button>
              <button title={l.visible ? 'Hide' : 'Show'} onClick={() => ed.updateLayer(l.id, { visible: !l.visible })}>{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <button title={l.locked ? 'Unlock' : 'Lock'} onClick={() => ed.updateLayer(l.id, { locked: !l.locked })}>{l.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
            </div>
          );
        })}
    </section>
  );
}
