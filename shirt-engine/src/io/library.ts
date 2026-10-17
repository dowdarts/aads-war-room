// Local project library in IndexedDB (no localStorage quota problems).
// Every open project autosaves here, so a crash or closed tab loses nothing.

export interface LibraryEntry {
  id: string;
  name: string;
  updatedAt: string;
  layerCount: number;
  /** Serialized project (.mdshirt JSON). */
  json: string;
}

const DB = 'mdshirt';
const STORE = 'projects';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export const library = {
  put: (e: LibraryEntry) => tx('readwrite', s => s.put(e)).then(() => undefined),
  get: (id: string) => tx<LibraryEntry | undefined>('readonly', s => s.get(id)),
  remove: (id: string) => tx('readwrite', s => s.delete(id)).then(() => undefined),
  async list(): Promise<Omit<LibraryEntry, 'json'>[]> {
    const all = await tx<LibraryEntry[]>('readonly', s => s.getAll());
    return all.map(({ json: _j, ...meta }) => meta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
