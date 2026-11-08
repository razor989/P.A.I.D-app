# Building P.A.I.D. from source

This guide covers the web app, the checks and the Android APK. The *Verified* column records whether each command was run successfully from a fresh clone of the repository on 2026-11-08 (Windows 11, Node 24.21.0, npm 11.19.0, JDK 21, Android SDK 36).

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 24.x (`engines` in `package.json`) | Everything |
| npm | 11.x (`packageManager`: 11.19.0) | Everything |
| Chromium for Playwright | installed by `npx playwright install chromium` | Browser test suites only |
| JDK | 21 (the JetBrains Runtime bundled with Android Studio works) | Android |
| Android SDK | Platform 36, with `ANDROID_HOME` set (or `sdk.dir` in an untracked `android/local.properties`) | Android |
| Gradle | 8.14.3, downloaded automatically by the wrapper | Android |

## 1. Get the source and install dependencies

```sh
git clone https://github.com/razor989/P.A.I.D-app.git
cd P.A.I.D-app
npm ci
```

`npm ci` installs exactly what `package-lock.json` specifies (verified; it takes several minutes the first time).

Line endings: `.gitattributes` checks every text file out with LF line endings, even with Git's `core.autocrlf=true` on Windows. Some tests compare source files byte for byte, so do not override this.

## 2. Run the app in a browser

```sh
npm run dev
```

This serves the app with hot reload; Vite prints the local URL. To preview the production build, run `npm run build`, then `npm run preview`.

## 3. Checks

| Command | What it checks | Verified |
|---|---|---|
| `npm run typecheck` | TypeScript, both app and tooling configs | ✓ |
| `npm run lint` | ESLint, including the layer-boundary rules (see [ARCHITECTURE.md](ARCHITECTURE.md)) | ✓ |
| `npm run format:check` | Prettier formatting | ✓ |
| `npm run validate:content` | Integrity of the content bank and the oracle inventory | ✓ |
| `npm test` | **All** unit and component tests (`vitest run`; about 1,600 tests, roughly 5 minutes) | ✓ |
| `npm run verify` | All of the above, in order (the same set CI runs, minus the build) | ✓ (each step) |
| `npm run test:coverage` | The same tests, with V8 coverage | not run |
| `npm run test:e2e` | Playwright end-to-end tests, desktop Chromium | not run |
| `npm run test:a11y` | Playwright + axe-core accessibility tests | not run |
| `npx playwright test --project=phone --project=phone-360 --project=phone-384 --project=phone-landscape` | Phone layouts | not run |

`npm run test:unit` and `npm run test:component` run only the toolchain smoke tests in `tests/helpers/`. Use `npm test` for the full suite. Playwright starts its own Vite server on port 4179.

## 4. Build the web app

```sh
npm run build
```

The output goes to `dist/`. Verified ✓.

## 5. Build the Android app

```sh
npm run android:sync          # vite build + cap sync android
cd android
./gradlew assembleDebug       # Windows: gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Verified ✓: both steps succeed from a fresh clone (the first Gradle run downloads Gradle and its dependencies and takes a few minutes).

`cap sync` copies `dist/` into `android/app/src/main/assets/public/` and regenerates the Capacitor plugin files. Those are build products and are git-ignored. To work in Android Studio, open the `android/` folder, or run `npx cap open android`.

Install on a connected device with USB debugging enabled:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

A **debug** APK is signed with your machine's debug key. It is fine for testing, but it is not a release build. How releases are built, and why the debug keystore must be kept, is covered in [RELEASING.md](RELEASING.md).

## App icon

The launcher icons and splash screens are rendered from `docs/images/icon-foreground.svg`:

```sh
node scripts/render-icons.mjs
```

This uses the Playwright Chromium (`npx playwright install chromium`). The adaptive-icon background colour is in `android/app/src/main/res/values/ic_launcher_background.xml`.

## Sound cues

The `.ogg` files in `src/assets/audio/` are build inputs and are not regenerated during a normal build. `scripts/build-sound-cues.ts` re-renders them from `scripts/sound-recipe.ts`. That requires ffmpeg with libopus and the original third-party sound libraries, which are licensed to the project owner and are not distributed. See `src/assets/audio/PROVENANCE.md`.

## What is and isn't in Git

| Tracked | Generated and ignored | Never commit |
|---|---|---|
| `src/`, `tests/`, `scripts/`, configs, `package-lock.json`, `android/` project sources, the Gradle wrapper, `capacitor.config.ts` | `node_modules/`, `dist/`, `coverage/`, `test-results/`, `playwright-report/`, `.tmp/`, `android/.gradle/`, `android/**/build/`, `android/app/src/main/assets/public/`, `android/capacitor-cordova-android-plugins/`, the synced `capacitor.*.json` files, `*.apk`, `*.aab` | Keystores (`*.jks`, `*.keystore`), `keystore.properties`, signing passwords, `android/local.properties` |
