# Mobile builds and over-the-air updates

How TheOne's own app (`apps/mobile`) ships: native **builds** through EAS
Build, JS-only changes as **updates** through EAS Update. Read this before
`eas update`, and whenever a published update does not reach the phone.

## Channels and variants

| EAS build profile | Channel | `APP_VARIANT` | Publish JS with |
|---|---|---|---|
| `development` | `development` | `development` | `bun run update:development --message "…"` |
| `preview` | `preview` | `production` | `bun run update:preview --message "…"` |
| `production` | `production` | `production` | `bun run update:production --message "…"` |

Run the scripts from `apps/mobile`. They pin `APP_VARIANT` and the EAS
environment. A bare `eas update` picks up `.env.development`, computes the
development fingerprint and never reaches preview or production builds.

## Runtime version (fingerprint)

`app.json` sets `runtimeVersion.policy` to `"fingerprint"`. The runtime version
is a hash of everything native in the project: native dependencies in
`package.json`, config plugins and their options in `app.json` /
`app.config.ts`, `plugins/`, `modules/`, `targets/`, and so on. It is computed
per platform, so iOS and Android get different values from the same commit.

An installed app only downloads updates published for **its own** runtime
version. When the fingerprint changes, every update published afterwards gets
a new runtime version, and the installed app no longer sees any of them.

This is deliberate: a JS bundle that imports a native module the binary does
not contain would crash on launch.

### What needs a new build

Anything that changes the fingerprint, for example:

- adding, removing or upgrading a package with native code (`expo-sharing`,
  `expo-*`, `react-native-*`)
- changing a config plugin entry or its options in `app.json`
  (e.g. the `expo-notifications` `icon`)
- editing `plugins/`, `modules/*/ios|android`, `targets/`
- changing the Expo SDK, app version-related native config, permissions,
  entitlements

Plain changes under `src/` and JS-only packages ship as an update.

### Check before publishing

```bash
cd apps/mobile
eas fingerprint:compare   # compares the local fingerprint with a build or update
eas build:list --channel preview --limit 3   # runtime version of recent builds
```

If the local fingerprint differs from the build installed on the phone, an
update will not reach it. Build instead:

```bash
eas build --profile preview --platform ios      # or android / all
```

Install the new build. Updates published after it, with no further native
changes, reach it.

## Is the phone on the update?

**Settings → About** in the app shows the release channel, runtime version,
whether it launched from the embedded bundle or a downloaded update, the
running update ID, and a **Check for updates** button.

Compare its **Runtime version** with the one `eas update` printed for that
platform:

- **Same runtime version, still old**: the update downloads in the background
  and applies on the next cold start. Tap **Check for updates**; once it has
  downloaded, the screen offers a restart button that applies it.
- **Different runtime version**: the update was published for a different
  native build. "This is the latest update for this channel and runtime" is
  correct from the app's side. Make a new build (above).
- **Different channel**: the build was made with another profile. Publish to
  the channel shown on the About screen.

## Known issue: tracked Gradle output in `modules/`

`modules/theone-island/android/build/` (about 1,670 `.dex` and `results.bin`
files) is committed. Every local Gradle build rewrites it, which can change the
Android fingerprint without any real native change, so Android updates stop
matching the installed build. Fix by ignoring and untracking it:

```bash
echo 'apps/mobile/modules/*/android/build/' >> .gitignore
git rm -r --cached apps/mobile/modules/theone-island/android/build
```
