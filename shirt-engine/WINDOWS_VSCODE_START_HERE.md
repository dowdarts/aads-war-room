# MD Studios Shirt Engine — Windows + VS Code + Claude

## Purpose
Build an **offline-first Windows desktop program** in VS Code, sharing the React/TypeScript/Konva editor with a future responsive web/PWA app and optional mobile wrapper. **Electron** is the selected desktop shell. The existing editor is a prototype, not a verified installer or production-ready pattern renderer.

## Mandatory storage policy
**FIRST read `D_DRIVE_STORAGE_POLICY.md` before running any install or build commands.** The user requires all MD Studios development assets, dependencies, downloads, VS Code extension/user data, caches, temp files, project databases, exports, and program installation to use the D: drive wherever supported. Show paths and request approval for unavoidable C: writes.

## Windows prerequisites
- Windows 10/11, VS Code, Node.js LTS (with npm), Git (recommended).
- Open the extracted project folder in VS Code; use **Terminal > New Terminal** (PowerShell).

## First run
```powershell
## Only after configuring and verifying D: cache/TEMP paths per D_DRIVE_STORAGE_POLICY.md
npm install
npm run dev
```
Open the localhost URL displayed by Vite. To run the Electron window instead, stop the dev server and run:
```powershell
npm run desktop:dev
```
To build the frontend:
```powershell
npm run build
```
To attempt a Windows installer:
```powershell
npm run desktop:build
```
Installer output, if successful, is in `release/`. The Windows installer is **not prebuilt or tested**. Unsigned installers may trigger Windows SmartScreen warnings. Do not bypass security warnings without checking the build/source.

## Required initial Claude tasks
1. Read `CLAUDE_START_HERE.md`, `docs/PRODUCT_SPEC.md`, `src/main.tsx` and this file.
2. Run install/build on Windows; resolve TypeScript, Vite, Electron and asset-path issues. In particular verify `public/master-stencil.png` loads in packaged `file://` mode: root-absolute asset URLs must be made relative to Vite base, or use `import.meta.env.BASE_URL`.
3. Keep approved stencil pixels unchanged. Ensure output is strict 16:9 through neutral padding if required, not stretching.
4. Implement portable project format including images (not just localStorage blob URLs), local open/save with safe filesystem access, versioning and backup.
5. Add masks/pattern mapping and calibrated physical placement zones, undo/redo, transparent export and tests.
6. Only after desktop acceptance, deploy same editor as mobile-friendly PWA; then add Supabase auth, private storage and offline/cloud sync.

## Architecture constraints
- Reuse `src/` rendering/editor logic across desktop and hosted web.
- Desktop filesystem operations must go through a secure preload/IPC bridge if needed; never enable Node integration in renderer.
- Keep authentication and cloud sync optional so desktop works offline.
- Do not publish the app or commit credentials without permission.
- Preserve wearer's perspective for left/right and the N01/TN01, N02/TN02, RS01/02, LS01/02 rules.

## Copy this prompt into Claude
> I am developing on Windows in VS Code. This ZIP contains the MD Studios Shirt Mockup Engine React prototype and a preliminary Electron shell. Read WINDOWS_VSCODE_START_HERE.md and CLAUDE_START_HERE.md first. Make the app work as an offline Windows desktop editor, fix build and packaged stencil asset loading, preserve the locked master image, and verify logo placement/save/reload/export. Do not redesign the stencil. Then plan reuse as a responsive online PWA accessible on phones. Explain each step and commands I should run in VS Code.
