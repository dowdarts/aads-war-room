# Phase 0 audit — prototype as received (2026-10-17)

Run on Windows 11, Node 24.11.0, npm 11.6.1.

## What was actually run

| Step | Result |
|---|---|
| Copy into `aads-war-room/shirt-engine/` | OK. `master-stencil.png` SHA-256 `207cde2e…d3d2c2`, identical to the ZIP |
| `npm install` | OK, 514 packages, 2 min. npm cache on `D:\dev-cache\npm-cache` |
| `npm run build` | **FAILS**: `TS2339: Property 'env' does not exist on type 'ImportMeta'` (no `vite/client` types) |
| `npm run dev` (Vite 6.4) | OK: page served, stencil served (2,900,101 bytes) |
| `npm run desktop:dev` | Not run in this audit; the Electron shell is rebuilt in M4 |
| `npm audit` (prod deps) | 0 vulnerabilities |
| `npm audit` (all) | 18 (1 critical, 13 high): all in the dev/build toolchain (`electron@33`, `electron-builder@25`, `tar`, `extract-zip`). Fixed by upgrading Electron/electron-builder in M4 |

## Stencil facts
- 1672 × 941, 8-bit RGB, no alpha, **no ICC/gamma chunks**. A 1:1 canvas draw should reproduce it pixel-exactly.
- Contains a `caBX` (C2PA content-credentials) chunk; harmless, preserved because the file is never rewritten.
- 1672/941 = 1.7768 vs 16:9 = 1.7778. The master is very slightly **narrower** than 16:9, so a strict 16:9 frame pads the **left/right** by about ½ px each side at 1920×1080. Nothing gets added top or bottom.

## Defects found by running and reading `src/main.tsx`
1. **Build broken.** Missing `vite/client` types (above).
2. **Combined zone IDs.** `'N01 / TN01'` and `'N02 / TN02'` are single strings, so there is no separate content meaning per layer.
3. **Width field distorts logos.** The "Width" number input changes `w` without `h`, which breaks the image's aspect ratio.
4. **Export uses a timer hack.** It hides the selection and guides with `setState`, then exports after `setTimeout(120)`. That's a race: on a slow machine handles or guides can end up in the PNG. Output is 1672×941 only, not 16:9.
5. **Storage.** Projects go to `localStorage` as embedded dataURLs. This hits the ~5 MB quota quickly, `load()` has no error handling for bad JSON, and there's only one save slot.
6. **No project import.** The "Project JSON" export can't be opened again.
7. **No undo/redo, layer ordering, hide/lock, duplicate, or keyboard shortcuts.**
8. **`crypto.randomUUID()` needs a secure context.** Opening the dev server from a phone over `http://<LAN-IP>` makes uploads throw, because `randomUUID` is undefined there.
9. **Stage sizing** updates only on `window.resize`, not on container changes. Width is capped at 1200 px.
10. **Text layers** derive font size from box height (`h * 0.75`), so a resize changes the size unpredictably. There are no font or colour controls.
11. **Project stores `baseSrc`.** A saved project references a URL for the master (dev-server or file path), which isn't portable. The master should be implicit.
12. **Electron shell:** no preload or IPC, so there's no filesystem access. The dev URL is hard-coded to port 5173. Electron 33 is end-of-life.
13. **D: drive:** `ELECTRON_CACHE` is **not** read by Electron's downloader (it uses `electron_config_cache`). The Electron zip went to `%LOCALAPPDATA%\electron\Cache` on C:. Fixed in later steps by setting the correct variable.
14. No tests, no PWA manifest, and no mobile touch handling (`touch-action`, pinch).

## Kept unchanged
- `public/master-stencil.png` (byte-identical, hash-tested from M2).
- The prototype's estimated zone rectangles. They're carried over as-is until the M2 calibration review.
