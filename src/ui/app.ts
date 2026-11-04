import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Stage } from '../render/stage';
import { Game } from '../game/game';
import { sfx } from '../audio/sfx';
import { haptic, isNative, setHapticsEnabled } from '../platform';
import { h, icon, clear, type ICONS } from './dom';
import { ThumbService } from './thumbs';
import type { Quality } from '../render/character';

export interface Screen {
  readonly id: string;
  readonly el: HTMLElement;
  /** Which tab is highlighted while this screen shows. */
  readonly tab: TabId;
  readonly uses3D: boolean;
  readonly showTabs: boolean;
  enter(params?: Record<string, unknown>): void;
  leave(): void;
  /** Return true if the screen handled the back action itself. */
  onBack?(): boolean;
}

export type TabId = 'home' | 'box' | 'play' | 'book' | 'more';

interface TabDef {
  id: TabId;
  label: string;
  icon: keyof typeof ICONS;
  screen: string;
}

export class App {
  readonly stage: Stage;
  readonly game = new Game();
  readonly thumbs: ThumbService;
  readonly canvas: HTMLCanvasElement;
  private screensEl: HTMLElement;
  private tabbar: HTMLElement;
  private modalRoot: HTMLElement;
  private toastsEl: HTMLElement;
  private screens = new Map<string, Screen>();
  private factories = new Map<string, () => Screen>();
  private current: Screen | null = null;
  private stack: { id: string; params?: Record<string, unknown> }[] = [];
  private modals: { el: HTMLElement; onClose?: () => void }[] = [];
  /** Run after start and whenever the app comes back to the foreground. */
  readonly onForeground: (() => void)[] = [];
  tabs: TabDef[] = [
    { id: 'home', label: 'Home', icon: 'home', screen: 'home' },
    { id: 'box', label: 'Boxes', icon: 'box', screen: 'box' },
    { id: 'play', label: 'Play', icon: 'play', screen: 'orders' },
    { id: 'book', label: 'Book', icon: 'book', screen: 'collection' },
    { id: 'more', label: 'Settings', icon: 'gear', screen: 'settings' },
  ];

