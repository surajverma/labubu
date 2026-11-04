
# SpinBuddies — Full Build Spec (Phases 1–3)

> Working title. App name, character name and app ID are placeholders: change them in
> one config file (`src/config.ts` + `capacitor.config.ts`) at any time.
> Placeholder app ID: `com.spinbuddies.app`.

## 0. How to use this spec (for Claude)

- Build **Phase 1 → Phase 2 → Phase 3** in order, milestone by milestone (section 12).
- Keep **`PROGRESS.md`** in the repo root, updated and committed after every milestone:
  what is done, what is next, open problems, decisions made, and anything waiting on the
  owner. A new session must be able to resume from `PROGRESS.md` + this spec alone.
- After each milestone: run tests, take screenshots, commit, push (the APK builds
  automatically), update `PROGRESS.md`.
- **Do not stop between milestones to ask for approval.** Stop only at the
  **OWNER CHECKPOINTS** listed in section 13 (things only the owner can do, such as
  creating accounts or adding secrets). When blocked by one, finish all other work that
  does not depend on it first, then report clearly what the owner needs to do.
- When a choice is unclear, pick the sensible option, record it in `PROGRESS.md` under
  "Decisions", and continue.

## 1. What we are building

A collectible "blind box" toy app for Android. The player collects cute, chunky 3D
vinyl-toy characters. Swiping or shaking spins the character's face like a real
face-changing figure, and opening a blind box reveals a brand-new random character. Body,
ears/horns, hat, outfit, face, colours and the 3D scene around it all vary, giving
millions of combinations. Every character has a rarity. Players fill a collection book,
complete sets, take on daily challenges, and share and swap characters with friends.

Audience: the owner, family and friends first (installed APK); then the Play Store.

### Hard rule: original art only
The mascot must be an **original character**. Do not copy, imitate or reference Labubu,
Pop Mart, Sanrio, Disney or any other existing character or brand, in shapes, names, text
or assets. No downloaded models, textures, fonts or sounds unless their licence allows
commercial use (CC0 preferred); record each one in `CREDITS.md`.

## 2. Tech stack

- **Vite + TypeScript** (strict mode), **Three.js** for 3D. Plain TS + CSS for UI
  (Preact allowed if the UI grows; keep the bundle small).
- **Capacitor** (latest stable) wraps the web build into a native Android app.
  Plugins: `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/share`,
  `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/app`,
  `@capacitor/splash-screen`, `@capacitor/status-bar`.
- **GitHub Actions** builds the APK (and later the AAB) on every push to `main`.
- Tests: Vitest for logic; Playwright (already installed in the cloud session, do not
  reinstall) for screenshots of the web build.

### Cloud session constraints (important)
- npm works. **Google Maven, dl.google.com and services.gradle.org are blocked** in the
  cloud session, so **never run Gradle or try to build the APK locally**.
  `npx cap add android` and `npx cap sync android` work (templates come from npm).
  APK/AAB builds happen only in GitHub Actions. Use `gh run list` / `gh run view --log-failed`
  to check builds and fix failures.
- Verify visuals with `npm run build && npx vite preview` plus Playwright screenshots at a
  phone viewport (412×915, deviceScaleFactor 1). Look at every screenshot and fix
  problems before committing.
- If the WebGL canvas renders blank in headless Chromium, launch with
  `--use-gl=swiftshader` (or `--use-angle=swiftshader`).

## 3. Character system

### 3.1 Seeded generation
- Every character is fully defined by a **seed** (short code, e.g. `K7Q-2MX9`, base32
  without look-alike characters).
- Seeded PRNG (mulberry32 or sfc32). Same seed → identical character on every device.
- `generateCharacter(seed) → CharacterSpec` (pure data, unit-tested) and
  `buildCharacter(spec) → THREE.Group` (rendering). Keep them separate.
- Include a `generatorVersion` in saved characters. Never change what an existing seed
  produces; new parts only appear through a new generator version, so collections never
  change after an update.

### 3.2 Parts (data-driven; adding a part = editing a data file)

