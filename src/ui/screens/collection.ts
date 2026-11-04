import { rarityRank } from '../../gen/rarity';
import { RARITIES, type Rarity } from '../../gen/types';
import { displayName, specFor } from '../../game/game';
import { SETS, setProgress } from '../../game/sets';
import type { OwnedCharacter } from '../../save/schema';
import type { App, Screen } from '../app';
import { clear, h, icon } from '../dom';
import { rarityChip, seg } from '../widgets';

type Filter = 'all' | 'fav' | Rarity | `set:${string}`;
type Sort = 'newest' | 'oldest' | 'rarest';

export class CollectionScreen implements Screen {
  readonly id = 'collection';
  readonly tab = 'book' as const;
  readonly uses3D = false;
  readonly showTabs = true;
  readonly el: HTMLElement;
  private body = h('div', { class: 'scroll' });
  private filtersEl = h('div', { class: 'filters' });
  private titleCount = h('span', { class: 'chip light' });
  private view: 'buddies' | 'sets' = 'buddies';
  private filter: Filter = 'all';
  private sort: Sort = 'newest';
  private observer: IntersectionObserver | null = null;

  constructor(private app: App) {
    this.el = h(
      'div',
      { class: 'screen solid' },
      h('div', { class: 'topbar' }, h('h1', null, 'My Book'), this.titleCount),
      h(
        'div',
        { style: 'padding:0 16px 10px' },
        seg(
          [
            { id: 'buddies', label: 'Buddies' },
            { id: 'sets', label: 'Sets' },
          ],
          'buddies',
          (v) => {
            app.tap();
            this.view = v;
            this.render();
          },
        ),
      ),
      this.filtersEl,
      this.body,
    );
  }

  enter(params?: Record<string, unknown>): void {
    if (params?.filter) {
      this.filter = params.filter as Filter;
      this.view = 'buddies';
    }
    this.render();
  }

