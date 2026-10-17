# MANDATORY: D: Drive Development and Storage Policy

**Read before any installation, download, build, extension setup, or file creation on the user's Windows computer.** The user wants everything related to MD Studios development on `D:` rather than the system `C:` drive, to the maximum extent supported by Windows and the software.

## Primary rule
- Place the repository, source, VS Code workspace, project files, assets, artwork, images, downloaded installers, extracted archives, application databases, exports, backups, logs, npm dependencies, package-manager caches, Electron downloads/build caches, and build outputs under `D:\MD-Studios\`.
- Install project-specific programs and VS Code extensions on D: **where supported**. Prefer portable versions and explicitly configured user-data/extension directories when practical.
- Do not deliberately put any of the above on C: or use default installation locations without first checking them.
- **Before running any install/build command, inspect and show the actual destination paths.** Do not run `npm install` or Electron packaging until cache/temp locations are configured.
- If a dependency, Windows feature, installer, VS Code process, or runtime inevitably writes to C:, disclose the exact limitation and request approval before proceeding. Do not claim absolute zero C: writes: Windows, registry, user profile, and system services may still write there.
- Do not move/delete existing Windows or system folders, edit global environment variables, or redirect all Windows TEMP/TMP globally without user approval. Prefer per-terminal or per-project settings to avoid breaking other programs.

## Proposed folders (create only when needed)
```
D:\MD-Studios\
  Shirt-Mockup-Engine\
  Development-Tools\
  VSCode-Extensions\
  Downloads\
  Temp\
  Cache\npm\
  Cache\electron\
  Cache\electron-builder\
  Backups\
  AppData\
  Projects\
  Exports\
```

## Suggested PowerShell setup for the current terminal (Claude must verify each path)
```powershell
New-Item -ItemType Directory -Force -Path 'D:\MD-Studios\Temp','D:\MD-Studios\Cache\npm','D:\MD-Studios\Cache\electron','D:\MD-Studios\Cache\electron-builder' | Out-Null
$env:TEMP = 'D:\MD-Studios\Temp'
$env:TMP = 'D:\MD-Studios\Temp'
$env:npm_config_cache = 'D:\MD-Studios\Cache\npm'
$env:ELECTRON_CACHE = 'D:\MD-Studios\Cache\electron'
$env:ELECTRON_BUILDER_CACHE = 'D:\MD-Studios\Cache\electron-builder'
```
These variables are scoped to the current PowerShell session and its child processes; verify tool-specific behavior before using them. `node_modules` and build directories should remain within the project on D:.

## VS Code and installers
- VS Code's portable mode or `--user-data-dir` and `--extensions-dir` can be considered to relocate user data/extensions; verify supported behavior for the installed version. Do not assume installing VS Code on D: automatically moves its extensions, settings, and caches.
- Node.js, Git, and other tools: inspect installers for custom destination options, and ask the user before installation if C: usage cannot be avoided.
- Windows installers may still create registry entries, shortcuts, or Windows-managed data on C:. Do not promise otherwise.
- Electron app: configure userData/project/export directories explicitly on D:; choose installer target D: and validate runtime file writes. Never overwrite user data.

## Mandatory acceptance checks
1. Display the resolved locations of repository, downloads, TEMP/TMP, npm cache, Electron caches, VS Code extensions/user data, application userData, project database, and export directory.
2. Confirm expected outputs and large downloads are on D:.
3. Identify any unavoidable C: writes before they happen and ask permission.
4. Document exceptions and storage settings in the README.
