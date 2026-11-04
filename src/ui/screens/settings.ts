import { APP, TUNABLES } from '../../config';
import { exportSave, pickSaveFile } from '../../save/exportImport';
import { clearSave } from '../../save/storage';
import { newSave, type Settings } from '../../save/schema';
import { idbClear } from '../idb';
import type { App, Screen } from '../app';
import { h, icon } from '../dom';
import { toggle } from '../widgets';
import { oddsContent } from './box';

/** Extra rows other milestones add (notifications, profile…). */
export type SettingsSection = (app: App, rerender: () => void) => HTMLElement | null;
export const SETTINGS_SECTIONS: SettingsSection[] = [];
export const DEV_ACTIONS: { label: string; run: (app: App) => void }[] = [];

export class SettingsScreen implements Screen {
  readonly id = 'settings';
  readonly tab = 'more' as const;
  readonly uses3D = false;
  readonly showTabs = true;
  readonly el: HTMLElement;
  private body = h('div', { class: 'scroll' });
  private versionTaps = 0;

  constructor(private app: App) {
    this.el = h(
      'div',
      { class: 'screen solid' },
      h('div', { class: 'topbar' }, h('h1', null, 'Settings')),
      this.body,
    );
  }

  enter(): void {
    this.versionTaps = 0;
    this.render();
  }
  leave(): void {}

