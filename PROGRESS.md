# PROGRESS

Resume from this file + `SPEC.md`. Work happens on branch `ccr-20eb6c91-9t6qvs`.

## Status
| Milestone | State |
|---|---|
| 1. Skeleton, CI, keystore | done |

## Next
- Milestone 2: one beautiful character.

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

## Open problems
- none
