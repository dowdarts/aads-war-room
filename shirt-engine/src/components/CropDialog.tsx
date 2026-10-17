import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { X } from 'lucide-react';
import type { Asset, Crop, ImageLayer } from '../model/project';
import { useAssetImage } from '../render/images';

type Ratio = 'free' | 'original' | '1:1' | '16:9' | '4:3';
const RATIOS: { id: Ratio; label: string }[] = [
  { id: 'free', label: 'Free' }, { id: 'original', label: 'Original' }, { id: '1:1', label: 'Square' },
  { id: '16:9', label: '16:9' }, { id: '4:3', label: '4:3' },
];

const MAX_W = 620, MAX_H = 420;

/** Crop an uploaded image without altering the original file. Coordinates
 *  are edited in the asset's own pixels; the view is scaled to fit. */
export function CropDialog({ layer, asset, onApply, onClose }: {
  layer: ImageLayer; asset: Asset; onApply(c: Crop | undefined): void; onClose(): void;
}) {
  const im = useAssetImage(asset);
  const A = { w: asset.width, h: asset.height };
  const k = Math.min(MAX_W / A.w, MAX_H / A.h); // view px per asset px
  const [crop, setCrop] = useState<Crop>(layer.crop ?? { x: 0, y: 0, w: A.w, h: A.h });
  const [ratio, setRatio] = useState<Ratio>('free');
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (rectRef.current && trRef.current) { trRef.current.nodes([rectRef.current]); trRef.current.getLayer()?.batchDraw(); }
  }, [im]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') apply(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const ratioValue = (r: Ratio) => r === 'original' ? A.w / A.h : r === '1:1' ? 1 : r === '16:9' ? 16 / 9 : r === '4:3' ? 4 / 3 : null;

  function clamp(c: Crop): Crop {
    const w = Math.max(1, Math.min(A.w, c.w)), h = Math.max(1, Math.min(A.h, c.h));
    return { x: Math.max(0, Math.min(A.w - w, c.x)), y: Math.max(0, Math.min(A.h - h, c.y)), w, h };
  }

  function pickRatio(r: Ratio) {
    setRatio(r);
    const v = ratioValue(r);
    if (!v) return;
    // Largest box of that shape centred on the current crop, inside the image.
    let w = crop.w, h = w / v;
    if (h > A.h) { h = A.h; w = h * v; }
    if (w > A.w) { w = A.w; h = w / v; }
    const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
    setCrop(clamp({ x: cx - w / 2, y: cy - h / 2, w, h }));
  }

  function apply() {
    const r = (n: number) => Math.round(n * 100) / 100;
    const c = clamp({ x: r(crop.x), y: r(crop.y), w: r(crop.w), h: r(crop.h) });
    const full = c.x <= 0.01 && c.y <= 0.01 && Math.abs(c.w - A.w) < 0.02 && Math.abs(c.h - A.h) < 0.02;
    onApply(full ? undefined : c);
  }

  const num = (label: string, key: keyof Crop) => (
    <label className="field small">{label}
      <input type="number" value={Math.round(crop[key])} onChange={e => {
        const v = Number(e.target.value);
        if (!Number.isFinite(v)) return;
        setRatio('free');
        // Keep the typed value; shrink the size to fit rather than moving the box.
        const c = { ...crop };
        if (key === 'x') { c.x = Math.max(0, Math.min(A.w - 1, v)); c.w = Math.min(c.w, A.w - c.x); }
        else if (key === 'y') { c.y = Math.max(0, Math.min(A.h - 1, v)); c.h = Math.min(c.h, A.h - c.y); }
        else if (key === 'w') c.w = Math.max(1, Math.min(A.w - c.x, v));
        else c.h = Math.max(1, Math.min(A.h - c.y, v));
        setCrop(c);
      }} />
    </label>
  );

  return (
    <div className="modalBack" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cropModal" role="dialog" aria-label="Crop image">
        <div className="modalHead">
          <h3>Crop “{asset.name}”</h3>
          <button aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted tiny">Drag the box or its handles. The original file is kept — you can re-crop or reset any time.</p>
        <div className="cropStage">
          <Stage width={A.w * k} height={A.h * k}>
            <Layer>
              <Rect width={A.w * k} height={A.h * k} fillPatternImage={checker() as unknown as HTMLImageElement} listening={false} />
              <KImage image={im ?? undefined} width={A.w * k} height={A.h * k} listening={false} />
              <Rect width={A.w * k} height={A.h * k} fill="rgba(0,0,0,0.55)" listening={false} />
              {/* Re-draw the kept area at full brightness. */}
              <KImage image={im ?? undefined} x={crop.x * k} y={crop.y * k} width={crop.w * k} height={crop.h * k}
                crop={im ? { x: crop.x * (im.naturalWidth || A.w) / A.w, y: crop.y * (im.naturalHeight || A.h) / A.h, width: crop.w * (im.naturalWidth || A.w) / A.w, height: crop.h * (im.naturalHeight || A.h) / A.h } : undefined}
                listening={false} />
              <Rect
                ref={rectRef}
                x={crop.x * k} y={crop.y * k} width={crop.w * k} height={crop.h * k}
                stroke="#f27c25" strokeWidth={1} draggable
                dragBoundFunc={pos => ({ x: Math.max(0, Math.min(A.w * k - crop.w * k, pos.x)), y: Math.max(0, Math.min(A.h * k - crop.h * k, pos.y)) })}
                onDragMove={e => setCrop(clamp({ ...crop, x: e.target.x() / k, y: e.target.y() / k }))}
                onTransform={e => {
                  const n = e.target;
                  const next = clamp({ x: n.x() / k, y: n.y() / k, w: (n.width() * n.scaleX()) / k, h: (n.height() * n.scaleY()) / k });
                  n.scale({ x: 1, y: 1 });
                  setCrop(next);
                }}
              />
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                keepRatio={ratio !== 'free'}
                flipEnabled={false}
                ignoreStroke
                borderStroke="#f27c25"
                anchorStroke="#f27c25"
                anchorSize={10}
                boundBoxFunc={(o, n) => (n.width < 4 || n.height < 4 || n.x < -0.5 || n.y < -0.5 || n.x + n.width > A.w * k + 0.5 || n.y + n.height > A.h * k + 0.5 ? o : n)}
              />
            </Layer>
          </Stage>
        </div>
        <div className="btnRow ratios">
          {RATIOS.map(r => <button key={r.id} className={ratio === r.id ? 'on' : ''} onClick={() => pickRatio(r.id)}>{r.label}</button>)}
        </div>
        <div className="row4">
          {num('Left', 'x')}{num('Top', 'y')}{num('Width', 'w')}{num('Height', 'h')}
        </div>
        <p className="muted tiny">Image {A.w}×{A.h} px · keeping {Math.round(crop.w)}×{Math.round(crop.h)} px</p>
        <div className="btnRow end">
          <button onClick={() => { setRatio('free'); setCrop({ x: 0, y: 0, w: A.w, h: A.h }); }}>Reset</button>
          <span className="grow" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={apply}>Apply crop</button>
        </div>
      </div>
    </div>
  );
}

let checkerCanvas: HTMLCanvasElement | null = null;
/** Checkerboard so transparent areas of logos are visible while cropping. */
function checker(): HTMLCanvasElement {
  if (checkerCanvas) return checkerCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3f47'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#2b2f35'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
  return (checkerCanvas = c);
}
