import { sfx } from '../../audio/sfx';
import { generateCharacter } from '../../gen/generate';
import { LEVELS } from '../../game/levels';
import { dailyOrder, meets, newRun, reqLabel, scoreRun, SLOTS, specOfRun, spin, variantOf, type Order, type RunState } from '../../game/orders';
import type { MixSlot } from '../../gen/generate';
import { haptic } from '../../platform';
import { FaceDrum } from '../../render/faceDrum';
import { faceInkFor } from '../../render/character';
import type { CharacterSpec } from '../../gen/types';
import type { App, Screen } from '../app';
import { CharacterView } from '../charView';
import { h, icon } from '../dom';
import { starsText } from './orders';

const cryptoRng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;

/** One order challenge: lock layers, spin the rest, serve when it matches. */
export class OrderScreen implements Screen {
  readonly id = 'order';
  readonly tab = 'play' as const;
  readonly uses3D = true;
  readonly showTabs = false;
  readonly el: HTMLElement;
  private view: CharacterView;
  private card = h('div', { class: 'ordercard' });
  private slotBar = h('div', { class: 'slots', role: 'group', 'aria-label': 'Lock parts' });
  private controls = h('div', { class: 'row', style: 'justify-content:center;padding:0 16px' });
  private order!: Order;
  private run!: RunState;
  private spec!: CharacterSpec;
  private daily: string | null = null;
  private busy = false;
  private done = false;

