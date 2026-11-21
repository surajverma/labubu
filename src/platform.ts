import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

let hapticsOn = true;
export function setHapticsEnabled(on: boolean): void {
  hapticsOn = on;
}

/** Haptic feedback with web vibrate fallback. All calls are fire-and-forget. */
export const haptic = {
  tick(): void {
    if (!hapticsOn) return;
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else navigator.vibrate?.(6);
  },
  land(): void {
    if (!hapticsOn) return;
    if (isNative) void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    else navigator.vibrate?.(28);
  },
  medium(): void {
    if (!hapticsOn) return;
    if (isNative) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else navigator.vibrate?.(14);
  },
  /** Patterns made of light/medium/heavy taps (ms offsets). */
  pattern(steps: [number, 'light' | 'medium' | 'heavy'][]): void {
    if (!hapticsOn) return;
    if (!isNative) {
      // Web fallback: approximate with a vibrate pattern.
      const v: number[] = [];
      let last = 0;
      for (const [t, k] of steps) {
        if (v.length) v.push(Math.max(0, t - last));
        v.push(k === 'heavy' ? 28 : k === 'medium' ? 14 : 6);
        last = t + v[v.length - 1]!;
      }
      navigator.vibrate?.(v);
      return;
    }
    const style = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    for (const [t, k] of steps)
      setTimeout(() => void Haptics.impact({ style: style[k] }).catch(() => {}), t);
  },
  /** Box shake that builds: taps get closer and stronger over `ms`. */
  rumble(ms = 1400): void {
    const steps: [number, 'light' | 'medium' | 'heavy'][] = [];
    for (let t = 0, gap = 220; t < ms; t += gap, gap = Math.max(60, gap * 0.82))
      steps.push([t, t > ms * 0.66 ? 'heavy' : t > ms * 0.33 ? 'medium' : 'light']);
    haptic.pattern(steps);
  },
  /** Thump-thump: for the Secret reveal build-up. */
  heartbeat(times = 3): void {
    const steps: [number, 'light' | 'medium' | 'heavy'][] = [];
    for (let i = 0; i < times; i++) steps.push([i * 700, 'heavy'], [i * 700 + 160, 'medium']);
    haptic.pattern(steps);
  },
  /** Happy burst for big rewards. */
  celebrate(): void {
    haptic.pattern([
      [0, 'heavy'],
      [90, 'light'],
      [170, 'light'],
      [250, 'medium'],
      [380, 'heavy'],
    ]);
  },
  success(): void {
    if (!hapticsOn) return;
    if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else navigator.vibrate?.([20, 40, 30]);
  },
};

/** Device-motion shake detector. Calls `onShake` at most every `cooldownMs`. */
export function watchShake(onShake: () => void, cooldownMs = 1200): () => void {
  let last = 0;
  let lastAcc: { x: number; y: number; z: number } | null = null;
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    if (lastAcc) {
      const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z);
      const now = performance.now();
      if (d > 28 && now - last > cooldownMs) {
        last = now;
        onShake();
      }
    }
    lastAcc = { x: a.x, y: a.y, z: a.z };
  };
  window.addEventListener('devicemotion', handler);
  return () => window.removeEventListener('devicemotion', handler);
}

/** iOS-style motion permission (Android WebView grants it without a prompt). */
export async function requestMotionPermission(): Promise<boolean> {
  const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
  if (typeof DME?.requestPermission === 'function') {
    try {
      return (await DME.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}
