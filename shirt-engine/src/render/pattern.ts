// Base shirt pattern: each view's design is drawn inside that view's area,
// cut to the garment mask, and multiplied onto the master. White fabric
// takes the design's colours while the master's folds, seams and shading
// darken it naturally; the background is never touched.

import { MASTER_W, MASTER_H, type Rect, type ViewId } from '../model/zones';
import type { PatternView, Project } from '../model/project';
import { assetImage, maskImage } from './images';

/** Garment bounds per view, measured from public/garment-mask.png. */
export const VIEW_BOUNDS: Record<ViewId, Rect> = {
  rs: { x: 22, y: 264, w: 205, h: 319 },
  front: { x: 248, y: 146, w: 550, h: 631 },
  back: { x: 846, y: 132, w: 547, h: 645 },
  ls: { x: 1439, y: 264, w: 210, h: 317 },
};

/** Vertical strips that separate the views; a view's design never crosses them. */
const VIEW_CLIP: Record<ViewId, [number, number]> = {
  rs: [0, 237], front: [237, 821], back: [821, 1415], ls: [1415, MASTER_W],
};

export const VIEW_ORDER: ViewId[] = ['rs', 'front', 'back', 'ls'];

/** Scale at which an image just covers the whole view. */
export function coverScale(view: ViewId, imgW: number, imgH: number): number {
  const b = VIEW_BOUNDS[view];
  return Math.max(b.w / imgW, b.h / imgH);
}

export function defaultPatternView(view: ViewId, assetId: string, imgW: number, imgH: number): PatternView {
  return { assetId, mode: 'single', scale: coverScale(view, imgW, imgH), offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 };
}

/** Draws the pattern for all views at `scale` × master size. Pure canvas. */
export function drawPattern(
  project: Project,
  images: Record<string, HTMLImageElement>,
  mask: HTMLImageElement,
  scale = 1,
): HTMLCanvasElement | null {
  const views = project.pattern?.views;
  if (!views || !Object.keys(views).length) return null;
  const c = document.createElement('canvas');
  c.width = Math.round(MASTER_W * scale);
  c.height = Math.round(MASTER_H * scale);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.scale(scale, scale);

  for (const view of VIEW_ORDER) {
    const v = views[view];
    const im = v && images[v.assetId];
    if (!v || !im) continue;
    const b = VIEW_BOUNDS[view];
    const [cx0, cx1] = VIEW_CLIP[view];
    const cx = b.x + b.w / 2 + v.offsetX, cy = b.y + b.h / 2 + v.offsetY;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    g.save();
    g.beginPath();
    g.rect(cx0, 0, cx1 - cx0, MASTER_H);
    g.clip();
    g.globalAlpha = Math.max(0, Math.min(1, v.opacity));
    if (v.mode === 'tile') {
      const pat = g.createPattern(im, 'repeat');
      if (pat) {
        pat.setTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(v.rotation).scaleSelf(v.scale).translateSelf(-iw / 2, -ih / 2));
        g.fillStyle = pat;
        g.fillRect(cx0, 0, cx1 - cx0, MASTER_H);
      }
    } else {
      g.translate(cx, cy);
      g.rotate((v.rotation * Math.PI) / 180);
      g.scale(v.scale, v.scale);
      g.drawImage(im, -iw / 2, -ih / 2, iw, ih);
    }
    g.restore();
  }

  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0, MASTER_W, MASTER_H);
  return c;
}

/** Loads the images and renders the pattern canvas (null when no pattern). */
export async function buildPatternCanvas(project: Project, scale = 1): Promise<HTMLCanvasElement | null> {
  const views = project.pattern?.views;
  if (!views || !Object.keys(views).length) return null;
  const images: Record<string, HTMLImageElement> = {};
  for (const v of Object.values(views)) {
    const a = v && project.assets[v.assetId];
    if (a && !images[a.id]) images[a.id] = await assetImage(a);
  }
  return drawPattern(project, images, await maskImage(), scale);
}
