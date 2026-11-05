import { SCENES } from '../render/scenes';
import type { Stage } from '../render/stage';

export interface ReelOptions {
  /** +1: cards travel up (swipe up), -1: down. */
  direction: 1 | -1;
  /** Swap the 3D view to the new buddy (called once, under the moving cards). */
  swap: () => void;
  onTick?: () => void;
  /** The new card has settled. */
  onLand?: () => void;
}

const CARD = 'border-radius:30px;box-shadow:0 18px 40px rgba(60,20,40,.25);overflow:hidden;';

function fillerCard(): HTMLElement {
  const ids = Object.keys(SCENES).filter((id) => id !== 'boxroom');
  const sc = SCENES[ids[Math.floor(Math.random() * ids.length)]!]!;
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;inset:0;${CARD}background:linear-gradient(${sc.skyTop},${sc.skyBottom} 70%,${sc.ground});filter:blur(6px)`;
  // A blurred buddy-shaped blob so the passing card reads as "another buddy".
  const blob = document.createElement('div');
  blob.style.cssText = `position:absolute;left:50%;top:30%;width:46%;height:36%;transform:translateX(-50%);border-radius:48% 48% 42% 42%;background:hsl(${Math.random() * 360},70%,75%);opacity:.85`;
  d.append(blob);
  return d;
}

/**
 * "Everything" re-roll as a card reel: the current scene (as a snapshot card) slides away,
 * two blurred cards whiz past like a slot reel, and the live 3D view slides in as the new
 * card with a little overshoot. The UI stays still; only the cards move.
 */
export function playCardReel(stage: Stage, o: ReelOptions): Promise<void> {
  const canvas = stage.canvas;
  const shot = (cv: HTMLCanvasElement) => {
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    const card = document.createElement('div');
    card.style.cssText = `position:absolute;inset:0;${CARD}will-change:transform`;
    card.append(cv);
    return card;
  };
  const oldCard = shot(stage.captureFrame());
  o.swap();
  const newCard = shot(stage.captureFrame());
  // Only images move during the reel: pause 3D so it's smooth on any phone.
  stage.stop();
  const layer = document.createElement('div');
  layer.style.cssText =
    'position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:var(--bg)';
  const fillers = [fillerCard(), fillerCard()];
  const dir = o.direction;
  const off = (p: number) => `translateY(${-dir * p}%) scale(.88)`;
  fillers.forEach((f) => (f.style.transform = off(-118)));
  newCard.style.transform = off(-118);
  layer.append(newCard, ...fillers, oldCard);
  canvas.after(layer);

  const T = 1050;
  const anims: Animation[] = [];
  // Old card: shrink into a card, then slide out.
  anims.push(
    oldCard.animate(
      [
        { transform: 'translateY(0) scale(1)', borderRadius: '0px' },
        { transform: 'translateY(0) scale(.88)', borderRadius: '30px', offset: 0.14 },
        { transform: off(118), borderRadius: '30px' },
      ],
      { duration: T * 0.42, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' },
    ),
  );
  // Two blurred cards whiz through like a slot reel.
  fillers.forEach((f, i) =>
    anims.push(
      f.animate([{ transform: off(-118) }, { transform: off(118) }], {
        duration: T * 0.22,
        delay: T * (0.2 + i * 0.13),
        easing: 'linear',
        fill: 'both',
      }),
    ),
  );
  // The new card arrives, overshoots a touch, then grows to full screen.
  const last = newCard.animate(
    [
      { transform: off(-118), borderRadius: '30px' },
      { transform: off(-118), offset: 0.38 },
      { transform: `translateY(${dir * 4}%) scale(.88)`, offset: 0.78 },
      { transform: 'translateY(0) scale(.88)', borderRadius: '30px', offset: 0.88 },
      { transform: 'translateY(0) scale(1)', borderRadius: '0px' },
    ],
    { duration: T, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
  );
  anims.push(last);
  // Reel ticks: fast at first, slowing down.
  const timers = [0, 70, 150, 240, 340, 460, 600].map((t) =>
    window.setTimeout(() => o.onTick?.(), t),
  );
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      stage.start();
      layer.remove();
      o.onLand?.();
      resolve();
    };
    const onHide = () => {
      if (document.hidden) anims.forEach((a) => a.finish());
    };
    document.addEventListener('visibilitychange', onHide);
    last.onfinish = () => {
      document.removeEventListener('visibilitychange', onHide);
      done();
    };
    last.oncancel = last.onfinish;
  });
}
