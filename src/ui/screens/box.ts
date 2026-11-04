import * as THREE from 'three';
import { sfx } from '../../audio/sfx';
import { RARITY_INFO, RARITY_ODDS, rarityRank } from '../../gen/rarity';
import { RARITIES, type CharacterSpec } from '../../gen/types';
import { displayName } from '../../game/game';
import { getPool, latestSeries, type BoxKind } from '../../game/series';
import { ECONOMY } from '../../game/economy';
import { weeklyTheme } from '../../game/themes';
import { dayKey } from '../../game/time';
import { activeSeason, SEASONAL_BOX_CHANCE, SEASONS } from '../../game/seasons';
import { haptic } from '../../platform';
import { BlindBox } from '../../render/box';
import { buildCharacter, type CharacterRig } from '../../render/character';
import { beam, EffectRunner, sparkles } from '../../render/effects';
import { buildBackdrop } from '../../render/scenes';
import type { OwnedCharacter } from '../../save/schema';
import type { App, Screen } from '../app';
import { h, icon } from '../dom';
import { counter, rarityChip } from '../widgets';

type Phase = 'idle' | 'shaking' | 'popping' | 'revealed';

const cryptoRng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;

export class BoxScreen implements Screen {
  readonly id = 'box';
  readonly tab = 'box' as const;
  readonly uses3D = true;
  showTabs = true;
  readonly el: HTMLElement;
  private top = h('div', { class: 'topbar' });
  private info = h('div', { class: 'nameplate' });
  private bottom = h('div', { class: 'stack', style: 'align-items:center;padding:0 16px' });
  private skipLayer: HTMLElement;
  private box: BlindBox | null = null;
  private rig: CharacterRig | null = null;
  private effects: EffectRunner | null = null;
  private unsub: (() => void) | null = null;
  private phase: Phase = 'idle';
  private t = 0;
  private result: { owned: OwnedCharacter; isNew: boolean; spec: CharacterSpec } | null = null;
  private beamFx: ReturnType<typeof beam> | null = null;
  private kind: BoxKind = 'normal';
  private beamFade = -1;
  private opts: { tag?: string; variant?: string; paid?: boolean } = {};

  constructor(private app: App) {
    this.skipLayer = h('div', { class: 'passthrough', style: 'position:absolute;inset:0;display:none;pointer-events:auto', onclick: () => this.skip() });
    this.el = h('div', { class: 'screen' }, this.top, this.info, h('div', { class: 'spacer passthrough' }), this.bottom, this.skipLayer);
  }

  enter(params?: Record<string, unknown>): void {
    this.kind = (params?.kind as BoxKind) ?? 'normal';
    this.opts = { tag: params?.tag as string | undefined, variant: params?.variant as string | undefined, paid: Boolean(params?.paid) };
    const st = this.app.stage;
    st.setBackdrop(buildBackdrop('boxroom'));
    st.setBloom(false);
    st.resetView();
    st.gestures = { canRotate: () => this.phase === 'revealed' };
    this.effects = new EffectRunner(st.world);
    this.unsub = st.onFrame((dt, t) => this.tick(dt, t));
    this.showIdle();
    // Opened from the shop with a paid box: start right away.
    if (params?.autoOpen) setTimeout(() => this.open(), 350);
  }

  leave(): void {
    this.unsub?.();
    this.unsub = null;
    this.effects?.clear();
    this.cleanup3D();
    this.app.stage.gestures = {};
    this.app.stage.setBloom(false);
    this.skipLayer.style.display = 'none';
  }

  onBack(): boolean {
    if (this.phase === 'shaking' || this.phase === 'popping') {
      this.skip();
      return true;
    }
    return false;
  }

  private cleanup3D(): void {
    this.box?.dispose();
    this.box = null;
    this.rig?.dispose();
    this.rig = null;
    this.beamFx = null;
  }

  private renderTop(title: string): void {
    const s = this.app.game.save;
    this.top.replaceChildren(h('h1', null, title), counter('coins', s.coins, () => this.showShop()), counter('boxes', s.boxes));
  }

