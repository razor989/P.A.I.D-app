# Releasing

P.A.I.D. is distributed as an APK attached to a GitHub Release. Releases are **development-signed**: they carry the debug signature that the Android build tools create automatically. No separate release key is used.

## Versioning

- Use [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
- Keep three places in step:
  - `package.json` `version`: run `npm version X.Y.Z --no-git-tag-version`, which also updates `package-lock.json`.
  - `android/app/build.gradle` `versionName "X.Y.Z"`.
  - `android/app/build.gradle` `versionCode`: an integer. **Increase it by 1 for every release.** Android refuses to install a lower `versionCode` over a higher one.
- Tag the release commit `vX.Y.Z`.

## The signing key (read this once)

`assembleDebug` signs the APK with the debug keystore of the machine that builds it. On Windows that is `%USERPROFILE%\.android\debug.keystore`; on macOS and Linux it is `~/.android/debug.keystore`.

- **Always build releases on the same machine, or copy that keystore to the new one.** Android installs an update only if it is signed with the same key as the installed app. An APK built with a different debug key can only be installed after the learner uninstalls the old app, and that uninstall **deletes their saved progress**.
- **Back up `debug.keystore`** somewhere outside this repository. Never commit it: `*.keystore` is git-ignored.
- Debug-signed APKs are marked debuggable and cannot be published on Google Play. That is acceptable for research distribution through GitHub.

## Checklist

1. Make sure `master` is clean and CI is green.
2. Bump the version as described above, and add a `CHANGELOG.md` entry.
3. Commit, then tag the commit (`git tag vX.Y.Z`).
4. Build from that commit:
   ```sh
   npm ci
   npm run verify
   npm run android:sync
   cd android && ./gradlew clean assembleDebug    # Windows: gradlew.bat
   ```
5. Copy `android/app/build/outputs/apk/debug/app-debug.apk` to `PAID-vX.Y.Z.apk`.
6. Record its checksum: `sha256sum PAID-vX.Y.Z.apk` (Windows PowerShell: `Get-FileHash PAID-vX.Y.Z.apk`).
7. Install it on a physical device and check startup, a lesson, saving and resuming, Back, and sound.
8. Push the commit and tag, then create the release:
   ```sh
   gh release create vX.Y.Z PAID-vX.Y.Z.apk --prerelease --title "P.A.I.D. vX.Y.Z" --notes-file notes.md
   ```

## Release notes template

```markdown
Research build of P.A.I.D. vX.Y.Z, built from commit <full SHA>.

**Contents:** Overtime Pay, Percentage Change and Commission, four activities each.
**Requires:** Android 7.0 or newer. Works offline.
**Install:** download the APK, open it, and allow installation from your browser or file manager when asked.

**SHA-256:** `<checksum>`  PAID-vX.Y.Z.apk

This is a development-signed research build. Its effect on learning has not been evaluated.
<What changed since the last release>
```
