import { sfx } from '../../audio/sfx';
import { claimDaily, dailyStatus, touchClock } from '../../game/daily';
import { streakReward } from '../../game/economy';
import { dayKey } from '../../game/time';
import { haptic, isNative } from '../../platform';
import {
  notificationPermission,
  requestNotificationPermission,
  scheduleDailyReminder,
} from '../../notify';
import type { App } from '../app';
import { h, icon } from '../dom';
import { toggle } from '../widgets';
import { SETTINGS_SECTIONS } from '../screens/settings';

let sheetOpen = false;
let clockWarned = false;

/** Shows the daily reward sheet if today's box hasn't been claimed. */
export function checkDaily(app: App): void {
  const g = app.game;
  const now = Date.now();
  const st = dailyStatus(g.save.daily, now);
  g.save.daily = touchClock(g.save.daily, now);
  if (st.kind === 'clock') {
    if (!clockWarned)
      app.toast('Your phone’s clock moved back — the next daily box comes when it catches up.');
    clockWarned = true;
    return;
  }
  if (st.kind !== 'claimable' || sheetOpen) {
    void reschedule(app);
    return;
  }
  sheetOpen = true;
  const day = ((st.streak - 1) % 7) + 1;
  const track = h('div', {
    class: 'streak',
    role: 'list',
    'aria-label': `Streak day ${st.streak}`,
  });
  for (let d = 1; d <= 7; d++) {
    const r = streakReward(d);
    const label = r.premium ? 'Premium' : r.boxes > 1 ? `×${r.boxes}` : '×1';
    track.append(
      h(
        'div',
        {
          class: `sday ${d < day ? 'past' : d === day ? 'today' : ''} ${r.premium ? 'prem' : ''}`,
          role: 'listitem',
          'aria-label': `Day ${d}: ${label}`,
        },
        h(
          'div',
          { class: 'sicon' },
          d < day ? icon('check', 18) : icon(r.premium ? 'star' : 'gift', 18),
        ),
        h('div', { class: 'slabel' }, `Day ${d}`),
        h('div', { class: 'sreward' }, label),
      ),
    );
  }
  const rw = st.reward;
  const parts = [
    rw.boxes ? `${rw.boxes} box${rw.boxes > 1 ? 'es' : ''}` : '',
    rw.premium ? '1 Premium box' : '',
    `${rw.coins} coins`,
  ]
    .filter(Boolean)
    .join(' + ');
  const close = app.sheet(
    [
      h('h3', null, st.streak > 1 ? `Day ${st.streak} streak! 🔥` : 'Your daily gift 🎁'),
      st.freeze
        ? h(
            'p',
            { class: 'muted', style: 'margin-top:-6px' },
            'You missed a day, so your weekly streak freeze kicked in. Streak saved!',
          )
        : null,
      track,
      h('p', { style: 'text-align:center;font-weight:600' }, `Today: ${parts}`),
      h(
        'button',
        {
          class: 'btn block',
          onclick: () => {
            const r = claimDaily(g.save.daily, Date.now());
            g.save.daily = r.state;
            if (r.status.kind === 'claimable') {
              g.save.boxes += r.status.reward.boxes;
              g.save.premiumBoxes += r.status.reward.premium;
              g.save.stats.maxStreak = Math.max(g.save.stats.maxStreak, r.status.streak);
              g.addCoins(r.status.reward.coins, 'daily');
              sfx.fanfare('rare');
              haptic.success();
            }
            g.changed('daily');
            close();
          },
        },
        icon('gift'),
        'Collect!',
      ),
    ],
    () => {
      sheetOpen = false;
      app.refresh();
      // A friendly moment to offer reminders: right after collecting a gift.
      setTimeout(() => void maybeAskNotifications(app), 600);
    },
  );
}

async function maybeAskNotifications(app: App): Promise<void> {
  const g = app.game;
  if (!isNative || !g.save.settings.notifications || g.save.seen.includes('notif-ask'))
    return void reschedule(app);
  if ((await notificationPermission()) !== 'prompt') {
    g.save.seen.push('notif-ask');
    return void reschedule(app);
  }
  const hour = g.save.settings.notifyHour;
  const close = app.sheet(
    [
      h('h3', null, 'Want a reminder?'),
      h(
        'p',
        null,
        `We can send one little note at ${fmtHour(hour)} when your free box is ready. Never more than one a day.`,
      ),
      h(
        'div',
        { class: 'stack' },
        h(
          'button',
          {
            class: 'btn purple block',
            onclick: async () => {
              close();
              const ok = await requestNotificationPermission();
              if (!ok) g.save.settings.notifications = false;
              g.changed('settings');
              void reschedule(app);
            },
          },
          'Yes please',
        ),
        h(
          'button',
          {
            class: 'btn ghost block',
            onclick: () => {
              g.save.settings.notifications = false;
              g.changed('settings');
              close();
            },
          },
          'No thanks',
        ),
      ),
    ],
    () => {
      if (!g.save.seen.includes('notif-ask')) g.save.seen.push('notif-ask');
      g.changed('seen');
    },
  );
}

export function reschedule(app: App): Promise<void> {
  const s = app.game.save;
  return scheduleDailyReminder({
    enabled: s.settings.notifications,
    hour: s.settings.notifyHour,
    claimedToday: s.daily.lastClaimDay === dayKey(Date.now()),
  });
}

export function fmtHour(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const HOURS = [8, 12, 16, 18, 19, 20];

SETTINGS_SECTIONS.push((app, rerender) => {
  const s = app.game.save.settings;
  const set = () => {
    app.game.changed('settings');
    void reschedule(app);
    rerender();
  };
  return h(
    'div',
    null,
    h('h2', null, 'Reminders'),
    h(
      'div',
      { class: 'list' },
      h(
        'button',
        {
          class: 'item',
          role: 'switch',
          'aria-checked': String(s.notifications),
          onclick: async () => {
            app.tap();
            s.notifications = !s.notifications;
            if (s.notifications && isNative) {
              let perm = await notificationPermission();
              if (perm === 'prompt') {
                perm = (await requestNotificationPermission()) ? 'granted' : 'denied';
                if (!app.game.save.seen.includes('notif-ask')) app.game.save.seen.push('notif-ask');
              }
              if (perm !== 'granted') {
                // Android won't ask again after a "Don't allow": say where to switch it on.
                s.notifications = false;
                app.toast(
                  'Notifications are off for this app — turn them on in Android Settings → Apps → SpinBuddies → Notifications.',
                );
              } else app.toast(`Reminder set for ${fmtHour(s.notifyHour)} 🎁`);
            }
            set();
          },
        },
        h(
          'span',
          { class: 'label' },
          'Daily box reminder',
          h(
            'div',
            { class: 'muted', style: 'font-size:13px;font-weight:500' },
            'One notification when your free box is ready',
          ),
        ),
        toggle(s.notifications),
      ),
      h(
        'button',
        {
          class: 'item',
          disabled: !s.notifications,
          style: s.notifications ? '' : 'opacity:.5',
          onclick: () => {
            app.tap();
            s.notifyHour = HOURS[(HOURS.indexOf(s.notifyHour) + 1) % HOURS.length] ?? 18;
            set();
          },
        },
        h('span', { class: 'label' }, 'Reminder time'),
        h('span', { class: 'val' }, fmtHour(s.notifyHour)),
      ),
    ),
  );
});
