import { sfx } from '../../audio/sfx';
import { displayName, specFor } from '../../game/game';
import { haptic } from '../../platform';
import { makeShareCard } from '../../render/shareCard';
import { shareImage, shareText } from '../../share';
import { APP } from '../../config';
import type { App } from '../app';
import { h, icon } from '../dom';
import { DETAIL_ACTIONS } from '../screens/detail';
import { SETTINGS_SECTIONS } from '../screens/settings';
import { PROFILE_SECTIONS } from '../screens/profile';

// --- Detail view: Share card + Gift ---
DETAIL_ACTIONS.push((app, o) =>
  h(
    'button',
    {
      class: 'btn ghost small',
      onclick: async () => {
        app.tap();
        try {
          const cv = makeShareCard(app.stage, specFor(o), displayName(o));
          await shareImage(
            cv,
            `spinbuddies-${o.seed}.png`,
            `Look at my ${APP.name} buddy ${displayName(o)}!`,
          );
        } catch (e) {
          console.warn(e);
        }
      },
    },
    icon('share', 20),
    'Share card',
  ),
);

DETAIL_ACTIONS.push((app, o, refresh) =>
  h(
    'button',
    {
      class: 'btn ghost small',
      onclick: async () => {
        app.tap();
        const last = o.count <= 1;
        const ok = await app.confirm(
          `Gift ${displayName(o)}?`,
          `${last ? 'This buddy will leave your book' : 'One copy will leave your book'} and you’ll get a gift code to send to a friend. The code works once.`,
          'Make gift code',
        );
        if (!ok) return;
        const code = await app.game.gift(o.uid);
        if (!code) return;
        sfx.pop();
        haptic.medium();
        const name = displayName(o);
        // Refresh first: gifting the last copy leaves the detail view (which closes sheets).
        refresh();
        setTimeout(() => showCode(app, code, name), 80);
      },
    },
    icon('gift', 20),
    'Gift',
  ),
);

function showCode(app: App, code: string, name: string): void {
  const msg = `🎁 I’m giving you ${name} in ${APP.name}! Open the app → Settings → Redeem a gift code, and enter:\n${code}`;
  app.sheet([
    h('h3', null, 'Your gift code'),
    h(
      'p',
      { class: 'muted' },
      'Send this to your friend. It can be opened once. Keep it until they have it — the buddy isn’t in your book any more!',
    ),
    h('div', { class: 'giftcode', 'aria-label': 'Gift code' }, code),
    h(
      'div',
      { class: 'stack', style: 'margin-top:14px' },
      h(
        'button',
        { class: 'btn purple block', onclick: () => void shareText(msg) },
        icon('share'),
        'Send',
      ),
      h(
        'button',
        {
          class: 'btn ghost block',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(code);
              app.toast('Code copied');
            } catch {
              app.toast('Could not copy — write it down instead');
            }
          },
        },
        'Copy code',
      ),
    ),
  ]);
}

export function openRedeem(app: App): void {
  app.tap();
  const input = h('input', {
    class: 'text',
    placeholder: 'GIFT-XXXX-XXXX-…',
    autocapitalize: 'characters',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Gift code',
  }) as HTMLInputElement;
  const err = h('p', { class: 'muted', style: 'min-height:20px;color:#d13b3b' });
  const go = async () => {
    const r = await app.game.redeem(input.value);
    if (!r.ok) {
      err.textContent = r.message;
      sfx.error();
      return;
    }
    close();
    sfx.fanfare(specFor(r.owned).rarity);
    haptic.success();
    app.toast(`${displayName(r.owned)} joined your book!`);
    app.push('detail', { uid: r.owned.uid });
  };
  const close = app.sheet([
    h('h3', null, 'Redeem a gift code'),
    input,
    err,
    h('button', { class: 'btn block', onclick: () => void go() }, icon('gift'), 'Open gift'),
  ]);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void go();
  });
  setTimeout(() => input.focus(), 250);
}

function tradeHelp(app: App): void {
  app.tap();
  app.sheet([
    h('h3', null, 'Trading with a friend'),
    h('p', null, 'A trade is two gifts:'),
    h(
      'ol',
      { style: 'line-height:1.6;padding-left:20px' },
      h('li', null, 'You each pick a buddy in your Book and tap Gift.'),
      h('li', null, 'Send each other the gift codes.'),
      h('li', null, 'You each tap Redeem a gift code and enter the other’s code.'),
    ),
    h(
      'p',
      { class: 'muted', style: 'font-size:14px' },
      'Codes work offline. Each code can be opened once per phone. Codes are “good enough for friends” — not cheat-proof.',
    ),
  ]);
}

const friendsSection = (app: App) =>
  h(
    'div',
    null,
    h('h2', null, 'Friends'),
    h(
      'div',
      { class: 'list' },
      h(
        'button',
        { class: 'item', onclick: () => openRedeem(app) },
        icon('gift', 22),
        h('span', { class: 'label' }, 'Redeem a gift code'),
      ),
      h(
        'button',
        { class: 'item', onclick: () => tradeHelp(app) },
        icon('people', 22),
        h('span', { class: 'label' }, 'How to trade'),
      ),
    ),
  );

SETTINGS_SECTIONS.unshift((app) => friendsSection(app));
PROFILE_SECTIONS.push((app) => friendsSection(app));
