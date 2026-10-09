# Upgrading an install from TheOne / Monolith to Tesseract

The product used to be called **TheOne** (sandbox, mobile app, repository) and **Monolith**
(desktop app, sync CLI). Everything is now **Tesseract**: env keys `TESSERACT_*`, compose
project `tesseract`, volumes `tesseract-*`, image `tesseract/sandbox`, default tailnet hostname
`tesseract-sandbox`, mobile app `com.kevinroan.tesseract`, deep links `tesseract://`. Names
and defaults: [blueprint §3](../architecture/00-blueprint.md#3-fixed-names-ports-paths).

Fresh installs need nothing from this page. An existing install is migrated automatically;
the manual part is the phone (§4), the desktop CLI link (§5) and, for maintainers, the mobile
build setup (§6).

**Upgrade the sandbox and the mobile app together.** The new controller only works with the
new app (pairing links, `tesseract://` scheme, in-page message names), and the new app is a
fresh install anyway (§4).

## 1. Sandbox stack (automatic)

Runs before the stack starts, in `bun run sandbox <command>` (env file on every command, Docker
steps on `up`), the desktop app's sandbox start, and `tesseract server install`. Every step is
skipped when there is nothing to do.

| Step | What happens |
|---|---|
| Env file | `THEONE_*` / `MONOLITH_*` keys become `TESSERACT_*` (when both exist, `THEONE_` wins; an existing `TESSERACT_*` key is left alone). The original is saved as `<env file>.legacy-backup` (a timestamp is appended if that exists). Values that were the old defaults change too: project and volume prefix `theone`/`monolith` → `tesseract`, image `theone/sandbox:latest` → `tesseract/sandbox:latest`. **The hostname value is kept** (§3) |
| Shell environment | exported `THEONE_*` / `MONOLITH_*` variables count as `TESSERACT_*`, with a warning (`bun run sandbox` only). Rename them in your shell profile |
| Old stack | a running compose project `theone` is stopped with `docker compose -p theone down` (no `-v`: volumes are kept) |
| Image | not reused: `tesseract/sandbox:latest` is built (`up` builds it when missing; the desktop app asks for a build). The old image's controller is `theone-controller` and hands out `theone://` links, which the new apps cannot discover or pair with |
| Volumes | `theone-{workspace,home,tailscale,dind-certs,dind-data}` are moved to the missing `tesseract-*` ones, once (marker `~/.local/state/tesseract/legacy-volumes.tesseract.migrated`, `$XDG_STATE_HOME` honoured). Docker cannot rename a volume, so each is copied and the old one removed right after the copy succeeds; only one large volume is ever on the disk twice. A failed copy removes the new volume and stops; the old one is untouched. An old volume that cannot be removed is reported and kept. `tailscale-run` is not moved (runtime socket only) |

The Docker steps only run for the default project `tesseract` (volumes only for the default
prefix); other stacks keep their own names. `TESSERACT_SKIP_LEGACY_MIGRATION=1` skips them.

Because the volumes are moved, the sandbox keeps its projects, `.agent/` memory, controller
history and token, Claude login, wine prefix and Tailscale node identity. On first start the
new image also moves `/workspace/.theone` (uploads) to `/workspace/.tesseract` and the
Chromium profile `~/.config/chromium-theone` to `chromium-tesseract`.

Check afterwards:

```bash
bun run sandbox status
docker volume ls --filter name=tesseract-
grep -inE 'theone|monolith' infra/compose/.env       # only the hostname should be left (§3)
```

## 2. This computer (automatic)

On first start, the desktop app and the `tesseract` CLI copy the old app data once (into
`<new>.migrating`, then renamed; the old dirs are kept). The GTK app copies its config and sync
state the same way.

| Old | New |
|---|---|
| `~/Library/Application Support/Monolith` (macOS), `~/.config/Monolith` (Linux), `%APPDATA%\Monolith` (Windows) | `…/Tesseract` (not copied: caches, `Singleton*`, `Crashpad`, `android-sdk`; skipped when `TESSERACT_USER_DATA` is set) |
| `~/.config/monolith-desktop`, else `~/.config/theone-desktop` | `~/.config/tesseract-desktop` |
| `~/.local/state/monolith`, else `~/.local/state/theone` (sync-back links, snapshots) | `~/.local/state/tesseract` |
| `%LOCALAPPDATA%\Monolith` (Windows) | `%LOCALAPPDATA%\Tesseract` |
| `~/.config/theone/host-shell` (host shell token, PIN) | `~/.config/tesseract/host-shell` (moved; the host shell stays paired) |
| `~/.local/share/theone/android-sdk` (Linux) | `~/.local/share/tesseract/android-sdk` (moved) |

`config.json` paths that pointed into the old dirs (sandbox env file, project, image) are
rewritten. On macOS and Windows the Android SDK stays where it is: the app keeps using
`…/Monolith/android-sdk` (pinned in the config) until you install a new one.

## 3. Tailnet hostname

The default node name is now `tesseract-sandbox`, but an existing env file keeps its
`TESSERACT_HOSTNAME=theone-sandbox`, so the URL and the phone's pairing keep working.

To adopt the new name: set `TESSERACT_HOSTNAME=tesseract-sandbox`, `bun run sandbox up`, then
pair the phone again (§4). In the [admin console](https://login.tailscale.com/admin/machines),
delete any old offline `theone-sandbox` node; if the node came up as `tesseract-sandbox-1`,
delete the stale one and rename it.

An ACL that grants `tag:theone` keeps working (the node keeps its tags). To switch to
`tag:tesseract`, add it to `tagOwners` and the grants first, then re-tag the node
([getting-started.md](getting-started.md)).

## 4. Phone

The mobile app has a new bundle id, `com.kevinroan.tesseract`, so it installs as a **new
app** next to the old one; nothing carries over on the phone.

1. Install the new build ([mobile-updates.md](mobile-updates.md)).
2. Pair it: `bun run sandbox pair` (or `tesseract sandbox pair`, `tesseract server pair`) prints a
   `tesseract://pair…` link. Old `theone://` links and QR codes do not open the new app
   ([pairing-mobile.md](pairing-mobile.md)).
3. Add the host shell in the new app with `bun run host pair` (the host token and PIN are
   unchanged, [host-shell.md](host-shell.md)).
4. Uninstall the old app; it cannot talk to the new controller.

## 5. Desktop app and host CLI

Install the Tesseract build and remove the Monolith one. The `.deb` replaces the
`monolith-desktop` package and removes the old `/usr/bin/monolith` link. On macOS and with the
AppImage, reinstall the command line tool (Settings › About › **Install tesseract command**),
because an existing link points into the old app. Check with `tesseract status`.

Headless servers ([mac-server.md](mac-server.md)): deploy again; `tesseract server install`
runs §1 and replaces the host shell service.

## 6. Mobile builds (maintainers)

Builds moved to a new EAS account (`owner: kevinroan`), so the app needs a new EAS project,
new credentials and new Firebase/APNs config for `com.kevinroan.tesseract`:

```bash
cd apps/mobile
eas login                       # the kevinroan account
eas init                        # creates the project, writes extra.eas.projectId to app.json
eas update:configure            # writes the updates URL for the new project
```

- EAS environment variables (`development`, `preview`, `production`): re-create
  `GOOGLE_SERVICES_JSON` (file variable) and the Sentry auth token with `eas env:create`.
- Firebase: add Android apps `com.kevinroan.tesseract` and `com.kevinroan.tesseract.dev`,
  download the new `google-services.json`, upload it as `GOOGLE_SERVICES_JSON`.
- Apple: register `com.kevinroan.tesseract` (+ `.dev`) and the app group
  `group.com.kevinroan.tesseract`; let `eas build` create the provisioning profiles. For Live
  Activities create or reuse an APNs key in the new team ([live-activities.md](live-activities.md)).
- Build fresh binaries with `eas build`: updates published to the old project never reach the
  new app.

## 7. Remove the old resources

After a few days of the new stack working (projects there, phone paired, Claude logged in):

```bash
docker volume rm theone-tailscale-run                    # the others were moved; ignore "no such volume"
docker image rm theone/sandbox:latest                    # if present
rm infra/compose/.env.legacy-backup*                     # contains secrets
```

Back up first if unsure ([operations.md](operations.md#back-up-volumes)). The old app-data
dirs from §2 can be deleted the same way.