  constructor(root: HTMLElement) {
    this.canvas = h('canvas', { id: 'stage', 'aria-label': '3D character view' });
    this.screensEl = h('div', { id: 'screens' });
    this.tabbar = h('nav', { id: 'tabbar', 'aria-label': 'Main' });
    this.modalRoot = h('div', { id: 'modal-root' });
    this.toastsEl = h('div', { id: 'toasts', 'aria-live': 'polite' });
    root.append(this.canvas, this.screensEl, this.tabbar, this.modalRoot, this.toastsEl);
    this.stage = new Stage(this.canvas);
    this.thumbs = new ThumbService(this.stage);
    // Audio needs a user gesture.
    window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stage.stop();
        sfx.suspend();
        void this.game.flush();
      } else {
        if (this.current?.uses3D) this.stage.start();
        sfx.resume();
        this.onForeground.forEach((f) => f());
      }
    });
  }

  register(id: string, factory: () => Screen): void {
    this.factories.set(id, factory);
  }

  private screen(id: string): Screen {
    let s = this.screens.get(id);
    if (!s) {
      const f = this.factories.get(id);
      if (!f) throw new Error(`No screen ${id}`);
      s = f();
      this.screens.set(id, s);
    }
    return s;
  }

  async start(): Promise<void> {
    await this.game.load();
    this.applySettings();
    this.renderTabs();
    if (isNative) {
      void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      void CapApp.addListener('backButton', () => this.back());
      void CapApp.addListener('pause', () => void this.game.flush());
    } else {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.back();
      });
    }
    this.go('home');
    if (isNative) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
    if (!this.game.save.settings.detectedQuality && !navigator.webdriver) this.benchmark();
    setTimeout(() => this.onForeground.forEach((f) => f()), 900);
  }

  /** Re-renders the current screen (e.g. after counters changed). */
  refresh(): void {
    const top = this.stack[this.stack.length - 1];
    if (!top || !this.current || this.current.id !== top.id) return;
    this.current.leave();
    this.current.enter(top.params);
    this.updateTabs();
  }

  /**
   * First-launch quality pick: watch ~90 frames of Home after a warm-up and choose
   * High/Medium/Low from the average frame time. Only runs once (saved in settings).
   */
  private benchmark(): void {
    const times: number[] = [];
    let warm = 0;
    const off = this.stage.onFrame((dt) => {
      if (warm < 0.8) {
        warm += dt;
        return;
      }
      times.push(dt);
      if (times.length < 90) return;
      off();
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)]!;
      const q = median < 0.021 ? 'high' : median < 0.03 ? 'medium' : 'low';
      const s = this.game.save.settings;
      s.detectedQuality = q;
      this.game.changed('settings');
      if (s.quality === 'auto' && q !== 'high') this.applySettings();
    });
  }

  applySettings(): void {
    const s = this.game.save.settings;
    sfx.soundOn = s.sound;
    sfx.setMusic(s.music);
    setHapticsEnabled(s.haptics);
    const q: Quality = s.quality === 'auto' ? (s.detectedQuality ?? 'high') : s.quality;
    this.stage.setQuality(q);
    document.body.classList.toggle('reduce-motion', s.reducedMotion);
  }

  get currentId(): string | undefined {
    return this.current?.id;
  }

  get quality(): Quality {
    return this.stage.quality;
  }

  renderTabs(): void {
    clear(this.tabbar);
    for (const t of this.tabs) {
      const b = h(
        'button',
        { 'data-tab': t.id, 'aria-label': t.label, onclick: () => (sfx.tap(), this.go(t.screen)) },
        icon(t.icon, 26),
        h('span', null, t.label),
      );
      this.tabbar.append(b);
    }
    this.updateTabs();
  }

  /** Optional badge numbers on tabs. */
  tabBadges: Partial<Record<TabId, number>> = {};

  updateTabs(): void {
    for (const b of this.tabbar.querySelectorAll('button')) {
      const id = b.getAttribute('data-tab') as TabId;
      b.classList.toggle('on', this.current?.tab === id);
      b.querySelector('.dot')?.remove();
      const n = this.tabBadges[id];
      if (n) b.append(h('span', { class: 'dot' }, String(n)));
    }
    this.tabbar.classList.toggle('hidden', !this.current?.showTabs);
  }

  /** Switch to a top-level screen (clears the push stack). */
  go(id: string, params?: Record<string, unknown>): void {
    this.stack = [{ id, params }];
    this.show(id, params);
  }

  /** Push a screen on top (Android back returns to the previous one). */
  push(id: string, params?: Record<string, unknown>): void {
    this.stack.push({ id, params });
    this.show(id, params);
  }

  private show(id: string, params?: Record<string, unknown>): void {
    const next = this.screen(id);
    if (this.current) {
      this.current.leave();
      this.current.el.remove();
    }
    this.closeAllModals();
    this.current = next;
    this.screensEl.append(next.el);
    this.canvas.classList.toggle('hidden', !next.uses3D);
    if (next.uses3D) this.stage.start();
    else this.stage.stop();
    next.enter(params);
    this.updateTabs();
  }

  /** Android back button / Escape. */
  back(): void {
    if (this.modals.length) {
      this.closeModal();
      return;
    }
    if (this.current?.onBack?.()) return;
    if (this.stack.length > 1) {
      this.stack.pop();
      const prev = this.stack[this.stack.length - 1]!;
      this.show(prev.id, prev.params);
      return;
    }
    if (this.current?.id !== 'home') {
      this.go('home');
      return;
    }
    if (isNative) void CapApp.exitApp();
  }

  // --- Modals / sheets ---
  sheet(content: HTMLElement | (HTMLElement | null)[], onClose?: () => void): () => void {
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    for (const c of Array.isArray(content) ? content : [content]) if (c) sheet.append(c);
    const backdrop = h('div', { class: 'backdrop' }, sheet);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    this.modalRoot.append(backdrop);
    this.modals.push({ el: backdrop, onClose });
    return () => {
      const i = this.modals.findIndex((m) => m.el === backdrop);
      if (i >= 0) {
        this.modals.splice(i, 1);
        backdrop.remove();
        onClose?.();
      }
    };
  }

  closeModal(): void {
    const m = this.modals.pop();
    if (!m) return;
    m.el.remove();
    m.onClose?.();
  }

  closeAllModals(): void {
    while (this.modals.length) this.closeModal();
  }

  confirm(title: string, text: string, ok = 'OK', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        close();
        resolve(v);
      };
      const close = this.sheet(
        [
          h('h3', null, title),
          h('p', { class: 'muted' }, text),
          h(
            'div',
            { class: 'stack' },
            h('button', { class: `btn block ${danger ? '' : 'purple'}`, onclick: () => finish(true) }, ok),
            h('button', { class: 'btn ghost block', onclick: () => finish(false) }, 'Cancel'),
          ),
        ],
        () => finish(false),
      );
    });
  }

  toast(msg: string): void {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    this.toastsEl.append(t);
    setTimeout(() => t.remove(), 2700);
  }

  tap(): void {
    sfx.tap();
    haptic.tick();
  }
}
