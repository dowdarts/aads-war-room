// Platform file access. The web build uses browser pickers/downloads; the
// Electron build talks to the main process through the preload bridge.

export interface OpenedFile { name: string; text: string; path?: string }

export interface StorageAdapter {
  kind: 'web' | 'desktop';
  openProjectFile(): Promise<OpenedFile | null>;
  /** Returns the saved path (desktop) or null if the user cancelled. */
  saveProjectFile(text: string, suggestedName: string, path?: string): Promise<{ path?: string } | null>;
  saveExport(blob: Blob, suggestedName: string): Promise<{ path?: string } | null>;
}

export interface DesktopBridge {
  openProject(): Promise<OpenedFile | null>;
  saveProject(text: string, suggestedName: string, path?: string): Promise<{ path: string } | null>;
  saveExport(bytes: Uint8Array, suggestedName: string): Promise<{ path: string } | null>;
  listRecent(): Promise<string[]>;
  openRecent(path: string): Promise<OpenedFile | null>;
  getPaths(): Promise<Record<string, string>>;
  onOpenFile(cb: (f: OpenedFile) => void): void;
  setDirty(dirty: boolean): void;
}

declare global {
  interface Window { mdshirt?: DesktopBridge }
}

const PROJECT_TYPES = [{ description: 'MD Studios shirt project', accept: { 'application/json': ['.mdshirt', '.json'] } }];

const webStorage: StorageAdapter = {
  kind: 'web',
  openProjectFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mdshirt,.json,application/json';
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? { name: f.name, text: await f.text() } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
  async saveProjectFile(text, suggestedName) {
    return saveBlob(new Blob([text], { type: 'application/json' }), suggestedName, PROJECT_TYPES);
  },
  async saveExport(blob, suggestedName) {
    const video = blob.type.startsWith('video/');
    return saveBlob(blob, suggestedName, [video
      ? { description: 'WebM video', accept: { 'video/webm': ['.webm'] } }
      : { description: 'PNG image', accept: { 'image/png': ['.png'] } }]);
  },
};

async function saveBlob(blob: Blob, name: string, types: unknown[]): Promise<{ path?: string } | null> {
  const picker = (window as any).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return {};
    } catch (e: any) {
      if (e?.name === 'AbortError') return null;
      // Fall through to a plain download if the picker is blocked.
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return {};
}

function desktopStorage(b: DesktopBridge): StorageAdapter {
  return {
    kind: 'desktop',
    openProjectFile: () => b.openProject(),
    saveProjectFile: (text, name, path) => b.saveProject(text, name, path),
    async saveExport(blob, name) { return b.saveExport(new Uint8Array(await blob.arrayBuffer()), name); },
  };
}

export const storage: StorageAdapter = window.mdshirt ? desktopStorage(window.mdshirt) : webStorage;

export function safeFileName(s: string) {
  return s.replace(/[^a-z0-9-_ ]+/gi, '-').trim().replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'shirt';
}
