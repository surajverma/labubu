import { displayName, specFor } from '../../game/game';
import { partName } from '../../gen/parts';
import { voiceFor } from '../../gen/voice';
import { VOICES } from '../../audio/voice';
import { SEASONS } from '../../game/seasons';
import { sfx } from '../../audio/sfx';
import { haptic } from '../../platform';
import type { OwnedCharacter } from '../../save/schema';
import type { App, Screen } from '../app';
import { CharacterView } from '../charView';
import { h, icon } from '../dom';
import { rarityChip } from '../widgets';

/** Extra actions other milestones add to the detail view (share, gift, recycle…). */
export type DetailAction = (app: App, o: OwnedCharacter, refresh: () => void) => HTMLElement | null;
export const DETAIL_ACTIONS: DetailAction[] = [];

export class DetailScreen implements Screen {
  readonly id = 'detail';
  readonly tab = 'book' as const;
  readonly uses3D = true;
  readonly showTabs = false;
  readonly el: HTMLElement;
  private view: CharacterView;
  private top = h('div', { class: 'topbar' });
  private card = h('div', { class: 'card', style: 'margin:0 12px' });
  private uid = '';

  constructor(private app: App) {
    this.view = new CharacterView(app.stage);
    this.el = h(
      'div',
      { class: 'screen no-tabs' },
      this.top,
      h('div', { class: 'spacer passthrough' }),
      this.card,
    );
  }

  enter(params?: Record<string, unknown>): void {
    this.uid = String(params?.uid ?? '');
    const o = this.app.game.find(this.uid);
    if (!o) {
      this.app.back();
      return;
    }
    this.view.attach();
    this.view.show(specFor(o));
    this.app.stage.resetView();
    this.app.stage.gestures = {
      onTap: () => {
        this.view.rig?.hop(0.6);
        sfx.tap();
        haptic.tick();
      },
      onSwipe: (dir) => {
        const rig = this.view.rig;
        if (!rig || rig.isSpinning()) return;
        // Spinning in the book is just for fun: it lands back on the real face.
        void rig.spinFace(specFor(o).face, {
          direction: dir,
          fillers: [],
          onTick: () => (sfx.tick(), haptic.tick()),
          onLand: () => (sfx.land(), haptic.land()),
        });
      },
    };
    this.render(o);
    // Leave room for the info card.
    requestAnimationFrame(() => this.view.setInsets(76, this.card.offsetHeight + 30, 0.8));
  }

  leave(): void {
    this.app.stage.gestures = {};
    this.view.detach();
    this.view.resetScene();
  }

  private render(o: OwnedCharacter): void {
    const s = specFor(o);
    const refresh = () => {
      const fresh = this.app.game.find(o.uid);
      if (fresh) this.render(fresh);
      else this.app.back();
    };
    this.top.replaceChildren(
      h(
        'button',
        { class: 'iconbtn', 'aria-label': 'Back', onclick: () => this.app.back() },
        icon('back'),
      ),
      h(
        'h1',
        { style: 'font-size:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
        displayName(o),
      ),
      h(
        'button',
        {
          class: 'iconbtn',
          'aria-label': o.favourite ? 'Remove from favourites' : 'Add to favourites',
          'aria-pressed': String(o.favourite),
          style: o.favourite ? 'color:#ff4f7b' : '',
          onclick: () => {
            this.app.tap();
            o.favourite = !o.favourite;
            this.app.game.changed('favourite');
            refresh();
          },
        },
        icon('heart'),
      ),
    );
    const found = new Date(o.foundAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const extra = DETAIL_ACTIONS.map((f) => f(this.app, o, refresh)).filter(
      (x): x is HTMLElement => !!x,
    );
    this.card.replaceChildren(
      h(
        'div',
        { class: 'row', style: 'flex-wrap:wrap;margin-bottom:10px' },
        rarityChip(s.rarity),
        o.count > 1 ? h('span', { class: 'chip light' }, `×${o.count} copies`) : null,
        o.index ? h('span', { class: 'chip light' }, `#${String(o.index).padStart(4, '0')}`) : null,
        o.nickname ? h('span', { class: 'chip light' }, s.name) : null,
        o.variant && SEASONS[o.variant]
          ? h(
              'span',
              { class: 'chip light' },
              `${SEASONS[o.variant]!.icon} ${SEASONS[o.variant]!.name} edition`,
            )
          : null,
        o.variant?.startsWith('mix:') ? h('span', { class: 'chip light' }, 'Order special') : null,
      ),
      h(
        'div',
        { class: 'kv' },
        h('b', null, 'Seed'),
        h('span', null, h('span', { class: 'seed' }, s.seed)),
        h('b', null, 'Found'),
        h('span', null, found),
        h('b', null, 'Look'),
        h(
          'span',
          null,
          [partName('hat', s.hat), partName('outfit', s.outfit), partName('accessory', s.accessory)]
            .filter((x) => !/^No |^Nothing/.test(x))
            .join(' · ') || 'Simple & classic',
        ),
        h('b', null, 'Scene'),
        h('span', null, partName('scene', s.scene)),
        h('b', null, 'Voice'),
        h('span', null, VOICES.find((v) => v.id === (o.voice ?? voiceFor(s)))!.label),
      ),
      h(
        'div',
        { class: 'row', style: 'margin-top:14px;flex-wrap:wrap' },
        h(
          'button',
          { class: 'btn ghost small', onclick: () => this.rename(o, refresh) },
          icon('edit', 20),
          'Rename',
        ),
        h(
          'button',
          {
            class: 'btn ghost small',
            onclick: () => {
              this.app.tap();
              this.app.game.save.homeUid = o.uid;
              this.app.game.changed('home');
              this.app.toast(`${displayName(o)} is on Home now`);
            },
          },
          icon('home', 20),
          'Show on Home',
        ),
        ...extra,
      ),
    );
  }

  private rename(o: OwnedCharacter, refresh: () => void): void {
    this.app.tap();
    const input = h('input', {
      class: 'text',
      value: o.nickname ?? '',
      placeholder: specFor(o).name,
      maxlength: '24',
      'aria-label': 'Name',
    }) as HTMLInputElement;
    const save = () => {
      o.nickname = input.value.trim().slice(0, 24) || undefined;
      this.app.game.changed('rename');
      close();
      refresh();
    };
    const close = this.app.sheet([
      h('h3', null, 'Rename buddy'),
      input,
      h(
        'div',
        { class: 'stack', style: 'margin-top:14px' },
        h('button', { class: 'btn purple block', onclick: save }, 'Save'),
        h('button', { class: 'btn ghost block', onclick: () => close() }, 'Cancel'),
      ),
    ]);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    setTimeout(() => input.focus(), 250);
  }
}