| Layer | Phase 1 | Phase 2 adds | Notes |
|---|---|---|---|
| Body shape | 6 | +2 | chubby bean, tall capsule, round ball, pear, square-ish, tiny |
| Head shape | 5 | +2 | round, wide, egg, squircle, bun |
| Ears / horns / antenna | 12 | +6 | bunny, cat, bear, pointy, horns, antenna, leaf sprout, none… |
| Eyes (decal) | 20 | +10 | dots, big shiny, sleepy, wink, star, heart, swirl, angry… |
| Eyebrows (decal) | 8 | +4 | incl. none |
| Mouth (decal) | 18 | +8 | toothy grin, tiny smile, open "o", tongue out, fang, pout… |
| Nose (decal) | 6 | +2 | heart, dot, triangle, none… |
| Cheeks (decal) | 6 | +4 | blush circles, freckles, stickers, none |
| Hat / headwear | 14 | +8 | bucket hat, beanie, crown, pirate hat, hood, flower, none… |
| Outfit | 14 | +8 | overalls, hoodie, raincoat, astronaut suit, dress, jersey, none… |
| Accessory | 10 | +8 | balloon, backpack, scarf, wand, none… |
| Scene | 10 | +6 | beach, snowy night, space, bedroom, candy land, forest, rooftop, underwater, clouds, studio |
| Skin finish | glossy, matte | +pearl, glitter, metallic, galaxy (Secret only) | |
| Colour palette | generated | + seasonal palettes | HSL harmony rules: analogous, complementary, pastel, neon |

Every part has **tags** (e.g. `space`, `cozy`, `pirate`, `sleepy`, `red`, `snow`) used by
sets and the Order challenge. Compatibility rules prevent ugly or impossible combos
(a hood hides ears; a helmet replaces the hat; long ears + tall hat → shorten ears, etc.).

### 3.3 Look and feel (most important; spend real time here)
- **Vinyl toy style**: chunky rounded forms built in code (spheres, capsules, lathe and
  rounded-box geometry, tubes for limbs). Big head, small body (~1.3 : 1). No sharp edges.
- Materials: `MeshPhysicalMaterial` with clearcoat for glossy vinyl; matte for fabric.
  Studio lighting: hemisphere + key + rim light, plus a soft baked contact shadow.
  Bloom only for Epic and above.
- **Faces are decals**: each part drawn with Canvas2D into a 1024px `CanvasTexture` on the
  front of the head; clean vector-style shapes, crisp outlines, eye highlights.
- Idle animation (gentle bob/breathing, occasional blink); drag to rotate; pinch to zoom.
- Scenes: simple, low-poly, stylised backdrops + gradient sky; never busy.

## 4. Phase 1 — Core toy

### 4.1 Spin
- Swipe up/down on the face, or shake the phone (DeviceMotion; permission handled), →
  the face panel spins like the real toy: fast spin, slow down, little bounce, lands on a
  new expression. Haptic ticks while spinning, heavier haptic on landing.
- Modes: **Face only** (default) / **Everything** (full re-roll with a "poof" transition).
- Spinning on Home is a free toy (does not change collected characters).

### 4.2 Blind box
- 3D box shakes, lid pops, light beam rises in the rarity colour, character appears with a
  bounce. Tap to skip. The new character is added to the collection.
- Start with 10 boxes. Debug "+10 boxes" button in a hidden dev menu (tap the version
  number 7 times in Settings).

### 4.3 Rarity
- Each part has a rarity weight; character rarity derives from its total score.
- Tiers: Common (grey) ~60%, Rare (blue) ~28%, Epic (purple) ~10%, Legendary (gold) ~1.8%,
  **Secret** (rainbow) ~0.2%. Secret characters get exclusive parts (galaxy skin, glowing
  eyes, halo…).
- Odds screen in Settings (Play Store requirement in some regions). A unit test checks
  that 100,000 generated seeds match the stated odds within tolerance.

