import { Stage } from './render/stage';
import { buildCharacter } from './render/character';
import { buildBackdrop } from './render/scenes';
import { MASCOT } from './gen/mascot';
import type { CharacterSpec } from './gen/types';

import { runDev } from './dev';

// Temporary look-dev entry (Milestone 2). Query: ?spec=<json> overrides the mascot.
const devMode = new URLSearchParams(location.search).get('dev');
if (devMode) runDev(devMode, new URLSearchParams(location.search));
else lookdev();

function lookdev(): void {
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
document.getElementById('app')!.appendChild(canvas);
const stage = new Stage(canvas);
const params = new URLSearchParams(location.search);
const spec: CharacterSpec = params.get('spec') ? { ...MASCOT, ...JSON.parse(params.get('spec')!) } : MASCOT;
stage.setBackdrop(buildBackdrop(spec.scene));
const rig = buildCharacter(spec);
stage.turntable.add(rig.root);
rig.root.rotation.y = Number(params.get('rot') ?? 0);
stage.frame(rig.height * 1.15, 2.1, rig.height * 0.5, 0);
stage.onFrame((dt, t) => rig.update(dt, t));
stage.start();
(window as unknown as { __ready: boolean }).__ready = true;
}
