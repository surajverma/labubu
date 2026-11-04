/**
 * Central app configuration. App name, mascot name and app ID are placeholders:
 * change them here (and in capacitor.config.ts) at any time.
 */
export const APP = {
  name: 'SpinBuddies',
  mascotName: 'Buddy',
  appId: 'com.spinbuddies.app',
  version: __APP_VERSION__,
} as const;

export const FEATURES = {
  /** Online features (Supabase). Enabled only when build-time env vars are present. */
  online: Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;

export const TUNABLES = {
  startingBoxes: 10,
  maxPixelRatio: 2,
  devMenuTaps: 7,
  spinDurationMs: 1450,
  thumbnailSize: 256,
} as const;
