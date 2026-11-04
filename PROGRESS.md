# PROGRESS

Resume from this file + `SPEC.md`. Work happens on branch `ccr-20eb6c91-9t6qvs`.

## Status
| Milestone | State |
|---|---|
| 1. Skeleton, CI, keystore | done |
| 2. One beautiful character | done — `docs/screens/m2-*.png` |
| 3. Generator | done — `docs/screens/m3-contact-sheet.png`, `m3-parts-*.png` |
| 4. Spin + blind box + rarity, haptics, sounds | done — `docs/screens/m4-*.png` |
| 5. Collection, sets, save, export/import, settings | done — smoke test `npm run build && npm run smoke` |
| 6. Phase 1 polish, icon/splash, README, v0.1.0 | done — perf check `node scripts/perf.mjs` |
| 7. Coins, economy, recycling, shop | done — `tests/economy.test.ts`, `docs/screens/m7-*.png` |
| 8. Daily boxes, streaks, notifications, clock guard | done — `tests/daily.test.ts`, `docs/screens/m8-*.png` |
| 9. Order challenge | done — `tests/orders.test.ts`, `docs/screens/m9-*.png`, tuning `npx vite-node scripts/tune-orders.ts` |

## Next
- Milestone 10: achievements + profile, Phase 2 content (generator v2 live), seasonal palettes, weekly themed box.

## Waiting on the owner
- **Checkpoint A — signing secrets.** A release keystore was generated in the cloud session
  (not committed) and its base64 + password were given to the owner in chat. Owner must add
  GitHub secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`
  (`spinbuddies`), `ANDROID_KEY_PASSWORD` (same as the store password). Until then CI
  builds a debug APK and says so in the job summary.

## Decisions
- `spec.md` renamed to `SPEC.md` to match the spec's repo layout.
- Capacitor 8.6 (current stable) → JDK 21, compile/target SDK 36, AGP 8.13, Gradle 8.14.
- The workflow runs on pushes to **every** branch (not only `main`), because development
  happens on a feature branch and the owner should still get APKs.
- Seed codes: 8 chars `XXXX-XXXX` from a 32-char alphabet without 0/1/I/O (40 bits).
  Input normalisation reads I/1 as L. PRNG: sfc32 seeded by a cyrb128-style string hash.

- Rendering: `MeshPhysicalMaterial` vinyl with clearcoat, RoomEnvironment PMREM for
  reflections, NeutralToneMapping, hemisphere + key + fill + rim lights, baked radial
  contact shadow. Heads/bodies are deformed spheres (`blobGeometry`) so outfits/hats can be
  exact shells of the same shape.
- Face = a "drum" decal: UV v is the angle around the head's X axis, so scrolling the
  texture is a real drum rotation (like the physical face-changing toy). 4 cells per drum;
  blink swaps to a half-res blink texture (no re-upload).
- Thumbnails/snapshots render to the main canvas and copy in the same task (render
  targets would skip tone mapping).

- Generator: every layer has its own RNG stream keyed by `seed|v<version>|<layer>`, so
  picks never shift when another layer changes. Rarity = total surprisal (−ln p) of all
  picks; tier thresholds per generator version are calibrated on 400k seeds
  (`npx vite-node scripts/calibrate-rarity.ts`) and hard-coded in `src/gen/rarity.ts`.
  Secret (0.2%) is rolled first and gets ≥2 of galaxy skin / glowing eyes / halo.
- A golden-hash test locks generator v1 output. Phase 2 parts already exist with
  `since: 2` (v2); v2 thresholds must be recalibrated if v2 parts change before v2 ships.
- Seasonal palettes are a generator *variant* (`generateCharacter(seed, v, 'diwali')`),
  stored with the character, so seeds stay deterministic.
- Some sideways "pointy" ears were reshaped (short, upswept) to avoid resembling a famous
  film character; hats/ears/outfits/accessories each have a review sheet
  (`?dev=parts&layer=hat`).

- **Blind boxes draw from a finite numbered series pool** (Series 1 = 1,000 buddies, tier
  quotas exactly = stated odds: 600/280/100/18/2). With 40-bit random seeds exact duplicates
  would never happen, which would break the spec's duplicates/recycling economy. Home
  "Everything" spins and Order challenges still use the full seed space ("millions").
- UI is plain TS + CSS (no framework). One shared WebGL `Stage`; screens borrow it.
  Thumbnails: rendered one per frame, cached in IndexedDB (`THUMB_VERSION` in
  `src/ui/thumbs.ts` — bump when visuals change).
- Display font: Fredoka (OFL-1.1) via `@fontsource/fredoka`; everything else system font.
- Sounds are synthesised with WebAudio (no audio files, no licences needed).

- Performance: no `transmission` materials (they force an extra full-scene render pass);
  glass = clearcoated transparency. First-launch benchmark (median frame time over 90
  frames on Home) picks Low/Medium/High; skipped under automation (`navigator.webdriver`).
- Icon/splash are rendered from the 3D mascot: `node scripts/render-art.mjs` (preview on
  :4173) then `python3 scripts/make-icons.py`. Purple background for contrast.

- **Tags:** this cloud session cannot push tags (git proxy + API refuse). The workflow
  therefore auto-creates tag `v<package.json version>` + a GitHub Release on the first
  build of a new version. Releasing = bump `version` in `package.json` and push.

- Save v2 (Phase 2 fields: coins, premiumBoxes, daily, orders, achievements, redeemedGifts)
  with migration 1→2 and a test using a real v1 save.
- Shop lives in the Boxes tab (sheet). Normal boxes bought go to the pile; Premium/Themed
  open immediately. Streak Premium boxes go to a separate premium pile.

- Daily: claim sheet on start/foreground; local-midnight reset; one automatic streak
  freeze per ISO week covers one missed day; clock guard = never grant when now <
  maxSeenTime − 10 min. Notification permission is asked right after the first daily gift
  is collected (never at first launch); a single one-shot reminder is (re)scheduled each
  time (default 18:00, configurable, can be turned off). Daily login coins come with it.
- CI concurrency queues runs instead of cancelling them.

- Orders: 8 lockable slots (Face, Ears, Hat, Outfit, Holding, Scene, Colours, Shape).
  A spun character = base seed + `mix:` variant naming one seed per slot (deterministic,
  stored like any character, so 3★ results can be kept). Each spin of a slot lands on a
  helpful part with probability `luck` (Street 1 0.42, 2 0.34, 3 0.30, daily 0.32), else a
  plain random pick. Stars: all met = 3, all but one = 2, ≥ half = 1. Score = 100/req
  + 100 + 15/spare spin when complete. Coins: full for new stars, half on replays; daily
  order pays once per day. `solve()` proves solvability (incl. rule conflicts like hats
  hiding top ears / helmets removing hats).

## Open problems
- none
