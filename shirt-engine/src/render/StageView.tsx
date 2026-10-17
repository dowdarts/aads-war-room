import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text as KText, Transformer, Group } from 'react-konva';
import type Konva from 'konva';
import type { ImageLayer, Layer as PLayer, Project, TextLayer } from '../model/project';
import { MASTER_W, MASTER_H, PLACEMENTS, ZONES, type Rect as ZRect } from '../model/zones';
import { useAssetImage, useMasterImage, useMaskImage } from './images';
import { imageAttrs, textAttrs } from './layerAttrs';
import { PatternLayer } from './PatternLayer';

export interface StageViewProps {
  project: Project;
  selectedId: string | null;
  onSelect(id: string | null): void;
  onLayerChange(id: string, patch: Partial<PLayer>): void;
  activeZoneId: string;
  guides: boolean;
  calibrate: boolean;
  zoneOverrides: Record<string, ZRect>;
  onZoneChange(id: string, r: ZRect): void;
  stageRef?: React.RefObject<Konva.Stage | null>;
}

const GUIDE = '#f59e0b';

export function StageView(p: StageViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const master = useMasterImage();
  const mask = useMaskImage();
  const tr = useRef<Konva.Transformer>(null);
  const zoneTr = useRef<Konva.Transformer>(null);
  const localStage = useRef<Konva.Stage>(null);
  const stageRef = p.stageRef ?? localStage;
  const [calZone, setCalZone] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(200, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / MASTER_W;
  const selected = p.project.layers.find(l => l.id === p.selectedId);

  useEffect(() => {
    const t = tr.current;
    const stage = stageRef.current;
    if (!t || !stage) return;
    const node = selected && !selected.locked && selected.visible ? stage.findOne(`#L${selected.id}`) : undefined;
    t.nodes(node ? [node] : []);
    t.getLayer()?.batchDraw();
  });

  useEffect(() => {
    const t = zoneTr.current;
    const stage = stageRef.current;
    if (!t || !stage) return;
    const node = p.calibrate && calZone ? stage.findOne(`#Z${calZone}`) : undefined;
    t.nodes(node ? [node] : []);
    t.getLayer()?.batchDraw();
  });

  const zoneRect = (id: string) => ({ ...ZONES.find(z => z.id === id)!, ...p.zoneOverrides[id] });
  const active = ZONES.some(z => z.id === p.activeZoneId) ? zoneRect(p.activeZoneId) : null;

  return (
    <div ref={wrap} className="canvasWrap">
      <Stage
        ref={stageRef as React.RefObject<Konva.Stage>}
        width={width}
        height={width * MASTER_H / MASTER_W}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={e => { if (e.target === e.target.getStage() || e.target.name() === 'master') { p.onSelect(null); setCalZone(null); } }}
        onTouchStart={e => { if (e.target === e.target.getStage() || e.target.name() === 'master') { p.onSelect(null); setCalZone(null); } }}
      >
        <Layer>
          <KImage name="master" image={master ?? undefined} width={MASTER_W} height={MASTER_H} />
          <PatternLayer project={p.project} master={master} />
        </Layer>
        {/* Artwork has its own canvas so the garment mask (destination-in)
            erases everything outside the shirt without touching the master.
            Until the mask loads, artwork is not drawn at all. */}
        <Layer visible={!!mask}>
          {p.project.layers.map(l => l.kind === 'image'
            ? <ImageNode key={l.id} l={l} project={p.project} onSelect={p.onSelect} onChange={p.onLayerChange} />
            : <TextNode key={l.id} l={l} onSelect={p.onSelect} onChange={p.onLayerChange} />)}
          <KImage image={mask ?? undefined} width={MASTER_W} height={MASTER_H} globalCompositeOperation="destination-in" listening={false} />
        </Layer>
        <Layer>
          <Transformer
            ref={tr}
            keepRatio
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            rotationSnaps={[0, 90, 180, 270]}
            anchorSize={10}
            borderStroke="#f27c25"
            anchorStroke="#f27c25"
            boundBoxFunc={(o, n) => (n.width < 4 || n.height < 4 ? o : n)}
          />
        </Layer>
        <Layer listening={p.calibrate}>
          {active && !p.guides && !p.calibrate && (
            <Rect x={active.x} y={active.y} width={active.w} height={active.h} stroke={GUIDE} strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} opacity={0.7} listening={false} />
          )}
          {(p.guides || p.calibrate) && ZONES.map(z => {
            const r = zoneRect(z.id);
            const isActive = z.id === p.activeZoneId;
            return (
              <React.Fragment key={z.id}>
                <Rect
                  id={`Z${z.id}`}
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  stroke={isActive ? '#fff' : GUIDE}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeScaleEnabled={false}
                  dash={[8, 5]}
                  fill={p.calibrate ? 'rgba(245,158,11,0.12)' : undefined}
                  draggable={p.calibrate}
                  onMouseDown={() => p.calibrate && setCalZone(z.id)}
                  onTap={() => p.calibrate && setCalZone(z.id)}
                  onDragEnd={e => p.onZoneChange(z.id, { x: round(e.target.x()), y: round(e.target.y()), w: r.w, h: r.h })}
                  onTransformEnd={e => {
                    const n = e.target;
                    const next = { x: round(n.x()), y: round(n.y()), w: round(n.width() * n.scaleX()), h: round(n.height() * n.scaleY()) };
                    n.scale({ x: 1, y: 1 });
                    p.onZoneChange(z.id, next);
                  }}
                />
                <KText x={r.x} y={r.y - 22} text={PLACEMENTS.filter(q => q.zoneId === z.id).map(q => q.code).join(' / ')} fill={isActive ? '#fff' : GUIDE} fontSize={18} fontStyle="bold" listening={false} />
              </React.Fragment>
            );
          })}
          {p.calibrate && <Transformer ref={zoneTr} rotateEnabled={false} keepRatio={false} borderStroke="#fff" anchorStroke="#fff" anchorSize={8} ignoreStroke />}
        </Layer>
      </Stage>
    </div>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

function common(l: PLayer, onSelect: (id: string) => void, onChange: StageViewProps['onLayerChange']) {
  return {
    id: `L${l.id}`,
    draggable: !l.locked,
    listening: l.visible,
    onMouseDown: () => onSelect(l.id),
    onTap: () => onSelect(l.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onChange(l.id, { x: round(e.target.x()), y: round(e.target.y()) }),
  };
}

function ImageNode({ l, project, onSelect, onChange }: { l: ImageLayer; project: Project; onSelect(id: string): void; onChange: StageViewProps['onLayerChange'] }) {
  const im = useAssetImage(project.assets[l.assetId]);
  return (
    <KImage
      {...imageAttrs(l)}
      {...common(l, onSelect, onChange)}
      image={im ?? undefined}
      onTransformEnd={e => {
        const n = e.target;
        const patch = { x: round(n.x()), y: round(n.y()), w: round(n.width() * n.scaleX()), h: round(n.height() * n.scaleY()), rotation: round(n.rotation()) };
        n.scale({ x: 1, y: 1 });
        onChange(l.id, patch);
      }}
    />
  );
}

function TextNode({ l, onSelect, onChange }: { l: TextLayer; onSelect(id: string): void; onChange: StageViewProps['onLayerChange'] }) {
  return (
    <KText
      {...textAttrs(l)}
      {...common(l, onSelect, onChange)}
      onTransformEnd={e => {
        const n = e.target;
        const s = n.scaleX();
        const patch = { x: round(n.x()), y: round(n.y()), w: round(l.w * s), fontSize: round(l.fontSize * s), rotation: round(n.rotation()) };
        n.scale({ x: 1, y: 1 });
        onChange(l.id, patch);
      }}
    />
  );
}
