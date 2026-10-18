// Builds a rotating 3D preview of the shirt from the 2D four-view mockup.
//
// There is no 3D garment model, so the front-view silhouette is "inflated"
// like a balloon (solve ∇²h = −1 inside the outline, h = 0 on it; depth ∝ √h).
// Wide parts (torso) get deep, narrow parts (sleeves) become slim tubes, and
// the front and back shells meet exactly at the outline. The composited front
// view is mapped on the front shell, the mirrored back view on the back.
// It is an illustrative preview, not a tailored garment.

import * as THREE from 'three';
import { MASTER_W, MASTER_H } from '../model/zones';
import type { Project } from '../model/project';
import { renderToCanvas } from '../render/exportImage';
import { fitFrame } from '../render/frame';
import { loadImage } from '../render/images';
import { inflate } from './inflate';

const SIL_URL = `${import.meta.env.BASE_URL}garment-silhouette.png`;
const FRONT_STRIP: [number, number] = [237, 821];
const BACK_STRIP: [number, number] = [821, 1415];

interface Box { x: number; y: number; w: number; h: number }

function bboxIn(alpha: Uint8ClampedArray, [x0, x1]: [number, number]): Box {
  let minX = x1, maxX = x0, minY = MASTER_H, maxY = 0;
  for (let y = 0; y < MASTER_H; y++) for (let x = x0; x < x1; x++) {
    if (alpha[(y * MASTER_W + x) * 4 + 3] > 127) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Crop of the composite for one view, edge colours bled outward so a
 *  slightly different silhouette never shows background at the rim. */
function viewTexture(composite: HTMLCanvasElement, sil: HTMLImageElement, srcBox: Box, outBox: Box, k: number, f: { scale: number; offsetX: number; offsetY: number }, mirror: boolean) {
  const W = Math.round(outBox.w * k), H = Math.round(outBox.h * k);
  // 1. Source view cut to its own silhouette.
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  const g = src.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
  g.drawImage(composite, f.offsetX + srcBox.x * f.scale, f.offsetY + srcBox.y * f.scale, srcBox.w * f.scale, srcBox.h * f.scale, 0, 0, W, H);
  // Cut to an ERODED silhouette: the mockup's outermost pixels are dark
  // outline/shadow, which would smear across the rim when seen from the side.
  const er = document.createElement('canvas');
  er.width = W; er.height = H;
  const e = er.getContext('2d')!;
  if (mirror) { e.translate(W, 0); e.scale(-1, 1); }
  e.drawImage(sil, srcBox.x, srcBox.y, srcBox.w, srcBox.h, 0, 0, W, H);
  e.setTransform(1, 0, 0, 1, 0, 0);
  const copy = document.createElement('canvas');
  copy.width = W; copy.height = H;
  copy.getContext('2d')!.drawImage(er, 0, 0);
  e.globalCompositeOperation = 'destination-in';
  const R = Math.max(2, Math.round(4 * k));
  for (let a = 0; a < 16; a++) e.drawImage(copy, Math.round(Math.cos((a * Math.PI) / 8) * R), Math.round(Math.sin((a * Math.PI) / 8) * R));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(er, 0, 0);
  // 2. Bleed interior colours outward to and past the true edge.
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const o = out.getContext('2d')!;
  o.drawImage(src, 0, 0);
  o.globalCompositeOperation = 'destination-over';
  for (let r = 2; r <= Math.round(4 * k) + 14; r += 2) for (let a = 0; a < 8; a++) {
    o.drawImage(src, Math.round(Math.cos((a * Math.PI) / 4) * r), Math.round(Math.sin((a * Math.PI) / 4) * r));
  }
  // 3. Final outline = the shared (front) silhouette, so both shells match.
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(sil, outBox.x, outBox.y, outBox.w, outBox.h, 0, 0, W, H);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface ShirtModel {
  group: THREE.Group;
  /** Width/height of the model in scene units (width is 1). */
  size: { w: number; h: number; depth: number };
  dispose(): void;
}

export async function buildShirtModel(project: Project): Promise<ShirtModel> {
  const [composite, sil] = await Promise.all([renderToCanvas(project, '4k'), loadImage(SIL_URL)]);
  const f = fitFrame(3840, 2160);

  const sc = document.createElement('canvas');
  sc.width = MASTER_W; sc.height = MASTER_H;
  const sg = sc.getContext('2d', { willReadFrequently: true })!;
  sg.drawImage(sil, 0, 0);
  const alpha = sg.getImageData(0, 0, MASTER_W, MASTER_H).data;
  const F = bboxIn(alpha, FRONT_STRIP);
  const B = bboxIn(alpha, BACK_STRIP);

  // Geometry grid over the front silhouette.
  const cols = 220;
  const cell = F.w / cols;
  const rows = Math.round(F.h / cell);
  const inside = new Uint8Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = Math.min(MASTER_W - 1, Math.round(F.x + i * cell)), y = Math.min(MASTER_H - 1, Math.round(F.y + j * cell));
    inside[j * (cols + 1) + i] = alpha[(y * MASTER_W + x) * 4 + 3] > 127 ? 1 : 0;
  }
  const h = inflate(inside, cols, rows, cell);
  const DEPTH_K = 1.15; // depth = K·√h; a strip of width w gets ≈0.4·w per side
  let maxZ = 0;
  const z = new Float32Array(h.length);
  for (let k = 0; k < h.length; k++) { z[k] = DEPTH_K * Math.sqrt(Math.max(0, h[k])); maxZ = Math.max(maxZ, z[k]); }
  // Pin the outermost inside nodes to z = 0 so the texture's outline (which
  // falls between nodes) is cut where both shells coincide — no rim gap.
  const C = cols + 1;
  for (let j = 1; j < rows; j++) for (let i = 1; i < cols; i++) {
    const k = j * C + i;
    if (inside[k] && (!inside[k - 1] || !inside[k + 1] || !inside[k - C] || !inside[k + C])) z[k] = 0;
  }

  const unit = 1 / F.w; // scene units per stencil px
  const positions: number[] = [], uvs: number[] = [], indexF: number[] = [], indexB: number[] = [];
  const vid = (i: number, j: number) => j * (cols + 1) + i;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = (i * cell - F.w / 2) * unit, y = (F.h / 2 - j * cell) * unit;
    positions.push(x, y, z[vid(i, j)] * unit);
    uvs.push(i / cols, 1 - j / rows);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1);
    if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
    indexF.push(a, c, b, b, c, d);
    indexB.push(a, b, c, b, d, c);
  }
  const front = new THREE.BufferGeometry();
  front.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  front.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  front.setIndex(indexF);
  front.computeVertexNormals();
  const back = new THREE.BufferGeometry();
  back.setAttribute('position', new THREE.Float32BufferAttribute(positions.map((v, k) => (k % 3 === 2 ? -v : v)), 3));
  back.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  back.setIndex(indexB);
  back.computeVertexNormals();

  const k = f.scale; // texture px per stencil px
  const frontTex = viewTexture(composite, sil, F, F, k, f, false);
  const backTex = viewTexture(composite, sil, B, F, k, f, true);
  const mat = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  const frontMat = mat(frontTex), backMat = mat(backTex);
  // Where the shells coincide at the rim, let the front win (no flicker).
  backMat.polygonOffset = true;
  backMat.polygonOffsetFactor = 1;
  backMat.polygonOffsetUnits = 1;

  const group = new THREE.Group();
  group.add(new THREE.Mesh(front, frontMat), new THREE.Mesh(back, backMat));
  return {
    group,
    size: { w: 1, h: F.h * unit, depth: 2 * maxZ * unit },
    dispose() {
      front.dispose(); back.dispose(); frontTex.dispose(); backTex.dispose(); frontMat.dispose(); backMat.dispose();
    },
  };
}
