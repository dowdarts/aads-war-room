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
        layers: [{ id: 'l1', kind: 'image', assetId: 'a1', zoneId: 'RS01', code: 'RS01', content: 'sponsor', x: 120, y: 400, w: 100, h: 50, rotation: 0, opacity: 1, visible: true, locked: false }] });
      return d.parseProject(d.serializeProject(await d.parseProject(json)));
    })()`;
    const logo = await exportPng(logoProject, 'native');
    const lb = logo.toBitmap();
    let outside = 0, insideRed = 0, insideTotal = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = (y * MW + x) * 4;
      const inBox = x >= 120 && x < 220 && y >= 400 && y < 450;
      if (inBox) { insideTotal++; if (lb[i + 2] > 240 && lb[i + 1] < 15 && lb[i] < 15) insideRed++; }
      else if (x < 119 || x > 220 || y < 399 || y > 450) { if (lb[i] !== mBmp[i] || lb[i + 1] !== mBmp[i + 1] || lb[i + 2] !== mBmp[i + 2]) outside++; }
    }
    check('RS01 logo renders at its saved coordinates after save→open', insideRed / insideTotal > 0.97, `${insideRed}/${insideTotal} px red`);
    check('master pixels outside the logo are untouched', outside === 0, `${outside} changed px`);

    // 4. Hidden layers never export.
    const hidden = await exportPng(logoProject.replace('visible: true', 'visible: false'), 'native');
    check('hidden layers are not exported', Buffer.compare(hidden.toBitmap(), mBmp) === 0);

    // 5. Artwork-only export is transparent outside artwork.
    const art = await exportPng(logoProject, 'artwork-native');
    const ab = art.toBitmap();
    check('artwork-only export is transparent away from artwork', ab[3] === 0 && ab[((500 * MW) + 800) * 4 + 3] === 0 && ab[((425 * MW) + 170) * 4 + 3] === 255);

    if (process.env.SMOKE_OUT) {
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