  leave(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private render(): void {
    const col = this.app.game.save.collection;
    const copies = col.reduce((a, c) => a + c.count, 0);
    this.titleCount.textContent = `${col.length} buddies${copies > col.length ? ` · ${copies - col.length} dupes` : ''}`;
    this.observer?.disconnect();
    clear(this.body);
    clear(this.filtersEl);
    if (this.view === 'sets') {
      this.filtersEl.style.display = 'none';
      this.renderSets();
      return;
    }
    this.filtersEl.style.display = '';
    this.renderFilters();
    let list = col.slice();
    const f = this.filter;
    if (f === 'fav') list = list.filter((c) => c.favourite);
    else if (f.startsWith('set:')) {
      const set = SETS.find((s) => s.id === f.slice(4));
      if (set) list = list.filter((c) => set.matches(specFor(c)));
    } else if (f !== 'all') list = list.filter((c) => specFor(c).rarity === f);
    if (this.sort === 'newest') list.sort((a, b) => b.foundAt - a.foundAt);
    else if (this.sort === 'oldest') list.sort((a, b) => a.foundAt - b.foundAt);
    else
      list.sort(
        (a, b) =>
          rarityRank(specFor(b).rarity) - rarityRank(specFor(a).rarity) ||
          specFor(b).score - specFor(a).score,
      );

    if (!col.length) {
      this.body.append(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'big' }, '📖'),
          h('p', null, 'Your book is empty. Open a blind box to find your first buddy!'),
          h(
            'button',
            { class: 'btn', onclick: () => this.app.go('box') },
            icon('gift'),
            'Open a box',
          ),
        ),
      );
      return;
    }
    if (!list.length) {
      this.body.append(
        h('div', { class: 'empty' }, h('p', null, 'No buddies match this filter yet.')),
      );
      return;
    }
    const dupes = this.app.game.duplicatesValue();
    if (dupes.copies > 0 && f === 'all') {
      this.body.append(
        h(
          'div',
          { class: 'card row', style: 'margin-bottom:12px;padding:10px 14px' },
          h(
            'div',
            { style: 'flex:1;font-weight:600' },
            `${dupes.copies} duplicate${dupes.copies > 1 ? 's' : ''}`,
            h(
              'div',
              { class: 'muted', style: 'font-size:13px;font-weight:500' },
              'Keeps one of each. Secrets are never recycled.',
            ),
          ),
          h(
            'button',
            {
              class: 'btn small',
              onclick: async () => {
                const ok = await this.app.confirm(
                  'Recycle duplicates?',
                  `You keep one of every buddy and get ${dupes.coins} coins for the ${dupes.copies} extra copies.`,
                  `Recycle for ${dupes.coins}`,
                );
                if (!ok) return;
                const got = this.app.game.recycleAllDuplicates();
                this.app.toast(`+${got} coins`);
                this.render();
              },
            },
            icon('coin', 18),
            `+${dupes.coins}`,
          ),
        ),
      );
    }
    const grid = h('div', { class: 'grid' });
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const tile = e.target as HTMLElement;
          this.observer?.unobserve(tile);
          const o = this.app.game.find(tile.dataset.uid!);
          if (o) this.loadThumb(tile, o);
        }
      },
      { root: this.body, rootMargin: '200px' },
    );
    for (const o of list) grid.append(this.tile(o));
    this.body.append(grid);
  }

  private tile(o: OwnedCharacter): HTMLElement {
    const spec = specFor(o);
    const t = h(
      'button',
      {
        class: `tile r-${spec.rarity}`,
        'data-uid': o.uid,
        'aria-label': `${displayName(o)}, ${spec.rarity}`,
        onclick: () => (this.app.tap(), this.app.push('detail', { uid: o.uid })),
      },
      h('div', { class: 'shimmer' }),
      o.favourite ? h('span', { class: 'fav' }, icon('heart', 18)) : null,
      o.count > 1 ? h('span', { class: 'count' }, `×${o.count}`) : null,
    );
    const chip = rarityChip(spec.rarity);
    chip.classList.add('tag');
    t.append(chip);
    this.observer?.observe(t);
    return t;
  }

  private loadThumb(tile: HTMLElement, o: OwnedCharacter): void {
    void this.app.thumbs.get(o).then((url) => {
      if (!url) return;
      const img = h('img', { src: url, alt: '', draggable: 'false' });
      tile.querySelector('.shimmer')?.replaceWith(img);
    });
  }

  private renderFilters(): void {
    const opts: { id: Filter; label: string }[] = [
      { id: 'all', label: 'All' },
      { id: 'fav', label: '♥ Favourites' },
      ...RARITIES.map((r) => ({ id: r as Filter, label: r[0]!.toUpperCase() + r.slice(1) })),
    ];
    if (this.filter.startsWith('set:')) {
      const set = SETS.find((s) => s.id === this.filter.slice(4));
      if (set) opts.splice(1, 0, { id: this.filter, label: `${set.icon} ${set.name}` });
    }
    for (const o of opts)
      this.filtersEl.append(
        h(
          'button',
          {
            class: this.filter === o.id ? 'on' : '',
            onclick: () => (this.app.tap(), (this.filter = o.id), this.render()),
          },
          o.label,
        ),
      );
    const sorts: { id: Sort; label: string }[] = [
      { id: 'newest', label: 'Newest' },
      { id: 'oldest', label: 'Oldest' },
      { id: 'rarest', label: 'Rarest' },
    ];
    const cur = sorts.find((s) => s.id === this.sort)!;
    this.filtersEl.append(
      h(
        'button',
        {
          'aria-label': `Sort: ${cur.label}`,
          onclick: () => {
            this.app.tap();
            this.sort = sorts[(sorts.indexOf(cur) + 1) % sorts.length]!.id;
            this.render();
          },
        },
        `↕ ${cur.label}`,
      ),
    );
  }

  private renderSets(): void {
    const g = this.app.game;
    const list = h('div', { class: 'stack' });
    for (const set of SETS.filter((s) => s.since <= g.contentVersion)) {
      const p = setProgress(set, g.save.collection.map(specFor));
      const done = g.save.badges.includes(set.id);
      list.append(
        h(
          'button',
          {
            class: `card setcard ${done ? 'done' : ''}`,
            style: 'border:none;text-align:left;width:100%;cursor:pointer',
            onclick: () => (
              this.app.tap(),
              (this.filter = `set:${set.id}`),
              (this.view = 'buddies'),
              this.render()
            ),
          },
          h('div', { class: 'badge', 'aria-hidden': 'true' }, set.icon),
          h(
            'div',
            { style: 'flex:1;min-width:0' },
            h('div', { class: 't' }, set.name, done ? ' ✓' : ''),
            h('div', { class: 'd' }, set.description),
            h(
              'div',
              {
                class: 'progress',
                role: 'progressbar',
                'aria-valuenow': String(p.have),
                'aria-valuemax': String(p.need),
              },
              h('div', { style: `width:${(100 * p.have) / p.need}%` }),
            ),
          ),
          h('div', { style: 'font-family:var(--display);font-weight:700' }, `${p.have}/${p.need}`),
        ),
      );
    }
    this.body.append(list);
  }
}
