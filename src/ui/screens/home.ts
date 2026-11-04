import { APP } from '../../config';
import { generateCharacter, LATEST_GENERATOR_VERSION, randomFace } from '../../gen/generate';
import { MASCOT } from '../../gen/mascot';
import type { CharacterSpec } from '../../gen/types';
import { displayName, specFor } from '../../game/game';
import { sfx } from '../../audio/sfx';
import { haptic, watchShake, requestMotionPermission } from '../../platform';
import { randomSeed } from '../../rng';
import type { App, Screen } from '../app';
import { CharacterView } from '../charView';
import { h, icon } from '../dom';
import { counter, rarityChip, seg } from '../widgets';

let hintShown = false;

/** Home: the current favourite on display. Spinning here is a free toy (nothing is saved). */
export class HomeScreen implements Screen {
  readonly id = 'home';
  readonly tab = 'home' as const;
  readonly uses3D = true;
  readonly showTabs = true;
  readonly el: HTMLElement;
  private view: CharacterView;
  private spec: CharacterSpec = MASCOT;
  private baseSpec: CharacterSpec = MASCOT;
  private nameEl = h('div', { class: 'name' });
  private subEl = h('div', { class: 'sub' });
  private boxesEl = h('span');
  private resetBtn: HTMLElement;
  private stopShake: (() => void) | null = null;
  private spinCount = 0;
  private hintTimer = 0;

  constructor(private app: App) {
    this.view = new CharacterView(app.stage);
    this.resetBtn = h('button', { class: 'iconbtn', 'aria-label': 'Back to my buddy', onclick: () => this.reset() }, icon('back', 22));
    const mode = seg(
      [
        { id: 'face', label: 'Face only' },
        { id: 'everything', label: 'Everything' },
      ],
      app.game.save.settings.spinMode,
      (v) => {
        app.tap();
        app.game.save.settings.spinMode = v;
        app.game.changed('settings');
      },
    );
    this.el = h(
      'div',
      { class: 'screen' },
      h('div', { class: 'topbar' }, h('div', { class: 'logo' }, 'Spin', h('span', null, 'Buddies')), this.boxesEl),
      h('div', { class: 'nameplate' }, this.nameEl, this.subEl),
      h('div', { class: 'spacer passthrough' }),
      h(
        'div',
        { class: 'stack', style: 'align-items:center;padding:0 16px' },
        h('div', { class: 'hint' }, 'Swipe the face up or down — or shake!'),
        h('div', { class: 'row' }, this.resetBtn, mode),
        h('button', { class: 'btn', style: 'min-width:220px', onclick: () => this.spin(1), 'aria-label': 'Spin' }, icon('spin', 24), 'Spin!'),
      ),
    );
  }

  enter(): void {
    const g = this.app.game;
    const home = g.homeCharacter();
    this.baseSpec = home ? specFor(home) : MASCOT;
    this.spec = this.baseSpec;
    this.updateBoxes();
    this.view.attach();
    this.view.setInsets(150, 250);
    this.view.show(this.spec);
    this.renderName(home ? displayName(home) : `${APP.mascotName}`, home ? undefined : 'Your guide');
    this.resetBtn.style.visibility = 'hidden';
    this.app.stage.resetView();
    this.app.stage.gestures = {
      onSwipe: (dir) => this.spin(dir),
      onTap: () => {
        this.view.rig?.hop(0.6);
        sfx.tap();
        haptic.tick();
      },
    };
    void requestMotionPermission().then((ok) => {
      if (ok) this.stopShake = watchShake(() => this.spin(1));
    });
    if (!g.save.collection.length && g.save.boxes > 0) this.hintTimer = window.setTimeout(() => {
        if (this.app.currentId !== 'home' || hintShown) return;
        hintShown = true;
        this.app.toast('Tap “Boxes” to open your first blind box!');
      }, 1500);
  }

  leave(): void {
    clearTimeout(this.hintTimer);
    this.stopShake?.();
    this.stopShake = null;
    this.app.stage.gestures = {};
    this.view.detach();
    this.view.resetScene();
  }

  private updateBoxes(): void {
    const s = this.app.game.save;
    this.boxesEl.replaceChildren(h('div', { class: 'row', style: 'gap:6px' }, counter('coins', s.coins, () => this.app.go('box')), counter('boxes', s.boxes, () => this.app.go('box'))));
  }

  private renderName(name: string, note?: string): void {
    this.nameEl.textContent = name;
    this.subEl.replaceChildren();
    if (this.spec !== MASCOT) this.subEl.append(rarityChip(this.spec.rarity));
    if (note) this.subEl.append(h('span', { class: 'chip light' }, note));
  }

  private spin(direction: 1 | -1): void {
    const rig = this.view.rig;
    if (!rig || rig.isSpinning()) return;
    const g = this.app.game;
    g.save.stats.spins++;
    this.spinCount++;
    if (g.save.settings.spinMode === 'everything') {
      sfx.poof();
      haptic.land();
      const s = generateCharacter(randomSeed(), LATEST_GENERATOR_VERSION);
      this.spec = s;
      this.view.swapWithPoof(s);
      this.renderName(s.name, 'Just for fun');
      this.resetBtn.style.visibility = 'visible';
      setTimeout(() => sfx.land(), 250);
      g.changed('spin');
      return;
    }
    const key = `${this.spec.seed}:${Date.now()}:${this.spinCount}`;
    const face = randomFace(key, this.spec.generatorVersion);
    const fillers = [randomFace(key + 'a', this.spec.generatorVersion), randomFace(key + 'b', this.spec.generatorVersion)];
    void rig.spinFace(face, {
      direction,
      fillers,
      onTick: () => {
        sfx.tick();
        haptic.tick();
      },
      onLand: () => {
        sfx.land();
        haptic.land();
      },
    });
    this.resetBtn.style.visibility = 'visible';
    g.changed('spin');
  }

  private reset(): void {
    this.app.tap();
    if (this.spec !== this.baseSpec) {
      this.spec = this.baseSpec;
      this.view.swapWithPoof(this.spec);
      sfx.poof();
    } else {
      this.view.rig?.setFaceInstant(this.spec.face);
      this.view.rig?.hop(0.5);
    }
    const home = this.app.game.homeCharacter();
    this.renderName(home ? displayName(home) : APP.mascotName, home ? undefined : 'Your guide');
    this.resetBtn.style.visibility = 'hidden';
  }
}
