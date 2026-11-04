import { RARITY_INFO } from '../gen/rarity';
import type { Rarity } from '../gen/types';
import { h, icon } from './dom';

/** Rarity chip: icon + label (never colour alone — colour-blind safe). */
export function rarityChip(r: Rarity): HTMLElement {
  const i = RARITY_INFO[r];
  return h(
    'span',
    { class: `chip ${r}`, 'aria-label': `Rarity: ${i.label}` },
    h('span', { 'aria-hidden': 'true' }, i.icon),
    i.label,
  );
}

export function counter(kind: 'boxes' | 'coins', value: number, onclick?: () => void): HTMLElement {
  return h(
    'button',
    { class: `counter ${kind}`, onclick, 'aria-label': `${value} ${kind}` },
    icon(kind === 'boxes' ? 'box' : 'coin', 22),
    h('span', { 'data-count': kind }, String(value)),
  );
}

export function toggle(on: boolean): HTMLElement {
  // Decorative: the surrounding row button carries role=switch + aria-checked.
  return h('span', { class: `switch ${on ? 'on' : ''}`, 'aria-hidden': 'true' });
}

export function seg<T extends string>(
  options: { id: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup' });
  const render = (v: T) => {
    wrap.innerHTML = '';
    for (const o of options)
      wrap.append(
        h(
          'button',
          {
            class: o.id === v ? 'on' : '',
            role: 'radio',
            'aria-checked': String(o.id === v),
            onclick: () => (render(o.id), onChange(o.id)),
          },
          o.label,
        ),
      );
  };
  render(value);
  return wrap;
}
