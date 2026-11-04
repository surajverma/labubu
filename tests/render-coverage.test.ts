import { describe, expect, it } from 'vitest';
import { PARTS } from '../src/gen/parts';
import { EARS } from '../src/render/parts/ears';
import { HATS } from '../src/render/parts/hats';
import { OUTFITS } from '../src/render/parts/outfits';
import { ACCESSORIES } from '../src/render/parts/accessories';
import { SCENES } from '../src/render/scenes';
import { FACE_DRAWERS } from '../src/render/face';
import { BODY_SHAPES, HEAD_SHAPES } from '../src/render/shapes';

describe('every part has a renderer', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['body', BODY_SHAPES],
    ['head', HEAD_SHAPES],
    ['ears', EARS],
    ['hat', HATS],
    ['outfit', OUTFITS],
    ['accessory', ACCESSORIES],
    ['scene', SCENES],
    ['eyes', FACE_DRAWERS.eyes],
    ['brows', FACE_DRAWERS.brows],
    ['mouth', FACE_DRAWERS.mouth],
    ['nose', FACE_DRAWERS.nose],
    ['cheeks', FACE_DRAWERS.cheeks],
  ];
  for (const [layer, reg] of cases) {
    it(layer, () => {
      for (const p of PARTS[layer as keyof typeof PARTS])
        expect(reg[p.id], `${layer}:${p.id}`).toBeTruthy();
    });
  }
});