  private set<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.app.game.save.settings[k] = v;
    this.app.applySettings();
    this.app.game.changed('settings');
    this.render();
  }

  private switchRow(
    label: string,
    k: 'sound' | 'music' | 'haptics' | 'reducedMotion',
    desc?: string,
  ): HTMLElement {
    const on = this.app.game.save.settings[k];
    return h(
      'button',
      {
        class: 'item',
        role: 'switch',
        'aria-checked': String(on),
        onclick: () => (this.app.tap(), this.set(k, !on)),
      },
      h(
        'span',
        { class: 'label' },
        label,
        desc ? h('div', { class: 'muted', style: 'font-size:13px;font-weight:500' }, desc) : null,
      ),
      toggle(on),
    );
  }

  private render(): void {
    const s = this.app.game.save.settings;
    const qLabel = {
      auto: `Auto (${s.detectedQuality ?? 'high'})`,
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    }[s.quality];
    const qualities: Settings['quality'][] = ['auto', 'low', 'medium', 'high'];
    const extra = SETTINGS_SECTIONS.map((f) => f(this.app, () => this.render())).filter(
      (x): x is HTMLElement => !!x,
    );
    this.body.replaceChildren(
      h(
        'button',
        {
          class: 'card row',
          style: 'width:100%;border:none;text-align:left;cursor:pointer;margin-top:4px',
          onclick: () => (this.app.tap(), this.app.push('profile')),
        },
        h(
          'div',
          {
            style:
              'width:44px;height:44px;border-radius:14px;background:var(--bg2);display:grid;place-items:center;color:var(--primary)',
          },
          icon('user'),
        ),
        h(
          'div',
          { style: 'flex:1' },
          h(
            'div',
            { style: 'font-family:var(--display);font-weight:700;font-size:18px' },
            'Your profile',
          ),
          h(
            'div',
            { class: 'muted', style: 'font-size:13px' },
            `${this.app.game.save.achievements.length} achievements · ${this.app.game.save.badges.length} badges`,
          ),
        ),
        icon('back', 20),
      ),
      h('h2', null, 'Sound & feel'),
      h(
        'div',
        { class: 'list' },
        this.switchRow('Sound effects', 'sound'),
        this.switchRow('Music', 'music', 'A soft background tune'),
        this.switchRow('Haptics', 'haptics', 'Little buzzes when things spin'),
      ),
      ...extra,
      h('h2', null, 'Graphics'),
      h(
        'div',
        { class: 'list' },
        h(
          'button',
          {
            class: 'item',
            onclick: () => {
              this.app.tap();
              this.set(
                'quality',
                qualities[(qualities.indexOf(s.quality) + 1) % qualities.length]!,
              );
            },
          },
          h('span', { class: 'label' }, 'Quality'),
          h('span', { class: 'val' }, qLabel),
        ),
        this.switchRow('Reduce motion', 'reducedMotion', 'Fewer flashes and bounces'),
      ),
      h('h2', null, 'Your save'),
      h(
        'div',
        { class: 'list' },
        h(
          'button',
          { class: 'item', onclick: () => this.doExport() },
          icon('share', 22),
          h(
            'span',
            { class: 'label' },
            'Export save file',
            h(
              'div',
              { class: 'muted', style: 'font-size:13px;font-weight:500' },
              'Keep a backup or move to a new phone',
            ),
          ),
        ),
        h(
          'button',
          { class: 'item', onclick: () => this.doImport() },
          icon('back', 22),
          h('span', { class: 'label' }, 'Import save file'),
        ),
        h(
          'button',
          { class: 'item', style: 'color:#d13b3b', onclick: () => this.doReset() },
          icon('close', 22),
          h('span', { class: 'label' }, 'Reset everything'),
        ),
      ),
      h('h2', null, 'About'),
      h(
        'div',
        { class: 'list' },
        h(
          'button',
          { class: 'item', onclick: () => (this.app.tap(), this.app.sheet(oddsContent())) },
          icon('dice', 22),
          h('span', { class: 'label' }, 'Box odds'),
        ),
        h(
          'button',
          { class: 'item', onclick: () => this.credits() },
          icon('star', 22),
          h('span', { class: 'label' }, 'Credits'),
        ),
        h(
          'button',
          {
            class: 'item',
            onclick: () => this.versionTap(),
            'aria-label': `Version ${APP.version}`,
          },
          h('span', { class: 'label' }, 'Version'),
          h('span', { class: 'val' }, APP.version),
        ),
      ),
      this.app.game.save.dev ? this.devMenu() : h('span'),
      h(
        'p',
        { class: 'muted', style: 'text-align:center;font-size:13px;margin-top:20px' },
        `${APP.name} has no ads, no real-money purchases and no tracking.`,
      ),
    );
  }

  private versionTap(): void {
    this.versionTaps++;
    const left = TUNABLES.devMenuTaps - this.versionTaps;
    if (this.app.game.save.dev) return;
    if (left <= 0) {
      this.app.game.save.dev = true;
      this.app.game.changed('dev');
      this.app.toast('Developer menu unlocked');
      this.render();
    } else if (left <= 3) this.app.toast(`${left} more taps…`);
  }

  private devMenu(): HTMLElement {
    return h(
      'div',
      null,
      h('h2', null, 'Developer'),
      h(
        'div',
        { class: 'list' },
        h(
          'button',
          {
            class: 'item',
            onclick: () => {
              this.app.game.save.boxes += 10;
              this.app.game.changed('dev');
              this.app.toast('+10 boxes');
            },
          },
          h('span', { class: 'label' }, '+10 boxes'),
        ),
        ...DEV_ACTIONS.map((a) =>
          h(
            'button',
            { class: 'item', onclick: () => a.run(this.app) },
            h('span', { class: 'label' }, a.label),
          ),
        ),
        h(
          'button',
          {
            class: 'item',
            onclick: () => {
              void idbClear().then(() => this.app.toast('Thumbnail cache cleared'));
            },
          },
          h('span', { class: 'label' }, 'Clear thumbnail cache'),
        ),
        h(
          'button',
          {
            class: 'item',
            onclick: () => {
              this.app.game.save.dev = false;
              this.app.game.changed('dev');
              this.render();
            },
          },
          h('span', { class: 'label' }, 'Hide developer menu'),
        ),
      ),
    );
  }

  private credits(): void {
    this.app.tap();
    this.app.sheet([
      h('h3', null, 'Credits'),
      h(
        'p',
        null,
        `${APP.name} and every buddy, scene, face and sound in it are original and made in code.`,
      ),
      h(
        'div',
        { class: 'kv' },
        h('b', null, 'Font'),
        h('span', null, 'Fredoka — SIL Open Font License 1.1'),
        h('b', null, '3D'),
        h('span', null, 'three.js (MIT)'),
        h('b', null, 'App shell'),
        h('span', null, 'Capacitor (MIT)'),
        h('b', null, 'Sounds'),
        h('span', null, 'Synthesised live with WebAudio'),
      ),
      h(
        'p',
        { class: 'muted', style: 'font-size:14px' },
        'See CREDITS.md in the source for the full list.',
      ),
    ]);
  }

  private async doExport(): Promise<void> {
    this.app.tap();
    try {
      await this.app.game.flush();
      const how = await exportSave(this.app.game.save);
      if (how === 'downloaded') this.app.toast('Save file downloaded');
    } catch (e) {
      console.warn(e);
      this.app.toast('Could not export the save');
    }
  }

  private async doImport(): Promise<void> {
    this.app.tap();
    try {
      const s = await pickSaveFile();
      if (!s) return;
      const ok = await this.app.confirm(
        'Replace your save?',
        `This file has ${s.collection.length} buddies and ${s.boxes} boxes. Your current save will be replaced.`,
        'Replace',
      );
      if (!ok) return;
      this.app.game.save = s;
      this.app.game.changed('import');
      await this.app.game.flush();
      this.app.applySettings();
      this.app.toast('Save imported!');
      this.render();
    } catch (e) {
      this.app.toast(e instanceof Error ? e.message : 'Could not read that file');
    }
  }

  private async doReset(): Promise<void> {
    this.app.tap();
    const ok = await this.app.confirm(
      'Reset everything?',
      'All your buddies, boxes and progress will be deleted. Export a save first if you might want them back.',
      'Delete everything',
      true,
    );
    if (!ok) return;
    await clearSave();
    this.app.game.save = newSave();
    this.app.game.changed('reset');
    this.app.applySettings();
    this.app.toast('Fresh start!');
    this.app.go('home');
  }
}
