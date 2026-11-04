import { LEVELS, STREETS, levelUnlocked, streetStars, streetUnlocked, totalStars } from '../../game/levels';
import { dailyOrder, reqLabel } from '../../game/orders';
import { ECONOMY } from '../../game/economy';
import { dayKey } from '../../game/time';
import type { App, Screen } from '../app';
import { h, icon } from '../dom';
import { counter } from '../widgets';

export function starsText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/** Play tab: daily order + 3 streets of 10 handcrafted orders. */
export class OrdersScreen implements Screen {
  readonly id = 'orders';
  readonly tab = 'play' as const;
  readonly uses3D = false;
  readonly showTabs = true;
  readonly el: HTMLElement;
  private top = h('div', { class: 'topbar' });
  private body = h('div', { class: 'scroll' });

  constructor(private app: App) {
    this.el = h('div', { class: 'screen solid' }, this.top, this.body);
  }

  enter(): void {
    this.render();
  }
  leave(): void {}

  private render(): void {
    const g = this.app.game;
    const best = g.save.orders.best;
    this.top.replaceChildren(h('h1', null, 'Orders'), h('span', { class: 'chip light' }, `★ ${totalStars(best)}`), counter('coins', g.save.coins));
    const today = dayKey(Date.now());
    const daily = dailyOrder(today, g.contentVersion);
    const dres = g.save.orders.daily[today];
    const dailyCard = h(
      'button',
      { class: 'card', style: 'border:none;width:100%;text-align:left;cursor:pointer;background:linear-gradient(135deg,#7a5cff,#b06bff);color:#fff', onclick: () => (this.app.tap(), this.app.push('order', { daily: today })) },
      h('div', { class: 'row' }, icon('calendar', 26), h('div', { style: 'flex:1;font-family:var(--display);font-weight:700;font-size:20px' }, 'Daily order'), h('span', { style: 'font-size:20px;letter-spacing:2px' }, dres ? starsText(dres.stars) : 'NEW')),
      h('div', { style: 'margin-top:6px;opacity:.95;font-weight:600' }, daily.reqs.map(reqLabel).join(' · ')),
      h('div', { style: 'margin-top:4px;opacity:.8;font-size:13px' }, dres ? `Your best today: ${dres.score} points` : `Same order for everyone today · ${ECONOMY.orders.dailyOrderMultiplier} coins per star`),
    );
    const sections: HTMLElement[] = [dailyCard];
    for (const st of STREETS) {
      const unlocked = streetUnlocked(best, st.id);
      const need = ECONOMY.orders.unlockStars[st.id - 1]!;
      const grid = h('div', { class: 'levels' });
      LEVELS.forEach((l, idx) => {
        if (l.street !== st.id) return;
        const open = levelUnlocked(best, idx);
        const stars = best[l.id] ?? 0;
        grid.append(
          h(
            'button',
            {
              class: `lvl ${open ? '' : 'locked'} ${stars === 3 ? 'perfect' : ''}`,
              disabled: !open,
              'aria-label': `${l.title}${open ? `, ${stars} stars` : ', locked'}`,
              onclick: () => (this.app.tap(), this.app.push('order', { level: l.id })),
            },
            h('div', { class: 'n' }, open ? String(idx + 1) : icon('lock', 20)),
            h('div', { class: 's' }, open ? starsText(stars) : ''),
          ),
        );
      });
      sections.push(
        h(
          'div',
          { class: 'street' },
          h(
            'div',
            { class: 'row', style: 'margin:18px 0 10px' },
            h('div', { style: `width:40px;height:40px;border-radius:14px;background:${st.color};display:grid;place-items:center;font-size:22px` }, st.icon),
            h('div', { style: 'flex:1' }, h('div', { style: 'font-family:var(--display);font-weight:700;font-size:19px' }, st.name), h('div', { class: 'muted', style: 'font-size:13px' }, unlocked ? `${streetStars(best, st.id)} / 30 stars` : `Unlocks at ${need} ★ total`)),
          ),
          grid,
        ),
      );
    }
    this.body.replaceChildren(...sections);
  }
}
