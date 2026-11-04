import { ACHIEVEMENTS } from '../../game/achievements';
import { totalStars } from '../../game/levels';
import { SETS } from '../../game/sets';
import { displayName } from '../../game/game';
import type { App, Screen } from '../app';
import { h, icon } from '../dom';

/** Extra profile sections (friend code, online showcase — Phase 3). */
export const PROFILE_SECTIONS: ((app: App) => HTMLElement | null)[] = [];

export class ProfileScreen implements Screen {
  readonly id = 'profile';
  readonly tab = 'more' as const;
  readonly uses3D = false;
  readonly showTabs = false;
  readonly el: HTMLElement;
  private body = h('div', { class: 'scroll' });

  constructor(private app: App) {
    this.el = h(
      'div',
      { class: 'screen solid no-tabs' },
      h('div', { class: 'topbar' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => app.back() }, icon('back')), h('h1', null, 'Profile')),
      this.body,
    );
  }

  enter(): void {
    const g = this.app.game;
    const s = g.save;
    const home = g.homeCharacter();
    const avatar = h('div', { class: 'pavatar' }, home ? h('div', { class: 'shimmer' }) : h('span', { style: 'font-size:44px' }, '🌱'));
    if (home) void this.app.thumbs.get(home).then((url) => url && avatar.replaceChildren(h('img', { src: url, alt: '' })));
    const stat = (n: string | number, l: string) => h('div', { class: 'pstat' }, h('b', null, String(n)), h('span', null, l));
    const doneCount = s.achievements.length;
    this.body.replaceChildren(
      h(
        'div',
        { class: 'card row', style: 'gap:14px' },
        avatar,
        h('div', { style: 'flex:1;min-width:0' }, h('div', { style: 'font-family:var(--display);font-weight:700;font-size:22px' }, home ? displayName(home) : 'New collector'), h('div', { class: 'muted', style: 'font-size:14px' }, `Collecting since ${new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`)),
      ),
      h(
        'div',
        { class: 'pstats' },
        stat(s.collection.length, 'buddies'),
        stat(s.stats.boxesOpened, 'boxes opened'),
        stat(totalStars(s.orders.best), 'order stars'),
        stat(s.stats.maxStreak, 'best streak'),
        stat(s.stats.ordersPlayed, 'orders served'),
        stat(s.stats.coinsEarned, 'coins earned'),
      ),
      ...PROFILE_SECTIONS.map((f) => f(this.app)).filter((x): x is HTMLElement => !!x),
      h('h2', null, `Set badges (${s.badges.length})`),
      s.badges.length
        ? h('div', { class: 'badges' }, ...SETS.filter((x) => s.badges.includes(x.id)).map((x) => h('div', { class: 'badge-chip', title: x.name }, h('span', { class: 'bi' }, x.icon), x.name)))
        : h('p', { class: 'muted' }, 'Complete a set in your Book to earn its badge.'),
      h('h2', null, `Achievements (${doneCount}/${ACHIEVEMENTS.length})`),
      h(
        'div',
        { class: 'ach' },
        ...ACHIEVEMENTS.map((a) => {
          const done = s.achievements.includes(a.id);
          const p = a.progress?.(s);
          return h(
            'div',
            { class: `achi ${done ? 'done' : ''}`, 'aria-label': `${a.name}: ${a.description}${done ? ', earned' : ''}` },
            h('div', { class: 'ai', 'aria-hidden': 'true' }, done ? a.icon : icon('lock', 18)),
            h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'an' }, a.name), h('div', { class: 'ad' }, a.description), !done && p ? h('div', { class: 'progress', style: 'height:6px;margin-top:4px' }, h('div', { style: `width:${(100 * p[0]) / p[1]}%` })) : null),
            h('div', { class: 'ac' }, done ? '✓' : `+${a.coins}`),
          );
        }),
      ),
    );
  }
  leave(): void {}
}