### 4.4 Collection book
- Grid of collected characters (thumbnails rendered once and cached as images).
- Detail view: live 3D, seed code, rarity, date found, favourite, rename, ×N duplicates.
- **Sets**: 8 in Phase 1 (e.g. "Space Crew": 5 characters with `space` parts; "Hat
  Collector": 10 different hats). Progress bars; completing a set gives a badge.
- Filters: rarity, favourites, set, newest.

### 4.5 Save data
- Capacitor Preferences (localStorage fallback on web); characters stored as seeds +
  metadata, never as images. Versioned schema (`saveVersion`) with migrations from day one.
- Export/import save as a file (Filesystem + Share) so nothing is lost when changing phones.

### 4.6 Screens & UI
Home (current favourite + spin), Open Box, Collection, Character detail, Settings
(sound, music, haptics, notifications, odds, credits, export/import, reset). Bottom tab
bar. Large touch targets, playful rounded UI, one licence-checked display font + system
font. Support Android back button correctly.

### 4.7 Sound
Short CC0 or code-generated (WebAudio) sounds: spin tick, land, box shake, pop, rarity
fanfare, UI tap. Optional soft background loop (CC0). Separate toggles.

## 5. Phase 2 — Game loop

### 5.1 Coins & economy
- Coins earned from: daily login, Order challenges, completing sets, duplicates.
- **Duplicates**: "Recycle" a duplicate for coins (Common 5, Rare 15, Epic 50,
  Legendary 200, Secret: cannot be recycled).
- Shop (coins only, **no real money**): Blind box 100 coins; Premium box 400 (no Commons);
  Themed box 250 (guaranteed tag, e.g. Space week).
- Put all numbers in `src/game/economy.ts` and add a simulation test that checks a normal
  player earns about 3–5 boxes per day.

### 5.2 Daily boxes & streaks
- One free box per day (local midnight); streak bonus: day 3 = 2 boxes, day 7 = Premium box.
- Missing a day resets the streak, but one "streak freeze" per week is automatic.
- Local notification at a sensible time (default 6 pm, configurable, can be turned off):
  "Your daily box is ready!" Ask for notification permission at a friendly moment, not
  at first launch.
- Guard against clock changes (if device time jumps backwards, don't grant extra boxes).

### 5.3 Order challenge (main game)
- A customer character arrives with an **order card**: 3–5 requirements built from tags,
  e.g. "sleepy face · pirate hat · snowy scene · something red".
- The player starts from a random character and **re-spins** it slot-machine style:
  tap a layer to **lock** it, spin the rest. Limited spins (e.g. 8).
- Scoring: each met requirement = points; bonus for leftover spins; stars (1–3).
  Coins = stars × level multiplier. A 3-star result can be **kept** in the collection.
- **Levels**: 30 handcrafted orders in Phase 2 across 3 "streets", rising difficulty
  (more requirements, fewer spins, harder tags). Unlock the next street by earning stars.
- **Daily order**: one generated order per day, the same for everyone (seeded by date),
  for bragging rights.
- Tutorial for the first order (short, skippable).
- Generated orders must always be solvable: verify with a solver function in tests.

### 5.4 Achievements
20 achievements (first box, first Secret, 7-day streak, complete 3 sets, 50 orders…).
Each gives coins and a badge; shown on a profile screen.

### 5.5 More content
Phase 2 part additions from the table in 3.2, 8 more sets, seasonal palettes that are
active on certain dates (Diwali, Holi, Christmas, New Year), and a themed box rotating weekly.

## 6. Phase 3 — Friends & Play Store

### 6.1 Share card (offline)
- Render a beautiful image card (character in its scene, name, rarity badge, seed code,
  app name) to PNG and open the Android share sheet.

### 6.2 Gift / trade codes (offline, no backend)
- A player can **gift** a character: it is removed from their collection and they get a
  gift code (e.g. `GIFT-K7Q2-MX9A-…`) to send to a friend; entering it adds it to the
  friend's collection.
- Codes contain seed + rarity + a one-time ID + checksum/HMAC with an app secret, so typos
  and casual tampering are rejected. Each gift ID can be redeemed only once per device.
  (This is "good enough for friends", not cheat-proof; document that.)
- **Trade** = both players gift each other a character.

### 6.3 Online features (needs a backend: OWNER CHECKPOINT B)
- Use **Supabase** free tier (or Firebase if the owner prefers): anonymous sign-in with a
  display name, no email or personal data required.
- **Friends**: add by friend code; see friends' showcase (top 6 characters).
- **Leaderboards**: weekly daily-order stars, rarest pull this week; friends tab + global.
- **Trade requests** (online version of 6.2) with confirmation from both sides.
- Row Level Security on every table; never ship a service-role key in the app.
- Everything must still work offline; online features fail gracefully.
- Before building this, finish all offline features of Phase 3, then stop at
  Checkpoint B and ask the owner to create the project and provide the public URL and
  anon key (stored as build-time env vars / GitHub secrets, not committed).

### 6.4 Play Store readiness
- Build signed **AAB** in GitHub Actions (`bundleRelease`) next to the APK.
- Target the current Play Store target-SDK requirement; check the Android Gradle Plugin
  and Capacitor versions support it.
- App icon (adaptive icon, original art), splash screen, feature graphic (1024×500),
  6–8 phone screenshots captured with Playwright and framed.
- `store/` folder: listing text (short + full description), privacy policy (`docs/privacy.md`,
  publishable with GitHub Pages), Data Safety answers, content rating notes, release notes.
- Accessibility: readable font sizes, colour-blind-safe rarity (icons + colour, not only
  colour), content descriptions on buttons.
- No ads, no real-money purchases, no analytics unless the owner asks later.

## 7. Performance budget (mid-range Android phone)
- 60 fps target on Home; never below 30 anywhere.
- Cap `devicePixelRatio` at 2; < 50k triangles per scene; merged/reused geometry and
  materials; dispose of everything on re-roll (no leaks: test 200 re-rolls in a row and
  check memory stays flat).
- Cold start to interactive < 3 s. APK < 40 MB.
- Quality setting (Low/Medium/High) auto-picked from a short benchmark on first launch.

## 8. Android build via GitHub Actions

`.github/workflows/android.yml`:
- Triggers: push to `main`, tags `v*`, and manual `workflow_dispatch`.
- Steps: checkout → Node LTS → `npm ci` → `npm test` → `npm run build` → Java (the JDK
  version the installed Capacitor version requires; 21 for Capacitor 7+) → Android SDK →
  `npx cap sync android` → `./gradlew assembleRelease bundleRelease` (or `assembleDebug`
  without signing secrets) → upload artifacts `SpinBuddies-apk` and `SpinBuddies-aab`.
- On tags `v*`: create a GitHub Release with the APK attached (easy link for family).
- `versionCode` = GitHub run number; `versionName` from `package.json`.
- **Signing (OWNER CHECKPOINT A)**: each runner creates a new debug key, and Android won't
  install an update signed with a different key. So:
  - Generate one release keystore in the session with `keytool`.
  - **Do not commit it.** Print its base64 and the passwords once and tell the owner to
    save them in a password manager and add GitHub secrets: `ANDROID_KEYSTORE_BASE64`,
    `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Warn: losing
    the keystore means updates can never be installed over the old app or published.
  - Until the secrets exist, the workflow falls back to a debug build and says so in the
    job summary. Do not wait for this; keep building.
- `.gitignore`: keystores, `*.jks`, `.env*`, `android/app/build`, `node_modules`, `dist`.

## 9. Repo structure
```
src/
  config.ts            app name, IDs, feature flags, tunables
  rng.ts               seeded PRNG + seed codes
  gen/                 parts data, tags, rarity, compatibility rules, generateCharacter
  render/              renderer, lights, materials, character builder, face decals, scenes, thumbnails
  ui/                  screens, tab bar, transitions, tutorial
  game/                boxes, collection, sets, economy, daily, orders (+ solver), achievements, gifts
  online/              Supabase client + features (Phase 3, behind a feature flag)
  audio/
  save/                schema, migrations, export/import
tests/
store/  docs/privacy.md
.github/workflows/android.yml
SPEC.md  PROGRESS.md  CREDITS.md  README.md
```

## 10. Quality bar
- TypeScript strict, no `any` without a comment; ESLint + Prettier.
- Unit tests for: generation determinism, rarity odds, compatibility rules, economy
  simulation, order solver, streak/clock logic, save migrations, gift code validation.
- Playwright smoke test: app loads, a box opens, collection shows the new character.
- README: what the app is, how to install the APK on a phone, how to develop, how releases work.

## 11. Look-review loop (repeat whenever visuals change)
1. Screenshot Home, Open Box, Collection and a contact sheet of 24 random characters.
2. Review honestly: does it look like a premium collectible toy, or a programmer demo?
   Check proportions, clipping, colour harmony, face readability, scene clutter.
3. Fix and repeat until good. Save final screenshots in `docs/screens/` (committed) so the
   owner can see progress on GitHub.

## 12. Milestones

**Phase 1**
1. Skeleton: Vite + TS + Three.js + Capacitor Android, placeholder scene, GitHub Actions
   producing an APK, `PROGRESS.md`. Keystore generated (Checkpoint A message).
2. One beautiful character: hand-tuned materials, lighting, proportions, face decal
   (use the look-review loop).
3. Generator: all Phase 1 parts, palettes, compatibility rules, seeds, tests, contact sheet.
4. Spin + blind box + rarity, haptics, sounds.
5. Collection book, sets, save data, export/import, settings.
6. Phase 1 polish: transitions, performance, icon and splash, README. Tag `v0.1.0`.

**Phase 2**
7. Coins, economy, recycling, shop.
8. Daily boxes, streaks, notifications, clock guard.
9. Order challenge: lock/spin, scoring, 30 levels, solver, tutorial, daily order.
10. Achievements, profile, Phase 2 content, seasonal palettes, themed boxes.
11. Phase 2 polish + balance pass. Tag `v0.2.0`.

**Phase 3**
12. Share card + gift/trade codes.
13. Play Store readiness: AAB, icons, screenshots, store texts, privacy policy,
    accessibility. Tag `v0.3.0`.
14. Online features (after Checkpoint B): friends, leaderboards, online trades. Tag `v0.4.0`.
15. Final review against this spec; list anything not done in `PROGRESS.md`.

## 13. OWNER CHECKPOINTS (the only reasons to stop and wait)
- **A — Signing secrets** (Milestone 1): owner adds 4 GitHub secrets. Do not wait; keep
  building with debug builds meanwhile.
- **B — Backend** (Milestone 14): owner creates a Supabase project and gives the URL +
  anon key. Do everything else first.
- **C — Play Store** (after Milestone 13): owner creates a Play Console developer account
  (one-time fee) and uploads the AAB. Claude prepares everything; the owner presses publish.
- Also ask first before: any paid service, real-money purchases, ads, analytics, or
  collecting any personal data.
