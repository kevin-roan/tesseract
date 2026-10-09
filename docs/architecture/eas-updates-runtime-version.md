# EAS updates and runtime versions

Why an `eas update` can publish without errors and still never reach the phone,
and how to publish so it does.

## TL;DR

Always publish with the package scripts in `apps/mobile`:

```sh
bun run update:preview --message "..."
bun run update:production --message "..."
bun run update:development --message "..."
```

Do not run a bare `eas update --channel preview`. It publishes an update for the
**Dev** app variant, and preview/production builds never download it.

## How EAS decides which update a device gets

A device asks the update server for updates that match two things:

1. **Channel.** This is baked into the build from the `eas.json` profile
   (`development`, `preview`, `production`). The channel points to a branch
   with the same name.
2. **Runtime version.** This is also baked into the build. An update is only
   served to builds with the *same* runtime version. That rule keeps JS that
   expects native code a build doesn't have from loading.

If either one doesn't match, the server sends nothing. The device keeps running
its embedded bundle, and nothing shows an error.

## Our runtime version is a fingerprint

`app.json` uses:

```json
"runtimeVersion": { "policy": "fingerprint" }
```

The runtime version is a hash (`@expo/fingerprint`) of everything that affects
the native app: native dependencies, config plugins, `ios/`/`android/` inputs,
**and the resolved Expo app config**. Any change to the resolved config gives a
new hash, even if the change is only to `name` or `bundleIdentifier`.

The hash is computed twice:

- at **build** time on EAS, and stored in the binary;
- at **update** time on your machine, when `eas update` runs ("Computed project
  fingerprints").

The two only match if both runs resolve the *same* app config.

## Why the config differs: `APP_VARIANT`

`apps/mobile/app.config.ts` changes the app identity based on `APP_VARIANT`:

| `APP_VARIANT` | name | iOS bundle id / Android package |
|---|---|---|
| `production` (default) | `Tesseract` | `com.kevinroan.tesseract` |
| `development` | `Tesseract Dev` | `com.kevinroan.tesseract.dev` (+ `.dev.share`, `.dev.island`) |

Where the value comes from:

- **EAS builds:** the `env` block of the profile in `eas.json`. `preview` and
  `production` set `APP_VARIANT=production`.
- **`update:*` scripts:** set `APP_VARIANT` explicitly in `package.json`.
- **Anything else run locally** (`expo start`, bare `eas update`, ...): Expo
  loads `apps/mobile/.env.development`, which contains
  `APP_VARIANT=development`. Expo CLI reads `.env.development` when evaluating
  the config outside a production build, so it wins over the `'production'`
  default in `app.config.ts`.

So a bare `eas update --channel preview` resolves the config as **Tesseract Dev**,
hashes it, and publishes the update under the Dev runtime version, on the
`preview` branch. No build on `preview` has that runtime version, so no device
picks it up.

An explicit `APP_VARIANT=production` in the shell takes priority over
`.env.development`, because dotenv doesn't overwrite variables that are already
set. That's why the scripts work.

## The incident (2026-10-09)

Command run: `eas update --channel preview --message "more; features"`

| | iOS runtime version |
|---|---|
| Installed preview build (commit `930a6ef`) | `2747761a263f476cfa3dfc41bb295637460a88d2` |
| Published update | `5b1bb7723141cb16eae2b6d1fa8901150ff6c6e7` |

`eas fingerprint:compare 2747761a… 5b1bb772…` showed only these differences:
`name`, `bundleIdentifier`, `package`, and the extension bundle ids. All of them
went from the production values to the `.dev` values.

Computing the fingerprint locally with `APP_VARIANT=production` gave
`2747761a…` again, an exact match for the build. Republishing with
`bun run update:preview` fixes it.

Android had a second, separate problem: the last Android preview build had
**errored**, so no Android device had a preview build that could receive
updates.

## Checklist when an update doesn't arrive

1. Did you publish with `bun run update:<channel>`?
2. Compare the runtime version printed by `eas update` with the build's:
   ```sh
   npx eas-cli build:list --channel preview --limit 4 --json \
     | jq '.[] | {platform, status, runtimeVersion}'
   ```
3. If they differ, find out why:
   ```sh
   npx eas-cli fingerprint:compare <build-hash> <update-hash>
   ```
   - Only app config identity fields differ → wrong `APP_VARIANT`; republish
     with the script.
   - Native deps/plugins differ → the native app really changed; you need a new
     build, and an update can't fix it.
4. Make sure a **finished** build exists on that channel for that platform.
5. On the device: the update downloads on one launch and applies on the **next**
   launch (`fallbackToCacheTimeout: 0`). Kill the app and open it twice.

To check the fingerprint locally without publishing:

```sh
cd apps/mobile
APP_VARIANT=production npx expo-updates fingerprint:generate --platform ios | jq -r .hash
```
