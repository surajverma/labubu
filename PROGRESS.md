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
| 10. Achievements, profile, Phase 2 content, seasons, themed boxes | done — `docs/screens/m10-*.png` |
| 11. Phase 2 polish + balance, v0.2.0 | done — economy sim incl. sets/achievements ≈ 4.5 boxes/day |
| 12. Share card + gift/trade codes | done — `tests/gifts.test.ts`, `docs/screens/m12-*.png` |
| 13. Play Store readiness, v0.3.0 | done — `store/`, `docs/privacy.md`, a11y audit `node scripts/a11y.mjs` |
| 14. Online features (friends, leaderboards, online trades), v0.4.0 | **blocked — Checkpoint B** (not started, per spec) |
| 15. Final review against the spec | done — see "Final review" below |

## Next
- Milestone 14 once the owner completes Checkpoint B (below). Plan: `src/online/` behind
  `FEATURES.online` (already reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; the
  workflow maps GitHub secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` to them), lazy-loaded
  `@supabase/supabase-js`, anonymous sign-in + display name; tables `profiles` (friend
  code, showcase of 6), `friendships`, `weekly_scores` (daily-order stars, rarest pull),
  `trades` (escrowed: offer removed on propose, returned on decline/cancel; both sides
  confirm) — all with Row Level Security and SECURITY DEFINER RPCs for state changes; never
  a service-role key in the app. Everything must keep working offline. Then update
  `docs/privacy.md` + `store/data-safety.md` (notes already written there) and bump to 0.4.0.

## Waiting on the owner
- **Checkpoint B — backend (blocks Milestone 14).** Create a free Supabase project, then:
  Authentication → Sign In / Providers → enable **Anonymous sign-ins**; Project Settings →
  API → copy the **Project URL** and the **anon public** key. Add them as GitHub secrets
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` (never the service-role key). Tell the next
  session they're set (or paste the URL + anon key — the anon key is public by design).
- **Checkpoint C — Play Store.** Everything is prepared in `store/` (texts, data safety,
  content rating notes, release notes, 512 icon, feature graphic, 8 screenshots) and
  `docs/privacy.md`. Owner: create a Play Console developer account (one-time fee), enable
  GitHub Pages for `/docs` (privacy URL), add the signing secrets (Checkpoint A) so CI
  produces the signed AAB, then upload `SpinBuddies-aab` and press publish.
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

- Phase 2 content is live: `LATEST_GENERATOR_VERSION = 2`, boxes draw from Series 2
  (1,200 buddies, v2 parts/finishes/scenes); Series 1 characters keep v1. Both v1 and v2
  are locked by golden-hash tests.
- Seasonal palettes (Diwali, Holi, Christmas, New Year) are active around fixed dates
  (`src/game/seasons.ts`; Diwali/Holi dates listed for 2026–2030 — extend yearly). During a
  season 40% of boxes come as that season's variant (e.g. "Diwali edition"). Themed box
  tag rotates every ISO week (`src/game/themes.ts`).
- 20 achievements (`src/game/achievements.ts`) pay coins once; profile screen from Home
  (person icon) and Settings. Toasts are queued one at a time.

- Balance pass (M11): the simulation now includes set + achievement one-offs. Result
  ≈ 4.5 boxes/day over 30 days (steady ≈ 4, onboarding burst ≈ 8–10 on days 3–5). Set
  and achievement coins were scaled ×0.6, login coins 60→50, order multipliers
  [9,13,19], daily order 20/star.

- Gift codes (`src/game/gifts.ts`): flags + seed + rarity + one-time gift id + variant data
  + 32-bit truncated HMAC-SHA256, base32 (seed alphabet) in 4-char groups. The HMAC key
  ships in the app (`VITE_GIFT_SECRET` can override at build time), so it rejects typos
  and casual tampering but is not cheat-proof — "good enough for friends". Redeemed gift
  ids are stored per device. Trade = two gifts (help sheet in Settings → Friends).
- Share card: 1080×1350 PNG (buddy in its scene + name, rarity badge with icon, seed, app
  name) via the native share sheet (Filesystem + Share), Web Share or download.

- **Bloom → rarity aura.** Post-process bloom (UnrealBloomPass) washed out the pastel
  vinyl (lit surfaces are already > 1.0 in linear HDR) and costs fill-rate on mid-range
  phones, so Epic+ get a cheap additive aura instead (glow; + rotating rays for
  Legendary/Secret; rainbow cycling for Secret). The composer is no longer bundled.
- Play policy: `SCHEDULE_EXACT_ALARM` (added by the notifications plugin) is removed via
  manifest merger — the daily reminder uses inexact scheduling. Target SDK 36.
- Accessibility: every button has an accessible name (audit script), min text 12px,
  rarity = icon + name + colour, switches use role=switch on the row, tab badges are
  announced.

## After M15 (owner requests)
- **Everything spin animation** (`CharacterView.swapWithSpin`): old buddy twirls faster and
  shrinks (0.42 s) → poof → new buddy spins in decelerating like a slot reel with
  quarter-turn ticks (0.75 s) → bounce → face drum rolls to its real face.
- **Talk to your buddy** (`src/audio/voice.ts`, `src/audio/vad.ts`): mic → voice-activity
  segmenter (noise floor × 3.2, 0.7 s hang, 0.35–6 s utterances, 0.25 s pre-roll) →
  playback as Normal / Funny (rate 1.6) / Robot (60 Hz ring mod + 9 ms comb) / Deep
  (rate 0.72). The mic is ignored while the buddy talks (no self-echo). Lip-sync: an
  analyser drives head squash/nod and swaps to a lazily painted open-mouth face texture.
  Mic permission is requested only after an in-app explanation; audio is never stored.
  Android: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`. Voice choice saved in
  `settings.voice`. Not yet verified on a real phone (only Chromium's fake mic).

## Final review (Milestone 15) — spec vs. build
Done as specified: original art only (CREDITS.md); Vite + TS strict + Three.js + Capacitor 8
with all 8 plugins; seeded generator with generator versions + golden locks; all Phase 1 +
Phase 2 part counts (tested); tags + compatibility rules; vinyl look (clearcoat physical
materials, hemi/key/rim lights, contact shadow, 1024px canvas face decals, idle bob +
blink, drag-rotate, pinch-zoom); spin by swipe/shake with haptic ticks + heavy landing,
Face-only / Everything modes; blind box shake → pop → beam → bounce with tap-to-skip; 10
starting boxes + hidden dev menu (7 taps); rarity tiers + odds screen + 100k-seed odds test;
collection book with cached thumbnails, detail (live 3D, seed, rarity, date, favourite,
rename, ×N), 16 sets with badges, filters; Preferences save with versioned migrations +
export/import; Android back button; WebAudio sounds + music with separate toggles; coins,
recycling, shop (100/400/250) with economy file + simulation; daily box + streaks + weekly
freeze + reminder + clock guard; Order challenge (lock/spin, scoring, 30 levels on 3
streets, solver-verified, tutorial, daily order); 20 achievements + profile; seasonal
palettes + weekly themed box; share card; HMAC gift codes + trading; AAB in CI (with
secrets); target SDK 36; adaptive icon, splash, feature graphic, 8 framed screenshots,
store texts, privacy policy, data safety, content rating notes, release notes;
accessibility pass; perf (DPR cap 2, < 50k tris, 200 re-rolls flat, quality benchmark);
APK ≈ 4 MB; CI with signing fallback + releases; README.

Not done / deviations (honest list):
- **Milestone 14 (online)** — waiting on Checkpoint B, by design. `src/online/` does not
  exist yet.
- **Not verified on a real phone** (this environment can't run Android): 60 fps on Home,
  cold start < 3 s, haptics feel, shake threshold, notification delivery, back button,
  share sheet, file import from Android's picker. Owner should smoke-test the APK.
- **Signed release builds / AAB** need Checkpoint A secrets; CI currently ships a debug
  APK (debug-signed APKs from different runs may not update over each other — uninstall
  first if Android refuses).
- **Bloom** is a cheap rarity aura rather than post-process bloom (see Decisions).
- **Order customers** appear as a face avatar on the order card, not as a full 3D
  character walking in (keeps one 3D subject on screen for performance).
- **Diwali/Holi dates** are hard-coded for 2026–2030 (`src/game/seasons.ts`).
- Releases: tags can't be pushed from cloud sessions, so CI auto-creates `v<version>`
  releases on the first build of each new `package.json` version.
- Development happened on branch `ccr-20eb6c91-9t6qvs`; nothing is merged to `main` (no PR
  was requested). CI runs on every branch.

## Open problems
- none known beyond the list above.
