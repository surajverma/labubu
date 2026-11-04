import { pickWeighted, rngFromString, type Rng } from '../rng';
import { FINISHES, partById, partsFor } from './parts';
import { colorName, generatePalette } from './palette';
import { applyRules } from './rules';
import { makeName } from './names';
import { tierForScore, SECRET_CHANCE } from './rarity';
import { FACE_LAYERS, type CharacterSpec, type FaceSpec, type Finish, type Layer, type PartDef } from './types';

/** Generator version used for new characters. Old saves keep the version they were made with. */
export const LATEST_GENERATOR_VERSION = 1;

const MOODS = new Set(['happy', 'sleepy', 'cheeky', 'cool', 'shy', 'angry', 'surprised', 'silly', 'love', 'sad', 'sparkly', 'calm', 'cute', 'spooky', 'magic', 'cozy']);

interface Pick {
  part: PartDef;
  surprisal: number;
}

function pickPart(rng: Rng, layer: Layer, version: number, secret: boolean): Pick {
  const list = partsFor(layer, version, false);
  const total = list.reduce((a, p) => a + p.weight, 0);
  const part = pickWeighted(rng, list, (p) => p.weight);
  void secret;
  return { part, surprisal: -Math.log(part.weight / total) };
}

/**
 * Pure, deterministic character generation. Every layer has its own RNG stream (keyed by
 * seed + version + layer), so picks never shift when another layer changes.
 */
export function generateCharacter(seed: string, version = LATEST_GENERATOR_VERSION, variant?: string): CharacterSpec {
  const key = `${seed}|v${version}${variant ? `|${variant}` : ''}`;
  const stream = (name: string) => rngFromString(`${key}|${name}`);
  const secret = stream('secret')() < SECRET_CHANCE;

  let score = 0;
  const pick = (layer: Layer): PartDef => {
    const p = pickPart(stream(layer), layer, version, secret);
    score += p.surprisal;
    return p.part;
  };

  const body = pick('body');
  const head = pick('head');
  const ears = pick('ears');
  const faceParts = Object.fromEntries(FACE_LAYERS.map((l) => [l, pick(l)])) as Record<(typeof FACE_LAYERS)[number], PartDef>;
  const hat = pick('hat');
  const outfit = pick('outfit');
  const accessory = pick('accessory');
  const scene = pick('scene');

  // Finish.
  const finRng = stream('finish');
  const finList = FINISHES.filter((f) => f.since <= version && !f.secretOnly);
  const finTotal = finList.reduce((a, f) => a + f.weight, 0);
  const fin = pickWeighted(finRng, finList, (f) => f.weight);
  score += -Math.log(fin.weight / finTotal);
  let finish: Finish = fin.id;

  const palette = generatePalette(stream('palette'), variant);
  if (palette.harmony === 'neon') score += 1.2;
  if (palette.harmony === 'seasonal') score += 0.8;

  const mods: CharacterSpec['mods'] = {};
  const face: FaceSpec = {
    eyes: faceParts.eyes.id,
    brows: faceParts.brows.id,
    mouth: faceParts.mouth.id,
    nose: faceParts.nose.id,
    cheeks: faceParts.cheeks.id,
  };

  // Secret characters get exclusive parts: at least two of galaxy skin / glowing eyes / halo.
  if (secret) {
    const sr = stream('secret-parts');
    const opts = ['galaxy', 'glow', 'halo'];
    const k = sr() < 0.35 ? 3 : 2;
    const chosen = new Set<string>();
    while (chosen.size < k) chosen.add(opts[Math.floor(sr() * opts.length)]!);
    if (chosen.has('galaxy')) finish = 'galaxy';
    if (chosen.has('glow')) {
      mods.glowEyes = true;
      face.eyes = version >= 2 && sr() < 0.4 ? 'laser' : 'glow';
    }
    if (chosen.has('halo')) mods.halo = true;
  }

  const spec: CharacterSpec = {
    generatorVersion: version,
    seed,
    name: '',
    rarity: 'common',
    score,
    finish,
    palette,
    body: body.id,
    head: head.id,
    ears: ears.id,
    face,
    hat: hat.id,
    outfit: outfit.id,
    accessory: accessory.id,
    scene: scene.id,
    mods,
    tags: [],
  };
  applyRules(spec);
  spec.tags = computeTags(spec);
  spec.palette.colorTags = colorTagsOf(spec);
  spec.rarity = secret ? 'secret' : tierForScore(score, version);
  const tagsForName = spec.tags;
  spec.name = makeName(stream('name'), tagsForName.filter((t) => MOODS.has(t)), tagsForName.filter((t) => !MOODS.has(t)));
  return spec;
}

/** Visible colour tags: skin always; outfit/hat/accent only when that part is shown. */
export function colorTagsOf(s: CharacterSpec): string[] {
  const set = new Set<string>([colorName(s.palette.skin)]);
  if (s.outfit !== 'none') set.add(colorName(s.palette.outfit));
  if (s.hat !== 'none') set.add(colorName(s.palette.hat));
  if (s.accessory !== 'none') set.add(colorName(s.palette.accent));
  return [...set];
}


export function computeTags(s: CharacterSpec): string[] {
  const t = new Set<string>();
  const add = (layer: Layer, id: string) => partById(layer, id)?.tags.forEach((x) => t.add(x));
  add('body', s.body);
  add('head', s.head);
  if (!s.mods.hideEars) add('ears', s.ears);
  for (const l of FACE_LAYERS) add(l, s.face[l]);
  add('hat', s.hat);
  add('outfit', s.outfit);
  add('accessory', s.accessory);
  add('scene', s.scene);
  FINISHES.find((f) => f.id === s.finish)?.tags.forEach((x) => t.add(x));
  if (s.mods.halo) t.add('halo');
  if (s.mods.glowEyes) t.add('glow');
  if (s.palette.seasonal) t.add(s.palette.seasonal);
  for (const c of colorTagsOf(s)) t.add(c);
  return [...t].sort();
}

/** Re-roll only the face layers (Home "Face only" spin). Deterministic from the given key. */
export function randomFace(key: string, version = LATEST_GENERATOR_VERSION): FaceSpec {
  const f = {} as FaceSpec;
  for (const l of FACE_LAYERS) {
    const list = partsFor(l, version, false);
    f[l] = pickWeighted(rngFromString(`${key}|${l}`), list, (p) => p.weight).id;
  }
  return f;
}
