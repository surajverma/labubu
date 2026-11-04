import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { APP } from '../config';
import { hashString } from '../rng';
import { isNative } from '../platform';
import { migrate } from './migrations';
import type { SaveData } from './schema';

interface ExportFile {
  app: string;
  kind: 'save';
  exportedAt: string;
  checksum: string;
  save: SaveData;
}

function checksum(json: string): string {
  return hashString(json).map((n) => n.toString(16).padStart(8, '0')).join('');
}

export function serializeSave(save: SaveData): string {
  const json = JSON.stringify(save);
  const file: ExportFile = { app: APP.name, kind: 'save', exportedAt: new Date().toISOString(), checksum: checksum(json), save };
  return JSON.stringify(file, null, 1);
}

/** Parses and validates an exported save. Throws a friendly error message on problems. */
export function parseSaveFile(text: string): SaveData {
  let file: ExportFile;
  try {
    file = JSON.parse(text) as ExportFile;
  } catch {
    throw new Error('That file isn’t a SpinBuddies save.');
  }
  if (!file || file.kind !== 'save' || !file.save) throw new Error('That file isn’t a SpinBuddies save.');
  if (checksum(JSON.stringify(file.save)) !== file.checksum) throw new Error('The save file looks damaged or was edited.');
  return migrate(file.save);
}

export async function exportSave(save: SaveData): Promise<'shared' | 'downloaded'> {
  const text = serializeSave(save);
  const name = `spinbuddies-save-${new Date().toISOString().slice(0, 10)}.json`;
  if (isNative) {
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: `${APP.name} save`, text: 'My SpinBuddies save file — keep it safe!', files: [res.uri], dialogTitle: 'Save or send your backup' });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

/** Opens a file picker and returns the parsed save (or null if cancelled). */
export function pickSaveFile(): Promise<SaveData | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try {
        resolve(parseSaveFile(await f.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
