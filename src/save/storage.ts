import { Preferences } from '@capacitor/preferences';
import { migrate } from './migrations';
import { newSave, type SaveData } from './schema';

const KEY = 'spinbuddies.save';
const BACKUP_KEY = 'spinbuddies.save.backup';

/** Capacitor Preferences on device; Preferences falls back to localStorage on the web. */
export async function loadSave(): Promise<SaveData> {
  for (const key of [KEY, BACKUP_KEY]) {
    try {
      const { value } = await Preferences.get({ key });
      if (value) return migrate(JSON.parse(value));
    } catch (e) {
      console.warn('Save load failed for', key, e);
    }
  }
  return newSave();
}

let lastWrite = '';
export async function writeSave(s: SaveData): Promise<void> {
  const json = JSON.stringify(s);
  if (json === lastWrite) return;
  // Keep the previous good save as a backup in case a write is interrupted.
  if (lastWrite) await Preferences.set({ key: BACKUP_KEY, value: lastWrite });
  await Preferences.set({ key: KEY, value: json });
  lastWrite = json;
}

export async function clearSave(): Promise<void> {
  await Preferences.remove({ key: KEY });
  await Preferences.remove({ key: BACKUP_KEY });
  lastWrite = '';
}
