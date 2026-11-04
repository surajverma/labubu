import { sfx } from '../../audio/sfx';
import { recycleValue } from '../../game/economy';
import { specFor } from '../../game/game';
import { haptic } from '../../platform';
import { h, icon } from '../dom';
import { DETAIL_ACTIONS } from '../screens/detail';

/** Detail view: recycle one duplicate for coins (Secrets can't be recycled). */
DETAIL_ACTIONS.push((app, o, refresh) => {
  if (o.count < 2) return null;
  const v = recycleValue(specFor(o).rarity);
  if (v === null) return h('span', { class: 'chip light' }, 'Secrets can’t be recycled');
  return h(
    'button',
    {
      class: 'btn ghost small',
      onclick: () => {
        const got = app.game.recycle(o.uid);
        if (got === null) return;
        sfx.coin();
        haptic.medium();
        app.toast(`Recycled a copy: +${got} coins`);
        refresh();
      },
    },
    icon('coin', 20),
    `Recycle 1 (+${v})`,
  );
});
