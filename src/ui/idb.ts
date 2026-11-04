/** Minimal IndexedDB key-value store (thumbnail cache). Falls back to memory if unavailable. */
const DB = 'spinbuddies';
const STORE = 'kv';
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

const mem = new Map<string, string>();

export async function idbGet(key: string): Promise<string | undefined> {
  if (mem.has(key)) return mem.get(key);
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => {
      if (typeof r.result === 'string') mem.set(key, r.result);
      resolve(r.result as string | undefined);
    };
    r.onerror = () => resolve(undefined);
  });
}

export async function idbSet(key: string, value: string): Promise<void> {
  mem.set(key, value);
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function idbClear(): Promise<void> {
  mem.clear();
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
