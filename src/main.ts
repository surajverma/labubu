import './ui/styles.css';
import { App } from './ui/app';
import { HomeScreen } from './ui/screens/home';
import { BoxScreen } from './ui/screens/box';
import { CollectionScreen } from './ui/screens/collection';
import { DetailScreen } from './ui/screens/detail';
import { SettingsScreen } from './ui/screens/settings';
import { OrdersScreen } from './ui/screens/orders';
import { OrderScreen } from './ui/screens/order';
import { SETS, setProgress } from './game/sets';
import { specFor } from './game/game';
import { sfx } from './audio/sfx';
import { haptic } from './platform';
import './ui/features/economyUi';
import { checkDaily } from './ui/features/daily';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const dev = params.get('dev');
  if (dev) {
    const { runDev } = await import('./dev');
    runDev(dev, params);
    return;
  }
  const app = new App(document.getElementById('app')!);
  app.register('home', () => new HomeScreen(app));
  app.register('box', () => new BoxScreen(app));
  app.register('collection', () => new CollectionScreen(app));
  app.register('detail', () => new DetailScreen(app));
  app.register('settings', () => new SettingsScreen(app));
  app.register('orders', () => new OrdersScreen(app));
  app.register('order', () => new OrderScreen(app));

  // Set completion → badge (+ coins from Phase 2).
  app.game.hooks.push((g, reason) => {
    if (reason !== 'box' && reason !== 'gift' && reason !== 'order' && reason !== 'import') return;
    const specs = g.save.collection.map(specFor);
    for (const set of SETS) {
      if (set.since > g.contentVersion || g.save.badges.includes(set.id)) continue;
      if (setProgress(set, specs).done) {
        g.save.badges.push(set.id);
        g.addCoins(set.coins, 'set');
        if (reason !== 'import') {
          setTimeout(() => {
            app.toast(`${set.icon} Set complete: ${set.name}! +${set.coins} coins`);
            sfx.fanfare('epic');
            haptic.success();
          }, 1800);
        }
      }
    }
  });

  app.onForeground.push(() => checkDaily(app));
  await app.start();
  (window as unknown as { __app: App; __ready: boolean }).__app = app;
  (window as unknown as { __ready: boolean }).__ready = true;
}

void boot();
