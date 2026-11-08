# Assets and third-party material

This repository has **no open-source licence**. Its source code and original assets are © the P.A.I.D. author, all rights reserved. They are published so the project can be read, reviewed and built, and are not offered for reuse. The fonts and sound sources below are third-party works and stay under their own terms.

## Fonts: SIL Open Font License 1.1

| Files | Family | Copyright | Licence text |
|---|---|---|---|
| `src/assets/fonts/AtkinsonHyperlegible-{Regular,Bold,Italic}.woff2` | Atkinson Hyperlegible | © 2020 Braille Institute of America, Inc. | `src/assets/fonts/AtkinsonHyperlegible-OFL.txt` |
| `src/assets/fonts/Lexend-SemiBold.woff2` | Lexend | © 2018 The Lexend Project Authors | `src/assets/fonts/Lexend-OFL.txt` |
| `src/assets/fonts/IBMPlexMono-Regular.woff2` | IBM Plex Mono | © 2017 IBM Corp. | `src/assets/fonts/IBMPlexMono-OFL.txt` |

These are unmodified upstream files. Sources and checksums are in `src/assets/fonts/PROVENANCE.md`.

## Sound effects

The 45 cues in `src/assets/audio/*.ogg` are processed renders: trimmed, filtered, layered and levelled. Each cue's sources are listed in `src/assets/audio/PROVENANCE.md`.

| Source | Cues using it | Terms supplied with the source |
|---|---|---|
| Original synthesis (`scripts/build-sound-cues.ts`) | 7 cues use only this source, and 3 more include a synthesized layer | © the P.A.I.D. author |
| *Free Natural SFX Pack* by [cicifyre](https://cicifyre.itch.io/) | 23 cues | `NaturalSFX-readme.txt`: royalty free; credit appreciated |
| *Clean UI – 20 Minimal Interaction Sounds* by R4orce | 15 cues | `CleanUI-License.txt`: use in apps permitted; no redistribution or sharing as standalone files |
| *Soft Signal Free Minimal UI SFX Pack* | 9 cues | `SoftSignal-LICENSE.txt`: distribution only as an integrated part of a project, not as standalone files |
| *Smart UI* by Epic Stock Media | 1 cue (`startup-tone.ogg`) | `ESM-NOTICE.txt`: "© Epic Stock Media, All Rights Reserved"; no licence agreement on file |
| "MACOS GOLDEN GATE SFX" folder | 1 layer of `activity-complete.ogg` | `MACOS-RISK-ACCEPTANCE.txt`: no licence or attribution on file |

Some cues layer more than one source, so the counts add up to more than 45.

**Owner decision (2026-11-08).** The project owner chose to publish these processed cues in this public repository and in the Android app, unchanged. Several of the supplied licences restrict redistribution of the sounds as standalone files, and two sources have no licence on file. Publishing them here records the owner's own risk decision. **It is not a licence from the rights holders, and it grants no one else any right to reuse these sounds.** Do not extract them for other projects.

**Rights holders:** if you believe a file here infringes your rights, please open an issue or contact the repository owner through GitHub, and it will be dealt with promptly.

## App icon and splash

The launcher icon and splash screens were drawn for P.A.I.D. (`docs/images/icon-foreground.svg`) and are rendered by `scripts/render-icons.mjs`. They are © the P.A.I.D. author.

## Software dependencies

npm packages are installed from the registry and are not stored in this repository. Each is under its own licence; see `node_modules/<package>/LICENSE` after `npm ci`. The Android build includes Capacitor (MIT) and AndroidX libraries (Apache-2.0).
