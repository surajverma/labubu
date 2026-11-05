# Play Console — Data safety answers (current version, offline)

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (no data collected) |
| Do you provide a way for users to request that their data is deleted? | Not applicable — all data stays on the device; Settings → Reset everything deletes it |
| Data shared with third parties | None |
| Ads | **No ads** (Ads declaration: "No, my app does not contain ads") |
| In-app purchases | None |

Notes:
- Save data, thumbnails and settings are stored locally only.
- Export save files and gift codes are created on-device and only shared by the user.
- Device motion is read in memory for the shake gesture and never stored or sent.
- Microphone ("repeat after me"): audio is processed on-device only, held in memory for
  playback and discarded; never stored, transmitted or shared. Under Play's definition
  data processed only on the device is not "collected", so the answer stays **No**. The
  app declares `RECORD_AUDIO`; the in-app explanation is shown before Android's prompt.

**If online features (Phase 3, Checkpoint B) ship**, update to: *Data collected* →
"App activity › Other user-generated content" (display name, showcase buddies, scores) and
"Device or other IDs" (anonymous auth id); purpose: app functionality; encrypted in
transit: yes; users can request deletion: yes (in-app "Delete online profile").