  constructor(private app: App) {
    this.view = new CharacterView(app.stage);
    this.el = h(
      'div',
      { class: 'screen no-tabs' },
      h('div', { class: 'topbar', style: 'padding-bottom:4px' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => this.app.back() }, icon('back')), h('h1', { style: 'font-size:20px' }, 'Order')),
      this.card,
      h('div', { class: 'spacer passthrough' }),
      this.slotBar,
      this.controls,
    );
  }

  private get version(): number {
    return this.app.game.contentVersion;
  }

  enter(params?: Record<string, unknown>): void {
    this.daily = (params?.daily as string) ?? null;
    const lvl = LEVELS.find((l) => l.id === params?.level);
    this.order = this.daily ? dailyOrder(this.daily, this.version) : (lvl ?? LEVELS[0]!);
    (this.el.querySelector('.topbar h1') as HTMLElement).textContent = this.daily ? 'Daily order' : `${LEVELS.indexOf(this.order) + 1}. ${this.order.title}`;
    this.run = newRun(this.order, cryptoRng, this.version);
    this.done = false;
    this.view.attach();
    this.refreshSpec(false);
    this.app.stage.resetView();
    this.app.stage.gestures = { onTap: () => (this.view.rig?.hop(0.5), sfx.tap()) };
    requestAnimationFrame(() => this.view.setInsets(this.card.getBoundingClientRect().bottom + 6, window.innerHeight - this.slotBar.getBoundingClientRect().top + 8, 0.8));
    if (!this.app.game.save.orders.tutorialDone) setTimeout(() => this.tutorial(), 400);
  }

  leave(): void {
    this.app.stage.gestures = {};
    this.view.detach();
    this.view.resetScene();
  }

  private refreshSpec(animate: boolean, oldFace?: CharacterSpec['face']): void {
    this.spec = specOfRun(this.run, this.version);
    if (animate) {
      this.view.swapWithPoof(this.spec);
      const rig = this.view.rig;
      if (rig && oldFace && !this.run.locks.includes('F')) {
        rig.setFaceInstant(oldFace);
        void rig.spinFace(this.spec.face, { direction: 1, fillers: [], durationMs: 900, onTick: () => sfx.tick(), onLand: () => sfx.land() });
      }
    } else this.view.show(this.spec);
    this.renderCard();
    this.renderSlots();
    this.renderControls();
  }

  private renderCard(): void {
    const cust = generateCharacter(this.order.customerSeed, 1);
    const avatar = FaceDrum.faceImage(cust.face, faceInkFor(cust), 96);
    avatar.className = 'avatar';
    avatar.style.background = cust.palette.skin;
    const res = scoreRun(this.spec, this.order, this.run.spinsLeft);
    this.card.replaceChildren(
      h('div', { class: 'row', style: 'gap:10px;margin-bottom:8px' }, avatar, h('div', { style: 'flex:1' }, h('div', { class: 'who' }, `${cust.name} would like…`), h('div', { class: 'muted', style: 'font-size:13px' }, `${res.met} of ${res.total} done`))),
      h(
        'ul',
        { class: 'reqs' },
        ...this.order.reqs.map((r) => {
          const ok = meets(this.spec, r);
          return h('li', { class: ok ? 'ok' : '' }, h('span', { class: 'tick', 'aria-hidden': 'true' }, ok ? '✓' : '○'), reqLabel(r), h('span', { class: 'sr-only' }, ok ? ' (done)' : ' (not yet)'));
        }),
      ),
    );
  }

  private renderSlots(): void {
    this.slotBar.replaceChildren(
      ...SLOTS.map((s) => {
        const locked = this.run.locks.includes(s.id);
        return h(
          'button',
          { class: `slot ${locked ? 'locked' : ''}`, 'aria-pressed': String(locked), 'aria-label': `${locked ? 'Unlock' : 'Lock'} ${s.label}`, onclick: () => this.toggleLock(s.id) },
          h('span', { class: 'ic', 'aria-hidden': 'true' }, s.icon),
          h('span', null, s.label),
          locked ? h('span', { class: 'lk' }, icon('lock', 14)) : null,
        );
      }),
    );
  }

  private renderControls(): void {
    const left = this.run.spinsLeft;
    this.controls.replaceChildren(
      h('div', { class: 'spins', 'aria-label': `${left} spins left` }, h('b', null, String(left)), h('span', null, 'spins')),
      h('button', { class: 'btn', disabled: left <= 0 || this.done, style: 'flex:1', onclick: () => this.doSpin() }, icon('spin'), 'Spin'),
      h('button', { class: 'btn purple', disabled: this.done, onclick: () => this.serve() }, 'Serve'),
    );
  }

  private toggleLock(id: MixSlot): void {
    if (this.done) return;
    this.app.tap();
    const l = this.run.locks;
    this.run = { ...this.run, locks: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] };
    this.renderSlots();
  }

  private doSpin(): void {
    if (this.busy || this.done || this.run.spinsLeft <= 0) return;
    if (this.run.locks.length >= SLOTS.length) {
      this.app.toast('Everything is locked — unlock something to spin it');
      return;
    }
    this.busy = true;
    const before = scoreRun(this.spec, this.order, 0).met;
    const oldFace = this.spec.face;
    this.run = spin(this.run, this.order, cryptoRng, this.version);
    sfx.poof();
    haptic.medium();
    this.refreshSpec(true, oldFace);
    const after = scoreRun(this.spec, this.order, 0).met;
    if (after > before) setTimeout(() => (sfx.coin(), haptic.success()), 500);
    setTimeout(() => (this.busy = false), 450);
    if (after === this.order.reqs.length) setTimeout(() => this.app.toast('Perfect match! Tap Serve'), 700);
  }

  private serve(): void {
    if (this.done) return;
    this.done = true;
    this.app.tap();
    const g = this.app.game;
    const res = scoreRun(this.spec, this.order, this.run.spinsLeft);
    g.save.stats.ordersPlayed++;
    if (res.stars === 3) g.save.stats.ordersThreeStar++;
    let coins = 0;
    if (this.daily) {
      const prev = g.save.orders.daily[this.daily];
      if (!prev) {
        coins = res.coins;
        g.save.stats.dailyOrdersPlayed++;
      }
      if (!prev || res.score > prev.score) g.save.orders.daily[this.daily] = { stars: res.stars, score: res.score };
    } else {
      const prev = g.save.orders.best[this.order.id] ?? 0;
      // Full coins for new stars, half for replays.
      coins = res.stars > prev ? res.coins : Math.floor(res.coins / 2);
      if (res.stars > prev) g.save.orders.best[this.order.id] = res.stars;
    }
    g.addCoins(coins, 'order');
    g.changed('order');
    this.renderControls();
    sfx.fanfare(res.stars === 3 ? 'legendary' : res.stars === 2 ? 'rare' : 'common');
    if (res.stars) haptic.success();
    this.view.rig?.hop(1);
    const idx = LEVELS.indexOf(this.order);
    const next = !this.daily && idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1]! : null;
    let kept = false;
    const keepBtn =
      res.stars === 3
        ? h(
            'button',
            {
              class: 'btn block',
              onclick: (e: Event) => {
                if (kept) return;
                kept = true;
                const { owned } = g.addCharacter({ seed: this.run.base, v: this.version, variant: variantOf(this.run) }, 'order');
                g.changed('order');
                (e.currentTarget as HTMLButtonElement).disabled = true;
                (e.currentTarget as HTMLButtonElement).textContent = 'Added to your book!';
                sfx.coin();
                void owned;
              },
            },
            icon('heart'),
            'Keep this buddy',
          )
        : null;
    this.app.sheet([
      h('div', { class: 'result' }, h('div', { class: 'stars', 'aria-label': `${res.stars} stars` }, starsText(res.stars)), h('h3', null, res.stars === 3 ? 'Perfect order!' : res.stars ? 'Order served!' : 'Not quite…')),
      h('div', { class: 'kv', style: 'justify-content:center;margin-bottom:14px' }, h('b', null, 'Matched'), h('span', null, `${res.met} / ${res.total}`), h('b', null, 'Score'), h('span', null, String(res.score)), h('b', null, 'Coins'), h('span', null, `+${coins}`)),
      h(
        'div',
        { class: 'stack' },
        keepBtn,
        next && res.stars > 0 ? h('button', { class: 'btn purple block', onclick: () => (this.app.closeModal(), this.app.back(), this.app.push('order', { level: next.id })) }, `Next: ${next.title}`) : null,
        h('button', { class: 'btn ghost block', onclick: () => (this.app.closeModal(), this.enter(this.daily ? { daily: this.daily } : { level: this.order.id })) }, 'Try again'),
        h('button', { class: 'btn ghost block', onclick: () => (this.app.closeModal(), this.app.back()) }, 'Back to orders'),
      ),
    ]);
  }

  private tutorial(): void {
    const steps = [
      ['📝 The order', 'A customer wants a buddy with these things. Each ✓ means it’s done.'],
      ['🔒 Lock what’s right', 'Tap a part (Face, Hat, Scene…) to lock it. Locked parts don’t change.'],
      ['🎰 Spin the rest', 'Spin changes everything that isn’t locked. You have a few spins — use them well!'],
      ['🍽️ Serve', 'Serve when you’re happy. Match everything for 3 stars — and you can keep the buddy!'],
    ];
    let i = 0;
    const finish = () => {
      this.app.game.save.orders.tutorialDone = true;
      this.app.game.changed('tutorial');
    };
    const show = () => {
      const [t, d] = steps[i]!;
      const close = this.app.sheet(
        [
          h('div', { class: 'muted', style: 'font-size:13px;font-weight:700' }, `How to play · ${i + 1}/${steps.length}`),
          h('h3', null, t!),
          h('p', null, d!),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn ghost small', onclick: () => (finish(), close()) }, 'Skip'),
            h('div', { class: 'spacer' }),
            h(
              'button',
              {
                class: 'btn small purple',
                onclick: () => {
                  close();
                  i++;
                  if (i < steps.length) show();
                  else finish();
                },
              },
              i < steps.length - 1 ? 'Next' : 'Let’s go!',
            ),
          ),
        ],
        finish,
      );
    };
    show();
  }
}
