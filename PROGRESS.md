# PROGRESS

Resume from this file + `SPEC.md`. Work happens on branch `ccr-20eb6c91-9t6qvs`.

## Status
| Milestone | State |
|---|---|
| 1. Skeleton, CI, keystore | done |
| 2. One beautiful character | done — `docs/screens/m2-*.png` |
| 3. Generator | done — `docs/screens/m3-contact-sheet.png`, `m3-parts-*.png` |

## Next
- Milestone 4: spin + blind box + rarity, haptics, sounds (and the real app shell/UI).

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

## Open problems
- none