  private showIdle(): void {
    this.phase = 'idle';
    this.cleanup3D();
    this.effects?.clear();
    this.showTabs = true;
    this.app.updateTabs();
    const st = this.app.stage;
    this.box = new BlindBox({ color: this.kind === 'premium' ? '#8a6bff' : this.kind === 'themed' ? '#3fb6a8' : '#ff8a6b', label: this.kind === 'premium' ? 'PREMIUM' : undefined });
    st.world.add(this.box.group);
    st.setShadow(true, 0.9);
    st.frameInsets(1.5, 2.6, 0.62, 150, 250, 0.75);
    const g = this.app.game;
    const pool = getPool(latestSeries().id);
    const found = new Set(g.save.collection.filter((c) => c.series === pool.series.id).map((c) => c.index)).size;
    this.renderTop('Blind Boxes');
    this.info.replaceChildren(
      h('div', { class: 'name', style: 'font-size:22px' }, pool.series.name),
      h('div', { class: 'sub' }, h('span', { class: 'chip light' }, `${found} / ${pool.series.size} found`)),
    );
    const season = activeSeason(dayKey(Date.now()));
    if (season) this.info.append(h('div', { class: 'hint', style: 'margin-top:8px' }, `${season.icon} ${season.name} special: some boxes come in festive colours!`));
    const n = g.save.boxes;
    const special = this.kind !== 'normal';
    const prem = g.save.premiumBoxes;
    this.bottom.replaceChildren(
      special
        ? h('button', { class: 'btn', style: 'min-width:240px', onclick: () => this.open() }, icon('gift', 24), 'Open it!')
        : n > 0
          ? h('button', { class: 'btn', style: 'min-width:240px', onclick: () => this.open() }, icon('gift', 24), `Open a box (${n})`)
          : h('div', { class: 'hint' }, 'No boxes left — get more in the shop or come back tomorrow!'),
      h(
        'div',
        { class: 'row' },
        !special && prem > 0 ? h('button', { class: 'btn purple small', onclick: () => this.startKind('premium', {}) }, `Premium (${prem})`) : null,
        h('button', { class: 'btn ghost small', onclick: () => this.showShop() }, icon('shop', 20), 'Shop'),
        h('button', { class: 'btn ghost small', onclick: () => this.showOdds() }, 'Odds'),
      ),
    );
  }

  /** Switch the waiting box to another kind (premium from the pile, or a paid box). */
  private startKind(kind: BoxKind, opts: { tag?: string; paid?: boolean }): void {
    this.app.tap();
    this.kind = kind;
    this.opts = { ...opts };
    this.showIdle();
  }

  private showShop(): void {
    this.app.tap();
    const g = this.app.game;
    const theme = weeklyTheme(dayKey(Date.now()));
    const item = (title: string, desc: string, price: number, color: string, onBuy: () => void) =>
      h(
        'div',
        { class: 'card row', style: 'margin-bottom:10px' },
        h('div', { style: `width:52px;height:52px;border-radius:16px;background:${color};display:grid;place-items:center;color:#fff;flex:none` }, icon('gift', 28)),
        h('div', { style: 'flex:1' }, h('div', { style: 'font-family:var(--display);font-weight:700;font-size:18px' }, title), h('div', { class: 'muted', style: 'font-size:13px' }, desc)),
        h('button', { class: 'btn small', disabled: g.save.coins < price, onclick: onBuy, 'aria-label': `Buy ${title} for ${price} coins` }, icon('coin', 18), String(price)),
      );
    const close = this.app.sheet([
      h('h3', null, 'Box shop'),
      h('p', { class: 'muted', style: 'margin-top:-6px' }, `You have ${g.save.coins} coins. Coins are earned by playing — never bought.`),
      item('Blind box', 'One random buddy. Goes to your box pile.', ECONOMY.shop.box, '#ff8a6b', () => {
        if (!g.buy('normal')) return;
        sfx.coin();
        close();
        this.app.toast('+1 box');
        this.showIdle();
      }),
      item(`${theme.icon} ${theme.name} box`, `Always contains a buddy with ${theme.tag} things.`, ECONOMY.shop.themed, '#3fb6a8', () => {
        if (!g.buy('themed')) return;
        sfx.coin();
        close();
        this.kind = 'themed';
        this.opts = { tag: theme.tag, paid: true };
        this.showIdle();
        setTimeout(() => this.open(), 300);
      }),
      item('Premium box', 'No Commons — Rare or better!', ECONOMY.shop.premium, '#8a6bff', () => {
        if (!g.buy('premium')) return;
        sfx.coin();
        close();
        this.kind = 'premium';
        this.opts = { paid: true };
        this.showIdle();
        setTimeout(() => this.open(), 300);
      }),
    ]);
  }

