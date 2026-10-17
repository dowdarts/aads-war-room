import { ZONES } from '../model/zones';
import type { Editor } from '../editor/useEditor';

/** Zone calibration: drag/resize zone rectangles on the canvas, then copy
 *  the coordinates so they can be locked into src/model/zones.ts. */
export function CalibratePanel({ ed }: { ed: Editor }) {
  const changed = ZONES.filter(z => ed.zoneOverrides[z.id]);
  const json = JSON.stringify(Object.fromEntries(ZONES.map(z => [z.id, ed.zoneOverrides[z.id] ?? { x: z.x, y: z.y, w: z.w, h: z.h }])), null, 1);

  async function copy() {
    try { await navigator.clipboard.writeText(json); ed.say('Zone coordinates copied — paste them to Claude.'); }
    catch { prompt('Copy these coordinates:', json); }
  }

  return (
    <section className="panel calibrate">
      <h3>Calibrate zones</h3>
      <p className="muted tiny">Click a zone on the shirt, then drag it or pull its corners. Changes only affect guides and new placements on this device until they are locked into the app.</p>
      <p className="tiny">{changed.length ? `Adjusted: ${changed.map(z => z.id).join(', ')}` : 'No zones adjusted yet.'}</p>
      <div className="btnRow">
        <button className="primary" onClick={copy}>Copy coordinates</button>
        <button onClick={() => { if (confirm('Reset all zones to the built-in estimates?')) ed.resetZones(); }}>Reset</button>
      </div>
    </section>
  );
}
