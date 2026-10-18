// Headless end-to-end export check. Run after `npm run build`:
//   npx electron scripts/smoke-export.cjs
// Loads dist/ over file:// (same as the packaged app), renders exports through
// the real Konva pipeline and compares pixels against the approved master
// using Electron's own PNG decoder.
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errors.push(msg); });
  try {
    await win.loadURL(pathToFileURL(path.join(root, 'dist', 'index.html')).toString());
    const run = js => win.webContents.executeJavaScript(js, true);

    // Wait for the editor canvas and master to load.
    const mounted = await run(`new Promise(r => { let n = 0; const t = setInterval(() => { const c = document.querySelector('.canvasWrap canvas'); if (c || ++n > 100) { clearInterval(t); r(!!c); } }, 50); })`);
    check('editor mounts from file:// (packaged-mode asset paths)', mounted);

    const master = nativeImage.createFromPath(path.join(root, 'public', 'master-stencil.png'));
    const mBmp = master.toBitmap();
    const { width: MW, height: MH } = master.getSize();

    const exportPng = async (projectExpr, preset) => {
      const url = await run(`(async () => { const d = window.mdshirtDebug; const p = await (${projectExpr}); const c = await d.renderToCanvas(p, '${preset}'); return c.toDataURL('image/png'); })()`);
      return nativeImage.createFromDataURL(url);
    };

    // 1. Empty project, native: identical to master.
    const empty = await exportPng('window.mdshirtDebug.newProject()', 'native');
    const eb = empty.toBitmap();
    let diff = 0;
    for (let i = 0; i < eb.length; i++) if (eb[i] !== mBmp[i]) diff++;
    check('empty project native export is pixel-identical to master', empty.getSize().width === MW && empty.getSize().height === MH && diff === 0, `${empty.getSize().width}×${empty.getSize().height}, ${diff} differing bytes`);

    // 2. 1080p framing: exact size, padding columns match the master's edge.
    const hd = await exportPng('window.mdshirtDebug.newProject()', '1080p');
    const hs = hd.getSize();
    const hb = hd.toBitmap();
    const px = (b, w, x, y) => { const i = (y * w + x) * 4; return [b[i + 2], b[i + 1], b[i], b[i + 3]]; };
    let maxPadDelta = 0;
    for (let y = 0; y < 1080; y += 37) {
      const my = Math.min(MH - 1, Math.round(y * MH / 1080));
      for (const [ox, mx] of [[0, 0], [1919, MW - 1]]) {
        const a = px(hb, 1920, ox, y), m = px(mBmp, MW, mx, my);
        maxPadDelta = Math.max(maxPadDelta, ...a.slice(0, 3).map((v, k) => Math.abs(v - m[k])));
        if (a[3] !== 255) maxPadDelta = 999;
      }
    }
    check('1080p export is exactly 1920×1080', hs.width === 1920 && hs.height === 1080, `${hs.width}×${hs.height}`);
    check('1080p padding is opaque and matches master edge colour', maxPadDelta <= 24, `max channel delta ${maxPadDelta}`);

    // 3. Logo on RS01: changes pixels only inside the logo box; round-trips.
    const logoProject = `(async () => {
      const d = window.mdshirtDebug;
      const c = document.createElement('canvas'); c.width = 40; c.height = 20;
      const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 40, 20);
      const b64 = c.toDataURL('image/png').split(',')[1];
      const p = d.newProject('smoke');
      const json = JSON.stringify({ ...p, assets: { a1: { id: 'a1', name: 'red.png', mime: 'image/png', sha256: 'x', width: 40, height: 20, data: b64 } },
        layers: [{ id: 'l1', kind: 'image', assetId: 'a1', zoneId: 'F02', code: 'F02', content: 'other', x: 470, y: 450, w: 100, h: 50, rotation: 0, opacity: 1, visible: true, locked: false }] });
      return d.parseProject(d.serializeProject(await d.parseProject(json)));
    })()`;
    const logo = await exportPng(logoProject, 'native');
    const lb = logo.toBitmap();
    let outside = 0, insideRed = 0, insideTotal = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = (y * MW + x) * 4;
      const inBox = x >= 470 && x < 570 && y >= 450 && y < 500;
      if (inBox) { insideTotal++; if (lb[i + 2] > 240 && lb[i + 1] < 15 && lb[i] < 15) insideRed++; }
      else if (x < 469 || x > 570 || y < 449 || y > 500) { if (lb[i] !== mBmp[i] || lb[i + 1] !== mBmp[i + 1] || lb[i + 2] !== mBmp[i + 2]) outside++; }
    }
    check('front logo renders at its saved coordinates after save→open', insideRed / insideTotal > 0.97, `${insideRed}/${insideTotal} px red`);
    check('master pixels outside the logo are untouched', outside === 0, `${outside} changed px`);

    // 4. Hidden layers never export.
    const hidden = await exportPng(logoProject.replace('visible: true', 'visible: false'), 'native');
    check('hidden layers are not exported', Buffer.compare(hidden.toBitmap(), mBmp) === 0);

    // 5. Artwork-only export is transparent outside artwork.
    const art = await exportPng(logoProject, 'artwork-native');
    const ab = art.toBitmap();
    check('artwork-only export is transparent away from artwork', ab[3] === 0 && ab[((500 * MW) + 800) * 4 + 3] === 0 && ab[((475 * MW) + 520) * 4 + 3] === 255);

    // 6. Garment clipping: a red logo covering the whole canvas may only
    //    colour the shirt. Every off-garment pixel must equal the master.
    const maskImg = nativeImage.createFromPath(path.join(root, 'public', 'garment-mask.png'));
    const mk = maskImg.toBitmap();
    const cover = await exportPng(logoProject.replace('x: 470, y: 450, w: 100, h: 50', `x: 0, y: 0, w: ${MW}, h: ${MH}`), 'native');
    const cb = cover.toBitmap();
    let bgChanged = 0, fabricNotRed = 0, fabricPx = 0;
    for (let i = 0; i < MW * MH; i++) {
      const a = mk[i * 4 + 3];
      if (a === 0) { if (cb[i * 4] !== mBmp[i * 4] || cb[i * 4 + 1] !== mBmp[i * 4 + 1] || cb[i * 4 + 2] !== mBmp[i * 4 + 2]) bgChanged++; }
      else if (a === 255) { fabricPx++; if (!(cb[i * 4 + 2] > 240 && cb[i * 4 + 1] < 15 && cb[i * 4] < 15)) fabricNotRed++; }
    }
    check('artwork never appears outside the garment', bgChanged === 0, `${bgChanged} off-garment px changed`);
    check('artwork fully covers the garment where placed', fabricNotRed === 0 && fabricPx > 100000, `${fabricPx} garment px, ${fabricNotRed} not red`);
    const offShirt = await exportPng(logoProject.replace('x: 470, y: 450', 'x: 700, y: 60'), 'native');
    check('logo dragged onto the background is invisible', Buffer.compare(offShirt.toBitmap(), mBmp) === 0);

    // 7. Crop: a 40×20 image, left half red / right half blue, shown at
    //    100×50 on the front. Cropping to the blue half must show only blue,
    //    at the same place on the shirt (x 520–570).
    const cropped = await exportPng(`(async () => {
      const d = window.mdshirtDebug;
      const c = document.createElement('canvas'); c.width = 40; c.height = 20;
      const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 20, 20); g.fillStyle = '#0000ff'; g.fillRect(20, 0, 20, 20);
      const a = { id: 'rb1', name: 'rb.png', mime: 'image/png', sha256: 'x', width: 40, height: 20, data: c.toDataURL('image/png').split(',')[1] };
      const l = { id: 'l1', kind: 'image', assetId: 'rb1', zoneId: 'F02', code: 'F02', content: 'other', x: 470, y: 450, w: 100, h: 50, rotation: 0, opacity: 1, visible: true, locked: false };
      const p = { ...d.newProject('crop'), assets: { rb1: a }, layers: [d.recropLayer(l, a, { x: 20, y: 0, w: 20, h: 20 })] };
      return d.parseProject(d.serializeProject(p));
    })()`, 'native');
    const crb = cropped.toBitmap();
    let blue = 0, total = 0, redSeen = 0;
    for (let y = 452; y < 498; y++) for (let x = 440; x < 600; x++) {
      const i = (y * MW + x) * 4;
      const isBlue = crb[i] > 240 && crb[i + 1] < 15 && crb[i + 2] < 15;
      const isRed = crb[i + 2] > 240 && crb[i + 1] < 15 && crb[i] < 15;
      if (isRed) redSeen++;
      if (x >= 522 && x < 568) { total++; if (isBlue) blue++; }
      else if (x < 518 || x > 572) { if (isBlue) blue = -1e9; }
    }
    check('cropped image shows only the kept part, in place', blue === total && redSeen === 0, `${blue}/${total} blue, ${redSeen} red px`);

    // 8. Base pattern: solid green on every view, multiplied onto the master.
    //    Off-garment pixels unchanged; on fabric, G keeps the master's shading
    //    (folds stay visible) while R and B drop to ~0.
    const patProject = (mode) => `(async () => {
      const d = window.mdshirtDebug;
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#00ff00'; g.fillRect(0, 0, 64, 64);
      const a = { id: 'green1', name: 'g.png', mime: 'image/png', sha256: 'x', width: 64, height: 64, data: c.toDataURL('image/png').split(',')[1] };
      const v = { assetId: 'green1', mode: '${mode}', scale: 12, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 };
      const p = { ...d.newProject('pattern'), assets: { green1: a }, pattern: { views: { rs: v, front: v, back: v, ls: v } } };
      return d.parseProject(d.serializeProject(p));
    })()`;
    for (const mode of ['single', 'tile']) {
      const pat = (await exportPng(patProject(mode), 'native')).toBitmap();
      let off = 0, bad = 0, n = 0;
      for (let i = 0; i < MW * MH; i++) {
        const a = mk[i * 4 + 3];
        if (a === 0) { if (pat[i * 4] !== mBmp[i * 4] || pat[i * 4 + 1] !== mBmp[i * 4 + 1] || pat[i * 4 + 2] !== mBmp[i * 4 + 2]) off++; }
        else if (a === 255) { n++; if (pat[i * 4 + 2] > 3 || pat[i * 4] > 3 || Math.abs(pat[i * 4 + 1] - mBmp[i * 4 + 1]) > 2) bad++; }
      }
      check(`base pattern (${mode}) only on fabric, shading preserved`, off === 0 && bad === 0 && n > 100000, `${off} off-garment px changed, ${bad}/${n} fabric px wrong`);
    }

    if (process.env.SMOKE_OUT) {
      fs.writeFileSync(path.join(process.env.SMOKE_OUT, 'smoke-pattern.png'), (await exportPng(patProject('single'), 'native')).toPNG());
      fs.writeFileSync(path.join(process.env.SMOKE_OUT, 'smoke-cover.png'), cover.toPNG());
      fs.mkdirSync(process.env.SMOKE_OUT, { recursive: true });
      fs.writeFileSync(path.join(process.env.SMOKE_OUT, 'smoke-1080p.png'), hd.toPNG());
      fs.writeFileSync(path.join(process.env.SMOKE_OUT, 'smoke-logo.png'), logo.toPNG());
    }
    check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('smoke run', false, e.stack || String(e));
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  app.exit(failed ? 1 : 0);
});
