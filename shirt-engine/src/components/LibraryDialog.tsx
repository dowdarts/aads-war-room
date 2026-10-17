import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { library, type LibraryEntry } from '../io/library';
import type { Editor } from '../editor/useEditor';

type Meta = Omit<LibraryEntry, 'json'>;

export function LibraryDialog({ ed, onClose }: { ed: Editor; onClose(): void }) {
  const [items, setItems] = useState<Meta[] | null>(null);
  const refresh = () => library.list().then(setItems, () => setItems([]));
  useEffect(() => { refresh(); }, []);

  async function remove(m: Meta) {
    if (m.id === ed.project.id) return ed.say('That project is open — open another one first.', 'error');
    if (!confirm(`Delete "${m.name}" from this device? Project files you saved elsewhere are not affected.`)) return;
    await library.remove(m.id);
    refresh();
  }

  return (
    <div className="modalBack" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="Projects on this device">
        <div className="modalHead">
          <h3>Projects on this device</h3>
          <button aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted tiny">Every project autosaves here. Use “Save file” to keep a portable .mdshirt copy.</p>
        {items === null ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="muted">No projects yet.</p> : (
          <ul className="libList">
            {items.map(m => (
              <li key={m.id} className={m.id === ed.project.id ? 'current' : ''}>
                <button className="libOpen" onClick={async () => { await ed.openFromLibrary(m.id); onClose(); }}>
                  <b>{m.name}</b>
                  <small>{m.layerCount} layers · {new Date(m.updatedAt).toLocaleString()}</small>
                </button>
                <button className="danger" onClick={() => remove(m)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
