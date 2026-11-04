// npx vite-node scripts/tune-orders.ts — solvability + greedy 3-star rate per level.
import { LEVELS } from '../src/game/levels';
import { simulateGreedy, solve, reqLabel } from '../src/game/orders';
import { rngFromString } from '../src/rng';
const v = Number(process.argv[2] ?? 1);
for (const o of LEVELS) {
  const ok = !!solve(o, v);
  const rng = rngFromString('tune' + o.id);
  let three = 0, stars = 0;
  const N = 150;
  for (let i = 0; i < N; i++) { const r = simulateGreedy(o, rng, v); stars += r.stars; if (r.stars === 3) three++; }
  console.log(`${o.id} ${ok ? 'OK ' : 'NO!'} 3★ ${(100 * three / N).toFixed(0).padStart(3)}%  avg ${(stars / N).toFixed(2)}  ${o.title}: ${o.reqs.map(reqLabel).join(' · ')}`);
}