  private open(): void {
    if (this.phase !== 'idle' || !this.box) return;
    const g = this.app.game;
    if (this.kind === 'normal' && g.save.boxes <= 0) return;
    const season = activeSeason(dayKey(Date.now()));
    const variant = season && cryptoRng() < SEASONAL_BOX_CHANCE ? season.id : undefined;
    const r = g.openBox(this.kind, cryptoRng, { ...this.opts, variant });
    if (!r) return;
    this.kind = 'normal';
    this.opts = {};
    this.result = r;
    this.phase = 'shaking';
    this.t = 0;
    this.box.shake();
    this.showTabs = false;
    this.app.updateTabs();
    this.renderTop('Opening…');
    this.info.replaceChildren();
    this.bottom.replaceChildren(h('div', { class: 'hint' }, 'Tap to skip'));
    this.skipLayer.style.display = 'block';
    haptic.medium();
    // Build the character now (hidden) so the reveal has no hitch.
    this.rig = buildCharacter(r.spec, { quality: this.app.quality });
    this.rig.root.visible = false;
    this.app.stage.turntable.add(this.rig.root);
  }

  private pop(): void {
    if (!this.box || !this.result || !this.rig || !this.effects) return;
    this.phase = 'popping';
    this.t = 0;
    this.box.pop();
    sfx.pop();
    haptic.land();
    const spec = this.result.spec;
    const color = RARITY_INFO[spec.rarity].color;
    this.beamFx = this.effects.add(beam(new THREE.Vector3(0, 0.6, 0), color === 'rainbow' ? '#ffffff' : color, spec.rarity === 'secret'));
    this.rig.root.visible = true;
    this.rig.root.position.y = 0.4;
    this.rig.root.scale.setScalar(0.2);
  }

