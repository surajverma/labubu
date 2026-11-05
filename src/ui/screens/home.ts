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
import { playCardReel } from '../cardReel';
import { h, icon } from '../dom';
import { counter, rarityChip, seg } from '../widgets';
import { VOICES, VoiceMimic, type MimicState, type VoiceId } from '../../audio/voice';
import { voiceFor } from '../../gen/voice';

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
  private hintEl = h(
    'div',
    { class: 'hint', 'aria-live': 'polite' },
    'Swipe the face up or down — or shake!',
  );
  private micBtn: HTMLElement;
  private voiceBar = h('div', { class: 'voices', role: 'radiogroup', 'aria-label': 'Buddy voice' });
  private mimic: VoiceMimic;
  private onHidden = () => {
    if (document.hidden) this.stopTalk();
  };

  constructor(private app: App) {
    this.view = new CharacterView(app.stage);
    this.mimic = new VoiceMimic((s) => this.onMimic(s));
    this.micBtn = h(
      'button',
      {
        class: 'iconbtn mic',
        'aria-label': 'Talk to your buddy',
        'aria-pressed': 'false',
        onclick: () => void this.toggleTalk(),
      },
      icon('mic', 22),
    );
    if (!VoiceMimic.supported()) this.micBtn.style.display = 'none';
    this.resetBtn = h(
      'button',
      { class: 'iconbtn', 'aria-label': 'Back to my buddy', onclick: () => this.reset() },
      icon('back', 22),
    );
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
      h(
        'div',
        { class: 'topbar' },
        h('div', { class: 'logo' }, 'Spin', h('span', null, 'Buddies')),
        this.boxesEl,
      ),
      h('div', { class: 'nameplate' }, this.nameEl, this.subEl),
      h('div', { class: 'spacer passthrough' }),
      h(
        'div',
        { class: 'stack', style: 'align-items:center;padding:0 16px' },
        this.voiceBar,
        this.hintEl,
        h('div', { class: 'row' }, this.resetBtn, mode, this.micBtn),
        h(
          'button',
          {
            class: 'btn',
            style: 'min-width:220px',
            onclick: () => this.spin(1),
            'aria-label': 'Spin',
          },
          icon('spin', 24),
          'Spin!',
        ),
      ),
    );
  }

  enter(): void {
    const g = this.app.game;
    const home = g.homeCharacter();
    this.baseSpec = home ? specFor(home) : MASCOT;
    this.spec = this.baseSpec;
    this.mimic.voice = this.currentVoice();
    this.updateBoxes();
    this.view.attach();
    this.view.setInsets(150, 250);
    this.view.show(this.spec);
    this.renderName(
      home ? displayName(home) : `${APP.mascotName}`,
      home ? undefined : 'Your guide',
    );
    this.resetBtn.style.visibility = 'hidden';
    this.app.stage.resetView();
    this.view.onFrame(() => this.view.rig?.setTalk(this.mimic.sample()));
    document.addEventListener('visibilitychange', this.onHidden);
    this.voiceBar.style.display = 'none';
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
    if (!g.save.collection.length && g.save.boxes > 0)
      this.hintTimer = window.setTimeout(() => {
        if (this.app.currentId !== 'home' || hintShown || this.app.hasModal) return;
        hintShown = true;
        this.app.toast('Tap “Boxes” to open your first blind box!');
      }, 1500);
  }

  leave(): void {
    clearTimeout(this.hintTimer);
    this.stopTalk();
    document.removeEventListener('visibilitychange', this.onHidden);
    this.stopShake?.();
    this.stopShake = null;
    this.app.stage.gestures = {};
    this.view.detach();
    this.view.resetScene();
  }

  private updateBoxes(): void {
    const s = this.app.game.save;
    this.boxesEl.replaceChildren(
      h(
        'div',
        { class: 'row', style: 'gap:6px' },
        h(
          'button',
          {
            class: 'iconbtn',
            style: 'width:40px;height:40px',
            'aria-label': 'Profile',
            onclick: () => (this.app.tap(), this.app.push('profile')),
          },
          icon('user', 20),
        ),
        counter('coins', s.coins, () => this.app.go('box')),
        counter('boxes', s.boxes, () => this.app.go('box')),
      ),
    );
  }

  private renderName(name: string, note?: string): void {
    this.nameEl.textContent = name;
    this.subEl.replaceChildren();
    if (this.spec !== MASCOT) this.subEl.append(rarityChip(this.spec.rarity));
    if (note) this.subEl.append(h('span', { class: 'chip light' }, note));
  }

  private spin(direction: 1 | -1): void {
    const rig = this.view.rig;
    if (!rig || this.view.busy || this.sliding) return;
    const g = this.app.game;
    g.save.stats.spins++;
    this.spinCount++;
    if (g.save.settings.spinMode === 'everything') {
      const s = generateCharacter(randomSeed(), LATEST_GENERATOR_VERSION);
      this.spec = s;
      haptic.medium();
      void this.reelTo(s, s.name, 'Just for fun', direction);
      this.resetBtn.style.visibility = 'visible';
      g.changed('spin');
      return;
    }
    const key = `${this.spec.seed}:${Date.now()}:${this.spinCount}`;
    const face = randomFace(key, this.spec.generatorVersion);
    const fillers = [
      randomFace(key + 'a', this.spec.generatorVersion),
      randomFace(key + 'b', this.spec.generatorVersion),
    ];
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

  // --- "Repeat after me" ---
  private async toggleTalk(): Promise<void> {
    this.app.tap();
    if (this.mimic.state !== 'off') return this.stopTalk();
    const g = this.app.game;
    if (!g.save.seen.includes('voice-intro')) {
      const ok = await this.app.confirm(
        'Talk to your buddy!',
        'Say something and your buddy repeats it in a silly voice. Your voice stays on this phone — it is never saved or sent anywhere. Android will ask to use the microphone.',
        'Let’s talk',
      );
      if (!ok) return;
      g.save.seen.push('voice-intro');
      g.changed('seen');
    }
    this.mimic.voice = this.currentVoice();
    try {
      await this.mimic.start();
    } catch (e) {
      console.warn('mic', e);
      this.app.toast('I need the microphone to listen — allow it in your phone’s settings.');
      return;
    }
    this.renderVoices();
    this.voiceBar.style.display = '';
  }

  private stopTalk(): void {
    if (this.mimic.state !== 'off') this.mimic.stop();
    this.view.rig?.setTalk(0);
    this.voiceBar.style.display = 'none';
  }

  /** The buddy's own voice: a saved pick for owned buddies, else its natural voice. */
  private currentVoice(): VoiceId {
    const home = this.app.game.homeCharacter();
    if (home && this.spec === this.baseSpec && home.voice) return home.voice;
    return voiceFor(this.spec);
  }

  /** Called whenever the buddy on Home changes. */
  private syncVoice(): void {
    this.mimic.voice = this.currentVoice();
    if (this.mimic.state !== 'off') this.renderVoices();
  }

  private renderVoices(): void {
    const cur = this.mimic.voice;
    const natural = voiceFor(this.spec);
    this.voiceBar.replaceChildren(
      ...VOICES.map((v) =>
        h(
          'button',
          {
            class: v.id === cur ? 'on' : '',
            role: 'radio',
            'aria-checked': String(v.id === cur),
            'aria-label': v.id === natural ? `${v.label} (its own voice)` : v.label,
            onclick: () => this.pickVoice(v.id),
          },
          h('span', { 'aria-hidden': 'true' }, v.icon),
          v.label,
          v.id === natural ? h('span', { class: 'own', 'aria-hidden': 'true' }, '★') : null,
        ),
      ),
    );
  }

  private pickVoice(id: VoiceId): void {
    this.app.tap();
    // Remember the pick for your own buddy (back to "natural" if you pick its own voice).
    const home = this.app.game.homeCharacter();
    if (home && this.spec === this.baseSpec) {
      home.voice = id === voiceFor(this.spec) ? undefined : id;
      this.app.game.changed('voice');
    }
    this.mimic.voice = id;
    this.renderVoices();
    // Hear the last thing again in the new voice.
    this.mimic.replay();
  }

  private onMimic(s: MimicState): void {
    this.micBtn.classList.toggle('on', s !== 'off');
    this.micBtn.setAttribute('aria-pressed', String(s !== 'off'));
    this.hintEl.textContent = {
      off: 'Swipe the face up or down — or shake!',
      listening: this.mimic.hasRecording
        ? '🎤 Say something else… (tap a voice to replay)'
        : '🎤 Listening… say something!',
      hearing: '👂 I’m listening…',
      speaking: '🗣️ Repeating!',
    }[s];
    if (s === 'speaking') this.view.rig?.hop(0.25);
  }

  private sliding = false;

  /** Everything re-roll: the scene slides away like a card and the new buddy's card slides in. */
  private async reelTo(
    spec: CharacterSpec,
    name: string,
    note: string | undefined,
    direction: 1 | -1,
  ): Promise<void> {
    if (this.app.game.save.settings.reducedMotion) {
      this.view.swapWithPoof(spec);
      this.renderName(name, note);
      this.syncVoice();
      sfx.poof();
      return;
    }
    this.sliding = true;
    const startFace = randomFace(`${spec.seed}:start`, spec.generatorVersion);
    sfx.poof();
    try {
      await playCardReel(this.app.stage, {
        direction,
        swap: () => {
          this.view.show(spec).setFaceInstant(startFace);
          this.syncVoice();
        },
        onTick: () => {
          sfx.tick();
          haptic.tick();
        },
        onLand: () => {
          this.renderName(name, note);
          const rig = this.view.rig;
          if (!rig) return;
          haptic.medium();
          rig.hop(0.6);
          // The card has landed — now its face rolls into place.
          void rig.spinFace(spec.face, {
            direction,
            fillers: [],
            durationMs: 900,
            onTick: () => sfx.tick(),
            onLand: () => {
              sfx.land();
              haptic.land();
            },
          });
        },
      });
    } finally {
      this.sliding = false;
    }
  }

  private reset(): void {
    this.app.tap();
    if (this.view.busy || this.sliding) return;
    if (this.spec !== this.baseSpec) {
      this.spec = this.baseSpec;
      const home = this.app.game.homeCharacter();
      void this.reelTo(
        this.spec,
        home ? displayName(home) : APP.mascotName,
        home ? undefined : 'Your guide',
        -1,
      );
      this.resetBtn.style.visibility = 'hidden';
      return;
    } else {
      this.view.rig?.setFaceInstant(this.spec.face);
      this.view.rig?.hop(0.5);
    }
    const home = this.app.game.homeCharacter();
    this.renderName(home ? displayName(home) : APP.mascotName, home ? undefined : 'Your guide');
    this.resetBtn.style.visibility = 'hidden';
  }
}
