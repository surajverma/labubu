import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';
import { APP } from './config';

const DAILY_ID = 1001;

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative) return 'denied';
  try {
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedules the single "daily box is ready" reminder at `hour` on the next day the box is
 * available (today if it isn't claimed yet and the hour hasn't passed). Replaces any
 * earlier reminder, so there is never more than one pending.
 */
export async function scheduleDailyReminder(opts: {
  enabled: boolean;
  hour: number;
  claimedToday: boolean;
}): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] });
    if (!opts.enabled || (await notificationPermission()) !== 'granted') return;
    const at = new Date();
    at.setHours(opts.hour, 0, 0, 0);
    if (opts.claimedToday || at.getTime() <= Date.now() + 60_000) at.setDate(at.getDate() + 1);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_ID,
          title: 'Your daily box is ready! 🎁',
          body: `A new buddy is waiting in ${APP.name}.`,
          schedule: { at, allowWhileIdle: true },
          // A daily reminder doesn't need an exact alarm. Without this the plugin opens the
          // "Alarms & reminders" settings screen (we don't hold that permission) and the
          // call hangs until the user comes back.
          isExactNotification: false,
          smallIcon: 'ic_stat_notify',
          iconColor: '#7a5cff',
        },
      ],
    });
  } catch (e) {
    console.warn('notification schedule failed', e);
  }
}
