# MD Studios Shirt Mockup Engine — v2

React + TypeScript + Konva editor for placing logos and text on the locked four-view polo master (`public/master-stencil.png`, 1672×941). One codebase for the web app and (from M4) the Windows desktop app.

Full roadmap: M1 audit ✅ → M2 core editor ✅ → M3 pattern mapping ✅ → M4 Windows desktop → M5 phone/PWA + cloud. Phase 0 findings: [docs/AUDIT.md](docs/AUDIT.md).

## Run (PowerShell in VS Code, from `shirt-engine/`)

```powershell
npm install          # npm cache is already D:\dev-cache\npm-cache
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run build        # production build → dist/
npm run smoke        # build + headless Electron export check (pixel-compares against the master)
```

## What it does now (M2)

- **Placements:** RS01/RS02, N01/TN01, F02–F04, N02/TN02, B02–B06, LS01/LS02. Left/right are always the **wearer's**. N01 and TN01 are the same physical spot with different meanings, and so are N02 and TN02. Each layer stores its zone and its "used for" label separately.
- **Crop:** the **Crop** button (or double-click a logo) opens a crop window with Free / Original / Square / 16:9 / 4:3 shapes and exact pixel fields. Cropping is non-destructive: the original file stays in the project, the logo keeps its place and scale on the shirt, and it can be re-cropped or reset (“remove crop”) at any time.
- **Logos:** upload PNG/SVG/JPG/WebP or drag files in. The original file bytes are kept unchanged, and identical files are stored once. A new logo is auto-fitted to the zone with its aspect ratio locked.
- **Text:** font, style, colour, alignment, letter spacing. Text auto-sizes to fit the zone.
- **Editing:** move, resize, rotate (snaps at 90°), opacity, hide, lock, duplicate, layer order, re-fit to zone.
- **Undo/redo**, plus shortcuts: Ctrl+Z, Ctrl+Y, Ctrl+D, Del, arrow keys move (Shift = 10 px), **+ / −** resize, **[ / ]** rotate (Shift = 15°), Ctrl+S, Ctrl+Shift+S, Ctrl+O, Esc. **Scroll over the selected logo/text** to resize it about its centre (Shift+scroll rotates).
- **Adjust base pattern on the shirt:** *Adjust on shirt* in the pattern panel, then drag to move, scroll to zoom at the pointer, Shift+scroll to rotate; arrows / + − / [ ] / 0 (fit) on the keyboard. Clicking a view picks it; Esc finishes. Each gesture is one undo step.
- **Projects:**
  - Each project autosaves to a local library on the device (IndexedDB).
  - **Save file** writes a portable `.mdshirt` file (JSON with the images embedded).
  - **Open** reads `.mdshirt` files, and also the old prototype's project JSON.
- **Export PNG:**
  - **16:9 1920×1080** (default) or **3840×2160**. The master is scaled aspect-locked, with ~½ px neutral padding left and right. It is never stretched or cropped.
  - **Native 1672×941**: pixel-identical to the master when the project is empty.
  - **Artwork only**: transparent background.
  - Exports never include selection handles, guides or labels.
- **Base shirt pattern:** upload a full design or repeating pattern in *Base shirt pattern*. Each view (right sleeve, front, back, left sleeve) can use its own image or share one (**All views**). Modes: single design (auto-fit to cover the view) or repeat tile; size, move, rotation and opacity per view. The pattern is cut to the garment and multiplied onto the master, so folds, seams and shading show through and the background is untouched. Logos and text sit on top.
- **Garment clipping:** placements are only starting positions; designers can move artwork anywhere. Artwork is clipped to the shirt fabric (`public/garment-mask.png`, traced from the master by `scripts/build-mask.cjs`), so it never shows on the background, labels, zipper, collar inside or cuff openings, in the editor or in exports. A layer dragged off the shirt can still be selected from the layer list.
- **Calibrate zones:** tick *Calibrate zones*, drag or resize the zone boxes, then **Copy coordinates** and send them to Claude to lock in.

## Limits (honest)

- Zone rectangles were calibrated by the owner on 2026-10-17. They are mockup positions, not manufacturer dimensions.
- No manufacturer dimensions can be inferred from a photographic mockup.
- Pattern shading is a 2D multiply over the master; there is no fabric warp/displacement. The desktop installer (M4) and phone/PWA + cloud sync (M5) are not built yet.

## Storage on D:

- npm cache: `D:\dev-cache\npm-cache`.
- Electron's downloader reads `electron_config_cache`, not `ELECTRON_CACHE`. The M1 install put the Electron zip in `%LOCALAPPDATA%\electron\Cache` (C:). The repo scripts set the variable to `D:\dev-cache\electron` from M4 on.
- Source lives in `aads-war-room/shirt-engine` on C: by the owner's choice. App data, projects, exports and the installer go in `D:\MD-Studios\` (M4).

## Original brief

[CLAUDE_START_HERE.md](CLAUDE_START_HERE.md), [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [WINDOWS_VSCODE_START_HERE.md](WINDOWS_VSCODE_START_HERE.md), [D_DRIVE_STORAGE_POLICY.md](D_DRIVE_STORAGE_POLICY.md).
