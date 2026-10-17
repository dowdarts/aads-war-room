// Renders a project to a PNG on a fresh offscreen Konva stage. Only the
// master, pattern and visible layers (clipped to the garment) are drawn —
// selection handles, guides and labels added by the editor can never reach
// an export.

import Konva from 'konva';
import type { Project } from '../model/project';
import { MASTER_W, MASTER_H } from '../model/zones';
import { assetImage, masterImage, maskImage } from './images';
import { imageAttrs, textAttrs } from './layerAttrs';
import { EXPORT_PRESETS, fitFrame, type ExportPreset } from './frame';

export async function renderToCanvas(project: Project, preset: ExportPreset): Promise<HTMLCanvasElement> {
  const spec = EXPORT_PRESETS[preset];
  const f = fitFrame(spec.w, spec.h);
  const master = await masterImage();
  await document.fonts?.ready;

  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: spec.w, height: spec.h });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);

    if (!spec.artworkOnly) {
      // Neutral padding: stretch the master's own outermost column/row into
      // the bars, so they match the background with no visible seam.
      const mw = MASTER_W * f.scale, mh = MASTER_H * f.scale;
      if (f.offsetX > 0) {
        layer.add(new Konva.Image({ image: master, crop: { x: 0, y: 0, width: 1, height: MASTER_H }, x: 0, y: f.offsetY, width: Math.ceil(f.offsetX) + 1, height: mh }));
        layer.add(new Konva.Image({ image: master, crop: { x: MASTER_W - 1, y: 0, width: 1, height: MASTER_H }, x: Math.floor(f.offsetX + mw) - 1, y: f.offsetY, width: spec.w - Math.floor(f.offsetX + mw) + 1, height: mh }));
      }
      if (f.offsetY > 0) {
        layer.add(new Konva.Image({ image: master, crop: { x: 0, y: 0, width: MASTER_W, height: 1 }, x: 0, y: 0, width: spec.w, height: Math.ceil(f.offsetY) + 1 }));
        layer.add(new Konva.Image({ image: master, crop: { x: 0, y: MASTER_H - 1, width: MASTER_W, height: 1 }, x: 0, y: Math.floor(f.offsetY + mh) - 1, width: spec.w, height: spec.h - Math.floor(f.offsetY + mh) + 1 }));
      }
      layer.add(new Konva.Image({ image: master, x: f.offsetX, y: f.offsetY, width: mw, height: mh }));
    }

    const group = new Konva.Group({ x: f.offsetX, y: f.offsetY, scaleX: f.scale, scaleY: f.scale });
    layer.add(group);

    if (project.pattern && !spec.artworkOnly) {
      const { buildPatternGroup } = await import('./pattern');
      const pg = await buildPatternGroup(project, master);
      if (pg) group.add(pg);
    }

    // Artwork on its own canvas, then cut to the garment silhouettes so
    // nothing can show on the background, labels or padding.
    const artLayer = new Konva.Layer({ listening: false });
    stage.add(artLayer);
    const art = new Konva.Group({ x: f.offsetX, y: f.offsetY, scaleX: f.scale, scaleY: f.scale });
    artLayer.add(art);
    for (const l of project.layers) {
      if (!l.visible) continue;
      if (l.kind === 'image') {
        const a = project.assets[l.assetId];
        if (!a) continue;
        const im = await assetImage(a);
        art.add(new Konva.Image({ image: im, ...imageAttrs(l, a, im) }));
      } else {
        art.add(new Konva.Text(textAttrs(l)));
      }
    }
    art.add(new Konva.Image({ image: await maskImage(), width: MASTER_W, height: MASTER_H, globalCompositeOperation: 'destination-in' }));

    layer.draw();
    artLayer.draw();
    return stage.toCanvas({ pixelRatio: 1 });
  } finally {
    stage.destroy();
  }
}

export async function renderToBlob(project: Project, preset: ExportPreset): Promise<Blob> {
  const canvas = await renderToCanvas(project, preset);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'));
}