  private reveal(): void {
    if (!this.result || !this.rig || !this.effects) return;
    this.phase = 'revealed';
    this.skipLayer.style.display = 'none';
    const { spec, owned, isNew } = this.result;
    this.rig.root.position.y = 0;
    this.rig.root.scale.setScalar(1);
    this.box?.sink();
    this.beamFade = 1;
    const st = this.app.stage;
    st.setBloom(rarityRank(spec.rarity) >= 2, spec.rarity === 'secret' ? 0.4 : 0.22);
    st.frameInsets(this.rig.height, 2.0, this.rig.height * 0.5, 150, 250, 0.88);
    this.rig.hop(1);
    sfx.fanfare(spec.rarity);
    if (rarityRank(spec.rarity) >= 1) haptic.success();
    const colors = spec.rarity === 'secret' ? ['#ff6b6b', '#ffc93c', '#5fd068', '#4aa8ff', '#b56bff'] : [RARITY_INFO[spec.rarity].color, '#ffffff', spec.palette.skin];
    this.effects.add(sparkles(new THREE.Vector3(0, 0.6, 0), colors, rarityRank(spec.rarity) >= 3 ? 160 : 90));
    if (rarityRank(spec.rarity) >= 3 && !this.app.game.save.settings.reducedMotion) document.body.append(Object.assign(h('div', { class: 'flash' }), {}));
    setTimeout(() => document.querySelector('.flash')?.remove(), 700);

    const g = this.app.game;
    this.renderTop(isNew ? 'New buddy!' : 'Duplicate!');
    this.info.replaceChildren(
      h(
        'div',
        { class: 'reveal' },
        h('div', { class: 'name' }, displayName(owned)),
        h(
          'div',
          { class: 'sub' },
          rarityChip(spec.rarity),
          isNew ? h('span', { class: 'new' }, 'NEW!') : h('span', { class: 'new dup' }, `×${owned.count}`),
          owned.index ? h('span', { class: 'chip light' }, `#${String(owned.index).padStart(4, '0')}`) : null,
          owned.variant && SEASONS[owned.variant] ? h('span', { class: 'chip light' }, `${SEASONS[owned.variant]!.icon} ${SEASONS[owned.variant]!.name} edition`) : null,
        ),
      ),
    );
    this.bottom.replaceChildren(
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn ghost small', onclick: () => this.setHome(owned) }, icon('home', 20), 'Show on Home'),
        h('button', { class: 'btn ghost small', onclick: () => this.app.push('detail', { uid: owned.uid }) }, icon('book', 20), 'Details'),
      ),
      g.save.boxes > 0
        ? h('button', { class: 'btn', style: 'min-width:240px', onclick: () => (this.app.tap(), this.showIdle(), this.open()) }, icon('gift', 24), `Open another (${g.save.boxes})`)
        : h('button', { class: 'btn purple', style: 'min-width:240px', onclick: () => this.app.go('collection') }, icon('book', 24), 'See my collection'),
    );
    this.showTabs = true;
    this.app.updateTabs();
  }

  private setHome(o: OwnedCharacter): void {
    this.app.tap();
    this.app.game.save.homeUid = o.uid;
    this.app.game.changed('home');
    this.app.toast(`${displayName(o)} is on Home now`);
  }

  private skip(): void {
    if (this.phase === 'shaking') this.pop();
    if (this.phase === 'popping') this.reveal();
  }

  private tick(dt: number, t: number): void {
    this.box?.update(dt);
    if (this.beamFade > 0) {
      this.beamFade = Math.max(0, this.beamFade - dt * 1.2);
      this.beamFx?.setStrength(this.beamFade);
    }
    this.effects?.update(dt);
    if (this.rig) this.rig.update(dt, t);
    if (this.phase === 'shaking') {
      this.t += dt;
      if (Math.floor((this.t - dt) / 0.35) !== Math.floor(this.t / 0.35)) {
        sfx.shake();
        haptic.tick();
      }
      if (this.t >= 1.5) this.pop();
    } else if (this.phase === 'popping' && this.rig) {
      this.t += dt;
      const k = Math.min(1, this.t / 0.75);
      const e = 1 - Math.pow(1 - k, 3);
      this.rig.root.position.y = 0.4 + Math.sin(k * Math.PI) * 0.9 - 0.4 * e;
      this.rig.root.scale.setScalar(0.2 + 0.8 * e);
      this.rig.root.rotation.y = (1 - e) * Math.PI * 2;
      if (k >= 1) {
        this.rig.root.rotation.y = 0;
        this.reveal();
      }
    }
  }

  private showOdds(): void {
    this.app.tap();
    this.app.sheet(oddsContent());
  }
}

export function oddsContent(): HTMLElement[] {
  return [
    h('h3', null, 'Box odds'),
    h('p', { class: 'muted' }, 'Every blind box gives one random buddy from the current series. These are the exact chances for each rarity:'),
    h(
      'div',
      { class: 'list' },
      ...RARITIES.map((r) =>
        h('div', { class: 'item' }, rarityChip(r), h('span', { class: 'label' }), h('span', { class: 'val' }, `${(RARITY_ODDS[r] * 100).toFixed(1)}%`)),
      ),
    ),
    h('p', { class: 'muted', style: 'font-size:14px' }, 'Premium boxes never contain Commons (the other chances scale up). Themed boxes always contain a buddy with that week’s theme. Boxes are only ever bought with coins earned in the game — never with real money.'),
  ];
}
