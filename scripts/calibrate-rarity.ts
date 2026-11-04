// Run: npx vite-node scripts/calibrate-rarity.ts  (prints thresholds for TIER_THRESHOLDS)
import { generateCharacter } from '../src/gen/generate';
import { randomSeed, rngFromString } from '../src/rng';
import { RARITY_ODDS } from '../src/gen/rarity';

for (const v of [1, 2]) {
  const rng = rngFromString('calibrate-' + v);
  const scores: number[] = [];
  for (let i = 0; i < 400000; i++) {
    const s = generateCharacter(randomSeed(rng), v);
    if (s.rarity !== 'secret') scores.push(s.score);
  }
  scores.sort((a, b) => a - b);
  const nonSecret = 1 - RARITY_ODDS.secret;
  const q = (p: number) => scores[Math.floor((p / nonSecret) * scores.length)]!;
  const t = [
    q(RARITY_ODDS.common),
    q(RARITY_ODDS.common + RARITY_ODDS.rare),
    q(RARITY_ODDS.common + RARITY_ODDS.rare + RARITY_ODDS.epic),
  ];
  console.log(`  ${v}: [${t.map((x) => x.toFixed(4)).join(', ')}],`);
}
