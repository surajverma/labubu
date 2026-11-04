import type { CapacitorConfig } from '@capacitor/cli';

// App name and ID are placeholders — keep in sync with src/config.ts.
const config: CapacitorConfig = {
  appId: 'com.spinbuddies.app',
  appName: 'SpinBuddies',
  webDir: 'dist',
  backgroundColor: '#fff4ec',
  android: {
    backgroundColor: '#fff4ec',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#fff4ec',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#ff7a59',
    },
  },
};

export default config;
