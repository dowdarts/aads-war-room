// Builds public/garment-mask.png: an alpha mask of the four garment
// silhouettes, traced from the locked master. The master itself is only read.
//   node scripts/run-electron.cjs scripts/build-mask.cjs [--preview out.png]
//
// Method: flood-fill bright fabric from a seed inside each garment (so the
// white label text, which isn't connected, is excluded), close small gaps
// such as seam lines, fill enclosed holes, then feather the edge by 1 px.
const { app, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const FABRIC_MIN_LUMA = 172; // background measured ≤ 170 next to garments
const CLOSE_RADIUS = 3;
const EDGE_GROW = 3; // px
const EDGE_MIN_LUMA = 125;
const SIL_TRIM_GROW = 16; // px into black trim/collar/zipper
const SIL_TRIM_MAX_LUMA = 28;
const SIL_CLOSE_RADIUS = 9;
const SEEDS = [[120, 330], [520, 500], [1120, 450], [1545, 330]]; // rs, front, back, ls
const UNDERARM_WINDOWS = [[345, 377], [670, 700], [942, 972], [1263, 1292]]; // x ranges, front L/R, back L/R

app.whenReady().then(() => {
  const master = nativeImage.createFromPath(path.join(root, 'public', 'master-stencil.png'));
  const { width: W, height: H } = master.getSize();
  const src = master.toBitmap(); // BGRA
  const N = W * H;
  const fabric = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const b = src[i * 4], g = src[i * 4 + 1], r = src[i * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    fabric[i] = luma >= FABRIC_MIN_LUMA && sat < 40 ? 1 : 0;
  }

  // 1. Flood fill from seeds (4-connected).
  let mask = new Uint8Array(N);
  const stack = [];
  for (const [x, y] of SEEDS) {
    if (!fabric[y * W + x]) throw new Error(`seed ${x},${y} is not fabric`);
    stack.push(y * W + x);
  }
  while (stack.length) {
    const i = stack.pop();
    if (mask[i] || !fabric[i]) continue;
    mask[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < N - W) stack.push(i + W);
  }

  // 2. Morphological close (dilate then erode) to bridge thin seam lines.
  const morph = (m, r, dilate) => {
    const tmp = new Uint8Array(N), out = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r && (dilate ? !v : v); d++) { const xx = x + d; if (xx >= 0 && xx < W) v = dilate ? v | m[y * W + xx] : v & m[y * W + xx]; else if (!dilate) v = 0; }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r && (dilate ? !v : v); d++) { const yy = y + d; if (yy >= 0 && yy < H) v = dilate ? v | tmp[yy * W + x] : v & tmp[yy * W + x]; else if (!dilate) v = 0; }
      out[y * W + x] = v;
    }
    return out;
  };
  mask = morph(morph(mask, CLOSE_RADIUS, true), CLOSE_RADIUS, false);

  // 3. Fill holes: background regions not connected to the image border.
  const outside = new Uint8Array(N);
  for (let x = 0; x < W; x++) stack.push(x, N - W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || mask[i]) continue;
    outside[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < N - W) stack.push(i + W);
  }
  for (let i = 0; i < N; i++) mask[i] = outside[i] ? 0 : 1;

  // 3b. Under-arm patches: body fabric in shadow between sleeve and body is
  //     too dark for the fabric threshold. Fill row gaps that lie entirely
  //     inside these measured windows (the real background gap between the
  //     front and back views at x≈794–848 is outside them and stays out).
  for (const [a, b] of UNDERARM_WINDOWS) {
    for (let y = 355; y <= 450; y++) {
      let last = -1;
      for (let x = a - 20; x <= b + 20; x++) {
        if (!mask[y * W + x]) continue;
        if (last >= 0 && x - last > 1 && last + 1 >= a && x - 1 <= b) for (let xx = last + 1; xx < x; xx++) mask[y * W + xx] = 1;
        last = x;
      }
    }
  }

  // 3c. Soft edges: the garment fades into the background over a few pixels
  //     (luma ~130–170, background ~80–110). Grow up to EDGE_GROW px into
  //     such pixels so patterns reach the true edge without leaving slivers.
  for (let pass = 0; pass < EDGE_GROW; pass++) {
    const add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (mask[i] || !(mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W])) continue;
      const b = src[i * 4], g = src[i * 4 + 1], r = src[i * 4 + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b >= EDGE_MIN_LUMA && Math.max(r, g, b) - Math.min(r, g, b) < 40) add.push(i);
    }
    for (const i of add) mask[i] = 1;
  }

  // 4. Feather: 3×3 box blur → alpha, white RGB.
  const writeMask = (m, name) => {
    const out = Buffer.alloc(N * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += m[yy * W + xx]; c++; }
      }
      const i = (y * W + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = Math.round((s / c) * 255);
    }
    fs.writeFileSync(path.join(root, 'public', name), nativeImage.createFromBitmap(out, { width: W, height: H }).toPNG());
    let area = 0;
    for (let i = 0; i < N; i++) area += m[i];
    console.log(`${name} ${W}×${H}, area ${(100 * area / N).toFixed(1)}%`);
  };
  writeMask(mask, 'garment-mask.png');

  // 5. Silhouette for the 3D preview: the whole garment including the black
  //    collar, zipper and sleeve trims (excluded from the printable mask),
  //    so the 3D shell has no holes. Grow into dark trim pixels touching the
  //    garment, bridge small gaps, fill enclosed holes.
  let sil = Uint8Array.from(mask);
  for (let pass = 0; pass < SIL_TRIM_GROW; pass++) {
    const add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (sil[i] || !(sil[i - 1] || sil[i + 1] || sil[i - W] || sil[i + W])) continue;
      const b = src[i * 4], g = src[i * 4 + 1], r = src[i * 4 + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b < SIL_TRIM_MAX_LUMA) add.push(i);
    }
    for (const i of add) sil[i] = 1;
  }
  sil = morph(morph(sil, SIL_CLOSE_RADIUS, true), SIL_CLOSE_RADIUS, false);
  const silOutside = new Uint8Array(N);
  for (let x = 0; x < W; x++) stack.push(x, N - W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (silOutside[i] || sil[i]) continue;
    silOutside[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < N - W) stack.push(i + W);
  }
  for (let i = 0; i < N; i++) sil[i] = silOutside[i] ? 0 : 1;
  writeMask(sil, 'garment-silhouette.png');
  if (process.argv.includes('--silhouette-preview')) mask = sil;

  const pi = process.argv.indexOf('--preview');
  if (pi > 0) {
    // Master with everything outside the mask tinted red, for review.
    const prev = Buffer.from(src);
    for (let i = 0; i < N; i++) if (!mask[i]) { prev[i * 4 + 2] = Math.min(255, prev[i * 4 + 2] * 0.5 + 128); prev[i * 4 + 1] *= 0.5; prev[i * 4] *= 0.5; }
    fs.writeFileSync(process.argv[pi + 1], nativeImage.createFromBitmap(prev, { width: W, height: H }).toPNG());
  }
  app.exit(0);
});
