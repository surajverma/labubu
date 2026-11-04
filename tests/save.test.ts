import { describe, expect, it } from 'vitest';
import { migrate, SaveTooNewError } from '../src/save/migrations';
import { newSave, SAVE_VERSION } from '../src/save/schema';
import { parseSaveFile, serializeSave } from '../src/save/exportImport';

describe('save migrations', () => {
  it('keeps a current save intact', () => {
    const s = newSave(123);
    s.boxes = 4;
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('upgrades an unversioned save and fills defaults', () => {
    const m = migrate({ boxes: 3, collection: [{ uid: 'a', seed: 'ABCD-EFGH', v: 1, foundAt: 1, favourite: false, count: 1, source: 'box' }] });
    expect(m.saveVersion).toBe(SAVE_VERSION);
    expect(m.boxes).toBe(3);
    expect(m.collection.length).toBe(1);
    expect(m.settings.sound).toBe(true);
  });
  it('fills new settings keys on old saves', () => {
    const s = newSave() as unknown as Record<string, unknown>;
    s.settings = { sound: false };
    const m = migrate(s);
    expect(m.settings.sound).toBe(false);
    expect(m.settings.haptics).toBe(true);
  });
  it('migrates a real v1 save to v2 without losing anything', () => {
    const v1 = {
      saveVersion: 1,
      createdAt: 1700000000000,
      boxes: 2,
      collection: [{ uid: 'x1', seed: 'K7Q2-MX9A', v: 1, foundAt: 1700000001000, favourite: true, count: 3, source: 'box', series: 1, index: 12 }],
      homeUid: 'x1',
      settings: { sound: false, music: true, haptics: true, notifications: true, notifyHour: 18, quality: 'auto', spinMode: 'face', reducedMotion: false },
      stats: { boxesOpened: 9, spins: 40, secretsFound: 0 },
      badges: ['cozy-club'],
      dev: false,
      seen: [],
    };
    const m = migrate(v1);
    expect(m.saveVersion).toBe(2);
    expect(m.collection[0]).toEqual(v1.collection[0]);
    expect(m.badges).toEqual(['cozy-club']);
    expect(m.stats.boxesOpened).toBe(9);
    expect(m.stats.recycled).toBe(0);
    expect(m.coins).toBe(0);
    expect(m.daily.streak).toBe(0);
    expect(m.settings.sound).toBe(false);
  });
  it('refuses saves from a newer app', () => {
    expect(() => migrate({ saveVersion: SAVE_VERSION + 1 })).toThrow(SaveTooNewError);
  });
});

describe('export / import', () => {
  it('round-trips', () => {
    const s = newSave(5);
    s.boxes = 7;
    expect(parseSaveFile(serializeSave(s))).toEqual(s);
  });
  it('rejects tampered or foreign files', () => {
    const t = JSON.parse(serializeSave(newSave()));
    t.save.boxes = 9999;
    expect(() => parseSaveFile(JSON.stringify(t))).toThrow(/damaged/);
    expect(() => parseSaveFile('{"hello":1}')).toThrow();
    expect(() => parseSaveFile('not json')).toThrow();
  });
});
