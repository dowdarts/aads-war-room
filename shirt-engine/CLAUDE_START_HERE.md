> **MANDATORY FIRST:** Read `D_DRIVE_STORAGE_POLICY.md` and comply before any installation, build, download or file creation.

# CLAUDE — START HERE: MD Studios Shirt Mockup Engine

## Mission
Build this existing React/TypeScript prototype into a **local desktop program** that can later be deployed as an **online, mobile-friendly application** accessible from anywhere. Keep **one shared rendering engine and project format** across desktop and web/mobile. The owner wants to work collaboratively with Claude through implementation and testing.

## What is already in this ZIP
- React + TypeScript + Vite + React Konva prototype in `src/main.tsx`.
- `public/master-stencil.png`: the approved four-view blank polo master, **do not replace, reimagine, regenerate or alter**.
- Existing optional zone list, image/text upload, placement, browser save/load, project JSON export, PNG export.
- The prototype is NOT a finished production renderer. Read `README.md` and `docs/PRODUCT_SPEC.md` for known limitations.

## Immutable design requirements
- Preserve the exact approved master image's pixels, original proportions, garment locations and gray background. Four views from left to right: **WEARER'S RIGHT SLEEVE | FRONT | BACK | WEARER'S LEFT SLEEVE**. Front/back remain separated.
- Presentation/output should be **16:9**. The source master is **1672×941**, approximately but not mathematically exactly 16:9. Do NOT stretch/crop the source to force 16:9. Instead, if strict 16:9 output is required, add minimal neutral padding to a 16:9 canvas, preserving original master pixels at 1:1 aspect ratio and all coordinates through an explicit transform. Obtain user approval for any changed framing.
- The stencil is a locked background; artwork is editable and never baked into the master.
- Left/right always refer to the wearer, not the viewer. Front image-right is wearer's left chest.
- Each physical placement is optional and content-agnostic: empty, player name, surname, team name, team logo, sponsor, other artwork. Naming IDs denote *use*, not exclusive physical coordinates.
- `N01` personal name and `TN01` team name share the FRONT wearer's left chest position. `N02` player surname and `TN02` team name share upper BACK name position below collar.
- `RS01`/`LS01` upper sleeve zones for vertically stacked logos; `RS02`/`LS02` lower near-cuff zones for compact horizontal logos. Lower front/back hem marks are small and near the bottom seam.
- Preserve logo artwork precisely, including trademarks, brand colors, lettering and aspect ratio. Do not recreate logos with AI.

## Target platform approach
1. Keep **React + TypeScript + Konva** for a single reusable editor/rendering codebase.
2. Make a desktop application with **Electron** (selected for Windows + VS Code; preliminary shell included). Local project files and original assets should be portable and available offline.
3. Make the same React editor responsive for phone/tablet browser use and installable as a **PWA**; this is the fastest path to a phone-app-like experience. A native iOS/Android wrapper (e.g. Capacitor) is optional later.
4. Add **Supabase** (Auth + Postgres + Storage) for private cloud sync and multi-device project access. Do not embed privileged service-role keys in the client. Enforce row-level security and asset permissions. Desktop can work offline and sync later.
5. Host web frontend on a suitable static/edge hosting provider with HTTPS and a custom domain later. Deployment and account setup require the owner's approval.

## Suggested build sequence
**Phase 0: Inspect and run.** Verify `npm install`, `npm run build`, `npm run dev`. Record existing defects; do not claim untested functions work.
**Phase 1: Reliable core editor.** Separate modules/components; define canonical physical zone IDs and optional semantic aliases; accurate coordinate mapping; locked stencil; preserve image aspect ratio during transforms; multi-layer selection; undo/redo; project JSON import/export; high-res exports with overlays hidden; tests.
**Phase 2: Base shirt pattern workflow.** Upload a design/pattern and map it to front/back/sleeve garment masks without affecting background or garment silhouette. Start with explicit 2D calibrated masks and overlay; add shading/displacement only after correctness checks. The uploaded reference photograph does not provide manufacturing measurements.
**Phase 3: Desktop.** Package Electron app for Windows 10/11; user uses VS Code. Local project library, open/save `.mdshirt` or JSON with referenced/embedded assets, offline mode.
**Phase 4: Online/mobile.** Responsive touch gestures, PWA, Supabase Auth/storage, cloud project sync, export and access from anywhere. Test on phone/tablet and desktop. Consider Capacitor only if native app-store distribution is wanted.

## Acceptance criteria
- Reload the approved master and compare visually/pixelwise: unchanged and same layout.
- Assign a logo to RS01, move/scale it, save project, reload, and export; coordinates, orientation, text and brand artwork remain intact.
- Switch to LS02 and upload a horizontal logo; it remains compact just above cuff seam.
- N01 and TN01 are the same physical coordinates, with different content meanings; likewise N02/TN02.
- Empty zones stay empty; no auto-filled sponsors or logos.
- Export a clean 16:9 composite without selection handles, guides, or labels added by the editor (original master labels are part of the approved image).
- Desktop and hosted web reopen the same portable project with consistent output.
- Phone editing supports tap, pinch, drag and reasonable zoom without inadvertent page zoom.
- No claim of manufacturer-exact dimensions without actual measurement/cut templates.

## Claude's first response to the owner
Summarize the current prototype and propose the Phase 0/1 implementation steps. The owner uses Windows with VS Code. Start with local/offline desktop, then web/PWA and cloud sync. Do not redesign the locked stencil.
