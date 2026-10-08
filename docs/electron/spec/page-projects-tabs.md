# Project detail tabs, sync review and emulator launch

Spec for rebuilding the six project-detail tabs, the "Review sync to host" dialog and the Android-emulator launch flow of the GTK app (`apps/desktop/tesseract_desktop/pages/projects/`) in React/Electron. Sources: `tab_artifacts.py`, `tab_builds.py`, `tab_conversations.py`, `tab_git.py`, `tab_processes.py`, `tab_sync.py`, `sync_actions.py`, `sync_review.py`, `emulator.py`, `emulator_launch.py`, plus the shared pieces they rely on (`detail.py`, `labels.py`, `model.py`, `streams.py`, `fix_action.py`, `widgets/*`, `theme/extras/projects.py`).

The detail header (crumb, title, property chips, quick actions) belongs to the project-detail spec. This document only covers the **Display / emulator quick-action button**, because the emulator flow drives it.

All strings below are quoted verbatim from `labels.py`. Put them in a `labels.ts` module next to the components, not inline (CODING.md).

---

## 0. Tokens used in this document

The app renders the **graphite** scheme in dark mode and **graphiteLight** in light mode (`RENDERED_SCHEMES`). Base font 13px Inter, display headings use Inter Display, mono uses Geist Mono.

| token | dark (graphite) | light (graphiteLight) |
|---|---|---|
| `background` (window) | `#09090A` | `#F5F5F6` |
| `surface` | `#121213` | `#FFFFFF` |
| `surfaceElevated` (group band, secondary button bg) | `#1A1A1B` | `#FFFFFF` |
| `backgroundElement` (hover) | `#1E1E20` | `#EEEEF0` |
| `backgroundSelected` | `#232325` | `#E7E7EA` |
| `codeBackground` | `#09090A` | `#F5F5F6` |
| `text` / `textSecondary` / `textTertiary` | `#E3E3E4` / `#929294` / `#6B6B6F` | `#1B1B1F` / `#5C5D66` / `#7E7F88` |
| `border` / `borderStrong` / `divider` | `rgba(255,255,255,.08)` / `.13` / `.06` | `rgba(0,0,0,.09)` / `.15` / `.06` |
| `accent` | `#5E6AD2` (hover `#6C78E6`, pressed `#4F5BC4`) | same |
| `accentMuted` / `accentStrong` | `#1E2036` / `#9EA6F0` | `#EDEEFA` / `#4F5BC4` |
| `textOnAccent` | `#FFFFFF` | `#FFFFFF` |
| `success` / `successMuted` | `#4CB782` / `#14261C` | `#2E8A5B` / `#E5F4EC` |
| `warning` / `warningMuted` | `#F2C94C` / `#2B2410` | `#8F6400` / `#FBF2D9` |
| `danger` / `dangerMuted` / `dangerSolid` | `#EB5757` / `#2C1517` / `#EB5757` | `#C93A3A` / `#FCE9E9` / `#EB5757` |
| `info` / `infoMuted` | `#4EA7FC` / `#122233` | `#1F6FCB` / `#E5F1FE` |

Tone to color (`TONE_COLORS`): `neutral`: fg `textSecondary`; `info`: `info`; `success`: `success`; `warning`: `warning`; `danger`: `danger`.

Spacing scale: xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40. Radii: xs 4, sm 6, md 8, lg 10, xl 12, card 10, pill 999. Control heights: xs 24, sm 28, md 32, lg 36. Icons are all 16px Lucide (`ICON_SIZE` xs/sm/md all equal 16).

Text variants (size/line-height/weight): `label` 13/18/500, `body` 13/20/400, `bodyStrong` 13/20/500, `bodySmall` 12/18/400, `caption` 12/16/400, `code` 12/18/400 mono, `h4` 14/20/500, `h1` 24/30/600 Inter Display, letter-spacing −0.4.

Motion: durations fast 120ms, normal 180ms, slow 260ms, with the standard easing `cubic-bezier(0.2, 0, 0, 1)`. Every interactive element transitions background, color, border-color, box-shadow, opacity and transform over 120ms. Buttons scale to 0.95 while pressed. Stacks crossfade over 180ms. Respect `prefers-reduced-motion`: drop the transforms and crossfades, and keep color transitions at most 120ms.

Icon names map to Lucide as follows: builds `hammer`, sessions `history`, play `play`, terminal `square-terminal`, processes `square-terminal`, stop `square`, fix-ai `sparkles`, agents `mouse-pointer-2`, forward `arrow-right`, branch `git-branch`, commit `git-commit-horizontal`, ports/browser `globe`, copy `copy`, display/host `monitor`, sync/sync-from-host `cloud-download`, sync-to-host `cloud-upload`, revert `undo-2`, delete `trash-2`, smartphone `smartphone`, close `x`, add `plus`, file `file`, files `files`, artifacts `package`, save `download`, external `external-link`, send `arrow-up`, status-todo `circle`, status-progress `circle-dot`, status-done `circle-check`, status-canceled `circle-x`, info `info`, warning `triangle-alert`, error `circle-alert`, success `circle-check`.

---

## 1. Shared building blocks (used by every tab)

Build these once as reusable components. Other specs (lists, files) use them too, so coordinate with the shared-widgets owner and reuse their components if they already exist.

### 1.1 Tab strip (`PillTabs`) and tab host

- Order and labels (`TABS`): `processes` "Processes", `builds` "Builds", `artifacts` "Artifacts", `git` "Git", `sync` "Sync back", `conversations` "Chats". The default tab is `processes`. `aria-label`: "Project sections".
- Strip: a horizontal row with a 4px gap, inside a horizontally scrollable container with no vertical scrollbar. The container has `margin-top: 20px`, `padding-bottom: 8px` and `border-bottom: 1px solid divider`.
- Pill: min-height 28px, padding `0 10px`, radius 999, `1px solid border`, transparent background, `textSecondary`, 13px/500. Hover: background `backgroundElement`, color `text`. Selected: background `backgroundSelected`, border `borderStrong`, color `text`.
- Count inside the pill: `caption` (12px) in `textTertiary`, 6px after the label. The count is hidden when it is 0 or null. Values:
  - processes: the number of **live** processes (`starting`/`running`)
  - builds: the number of non-final builds (not `succeeded`/`failed`/`cancelled`)
  - artifacts: all artifacts
  - sync: changed files in the sandbox (`view.files.length`)
  - conversations: the number of sessions
  - git: no count
- Tab body: `margin-top: 12px`. Switching tabs crossfades over 180ms. The panel height follows its own content, not the tallest tab.
- Deep link: `navigate("projects", {projectId, tab})` selects that tab.

### 1.2 `ListGroup` (Linear group band plus rows)

A vertical box with a 2px gap:

1. **GroupHeader band**: min-height 36px, padding `0 4px 0 12px`, radius 6, background `surfaceElevated` (`#1A1A1B` dark; white in light, so the band is invisible on the white panel in light mode, which is correct). Children have an 8px gap: icon (16px, `textSecondary`) · title (`label` 13/500, `text`) · count (`body` 13px, `textSecondary`, hidden when null; **0 is shown**, e.g. "Builds 0") · subtitle (`caption` 12px `textTertiary`, flexes, single line with an ellipsis at the end) · trailing area (4px gap, vertically centred). When a subtitle is present it takes the spare width; otherwise a spacer pushes the trailing area right.
   - Trailing icon button (`to-group-action`): 24×24, radius 6, `textSecondary` (hover `text`), flat; hover background `backgroundElement`.
2. **Body**, a 180ms crossfade between three states:
   - `loading`: a 40px-high row with padding `0 12px` and a 16px spinner at the left.
   - `empty`: the empty label in `body` 13px `textTertiary`, wrapping, min-height 40px, padding `0 12px`, vertically centred.
   - `content`: the row list.
   - `setLoading(false)` only leaves `loading`. It never overrides `empty`.

### 1.3 `RecordRow` (Linear single-line row)

The row list (`list.to-record-list.divided`) has no background. Every row has `border-bottom: 1px solid divider`, except the last. Hovering a row gives it a `backgroundElement` background with radius 0, because the list is divided. Clicking a row (or pressing Enter) runs its `onActivate`.

Row content: min-height 40px, padding `0 8px 0 12px`. Children have a 10px gap, all vertically centred:

1. **Icon/glyph**, 16px, default color `textSecondary`. When a status is shown as a *glyph* (`glyph=true`), the icon becomes the Linear status circle: tone neutral → `circle` in `textTertiary`; info → `circle-dot` in `info`; success → `circle-check` in `success`; warning → `circle-dot` in `warning`; danger → `circle-x` in `danger`. The glyph's tooltip is the status label.
2. **Code**, optional: mono 12px, weight 600, min-width 18px, centred, colored by tone (git and sync status letters).
3. **Body**, flex 1, 10px gap: title then subtitle.
   - Title: `label` 13/500 `text` (mono 12px when `monospaceTitle`). With a subtitle, the title caps at about 56 characters and the subtitle takes the rest. Without one, the title flexes. Overflow ellipsizes at the end. A tooltip shows the full title when it is longer than 48 characters.
   - Subtitle: `body` 13px `textTertiary` (mono 12px when `monospaceSubtitle`). It flexes, ellipsizes, and gets the same 48-character tooltip rule.
4. **Progress**, optional: 80px wide, 4px tall, radius 2. The track is the tone color at 20% alpha; the fill is the tone color (`info` for builds). In the indeterminate state, a 40%-wide gradient (transparent → currentColor → transparent) slides from −100% to 200% over 1440ms, linear and infinite.
5. **Meta**: `caption` 12px `textTertiary`, right-aligned, about 48 characters max, ellipsized, with a tooltip when longer than 48.
6. **Status pill**, the non-glyph variant: min-height 20px, padding `0 8px 0 7px`, radius 999, transparent background, `1px solid border`, with a 4px gap between a 6px tone dot and a `caption` label in the tone color. A `live` status makes the dot pulse: opacity 1 → 0.35 → 1 over 2880ms, infinite.
7. **Actions**, two modes:
   - If **any** action is `labeled`, all actions render inline in the row and stay visible (2px gap).
   - Otherwise the icon-only actions float over the right edge **only while the row is hovered or focused**. They sit in an overlay box with `margin-right: 4px`, padding `0 4px 0 8px`, radius 6 and background `backgroundElement`, vertically centred, and the box covers the meta text beneath it. Fade the overlay in and out over 120ms; GTK pops it with no fade.
   - Icon action button (`to-row-action`): 24×24, radius 6, `textSecondary`, flat. Hover: color `text`, background `backgroundElement`. The action label is its tooltip and `aria-label`.
   - A labeled action is a secondary pill button (see 1.5) with the extra `labeled` class: padding `0 8px`, font 12px. Same 24px min height; the GTK row-action rule sets min-height 24.
   - `destructive`: hover color `danger`.
   - `active`: background `backgroundSelected`, color `text`. Used for "Hide logs" while the log panel shows that row.
   - Disabled (`sensitive=false`): the native disabled look, about 50% opacity.

### 1.4 `LogPanel` (inline log viewer under a list)

Hidden by default. When shown it sits below the list group (`margin-top: 4px`) and is a vertical box with a 6px gap:

- Header: min-height 28px, padding `0 4px 0 12px`, 8px gap. Contents: 16px `square-terminal` icon in `textTertiary` · title (`label`, flexes) · optional action button (secondary pill; "Fix with AI" with the `sparkles` icon) · status pill (as in 1.3; `live` pulses while the stream is open) · close icon button (`x`, tooltip "Close logs", `to-row-action` style).
- Notice line: `caption` `textTertiary`, wraps, hidden when empty. Used for "Live logs unavailable: showing a snapshot" or for errors.
- Log view: min-height **320px**, `1px solid border`, radius 8, background `background` (`#09090A` dark / `#F5F5F6` light), padding `10px 12px`, mono **12px**. Stream colors: stdout `text`, stderr `textSecondary`, system `textTertiary`, error `danger`. Keep at most 5000 lines. It auto-follows while the scroll position is within 24px of the bottom. Otherwise a floating "Jump to latest output" button appears: 28×28 circle, `surfaceElevated`, `1px solid borderStrong`, shadow `0 4px 12px rgba(0,0,0,.3)`. The empty placeholder reads "Waiting for output…".
- Status labels (`LOGS`): connecting "Connecting" (warning), open "Live" (success, live dot), closed "Ended" (neutral). When the process ends: exit 0 "Exited 0" (success), non-zero "Exited {code}" (danger), no code "Stopped" (neutral). For builds the final status is the build state pill instead, e.g. "Succeeded" (success) or "Failed" (danger).

**Log streaming** (`LogFollower`), shared by Processes and Builds:

- WebSocket `GET /v1/processes/{id}/logs/stream` or `/v1/builds/{id}/logs/stream`. Messages are `{type:"log", line:{text, stream}}` (append), `{type:"build", build}` (upsert the build into the tab list) and `{type:"exit", code}` (finish).
- If no socket can be opened, show the notice "Live logs unavailable: showing a snapshot" and poll every **2s**: `GET /v1/{processes|builds}/{id}/logs?tail=500` plus `GET /v1/{processes|builds}/{id}`. Stop when the item is final. A process is final when its state is not `starting`/`running`; a build is final when its state is `succeeded`/`failed`/`cancelled`.
- If the socket closes without reconnecting and the run has not ended, fetch the item once. If it is final, finish with its exit code. For builds the code is 0 when the build `succeeded` and 1 otherwise. On error, put the description in the notice line.
- Suspend the stream while the panel is not on screen (another tab or another page) and resume it when it comes back. Close it on unmount.
- Following a new target clears the view and the notice.

### 1.5 Buttons

- **Primary** (`to-primary`): min-height 28, radius 999, padding `0 14px`, background `accent`, color white, no border, weight 500. Hover `filter: brightness(1.1)`, pressed `accentPressed`, disabled opacity 0.5.
- **Secondary** (`to-secondary`): min-height 28, radius 999, padding `0 14px`, weight 500. At rest: background `surfaceElevated`, `1px solid border`, color `text`. Hover: background `backgroundElement`, border `borderStrong`.
- **Secondary with attention** (`to-attention`, used for sync work that is waiting): at rest background `accentMuted`, `1px solid accent`, color `accentStrong`. The text stays `accentStrong` on hover.
- Button content: optional 16px icon, then a 6px gap, then the `label` text on one line.
- **Destructive ActionButton**: see the quirk in §9.1. Render it as a secondary button (color `text`). On hover use background `dangerSolid` with white text.

### 1.6 `Notice` (inline banner)

A row with a 10px gap: padding `8px 10px`, radius 8, `1px solid border`, **transparent** background (the tone background is overridden). Contents: a 16px tone icon in the tone color (danger `circle-alert`, warning `triangle-alert`, success `circle-check`, otherwise `info`), then a body column with a 2px gap holding an optional title (`bodyStrong`) and the message (`bodySmall` 12px `textSecondary`, wrapping), then an optional flat action button in the tone color (min-height 24, padding `0 8px`, 12px).

### 1.7 Confirm dialog (`confirm()`)

This is the shared modal. The full spec is in the dialogs spec. In short: width 420, radius 12, `surfaceElevated`, `1px solid border`, shadow `0 16px 48px rgba(0,0,0,.5)`, overlay `rgba(0,0,0,.55)` (dark) / `rgba(0,0,0,.28)` (light). The header is a breadcrumb title with an `x` button and 16px top padding. The body text is `body` `textSecondary`, wrapping, with `\n` preserved. The footer has the cancel button (flat) then the confirm button (destructive red, or primary when `destructive=false`), both min-height 30. A destructive dialog focuses Cancel; a non-destructive one focuses Confirm. Enter triggers the default (confirm). Every confirm in this document is destructive unless stated otherwise.

### 1.8 Fix with AI

"Fix with AI" (`sparkles`) appears on failed processes and builds:

1. Mark the item pending, which disables the button.
2. `GET /v1/processes/{id}/logs?tail=150` or `/v1/builds/{id}/logs?tail=150`.
3. Build the prompt (`failure_prompt`), parts separated by blank lines:
   - ``"{subject} failed. Find the cause and fix it, then run it again to confirm it works."``. The subject is `` `{name or id}` `` for a process, or `The {target label} {profile label lowercased} build` for a build, with whitespace collapsed.
   - Then the facts, one per line, skipping empty ones: ``Command: `{command}` ``, `Exit code: {code}`, `Error: {error}`. Builds pass only `error`.
   - Then ``Last {n} log lines:\n```\n{log}\n``` `` with the last 150 lines, ANSI stripped. When there are no lines: "No log output was captured."
4. Navigate to `agents` with `{new: true, projectId, prompt}`. The prompt fills the composer and is **not** sent.
5. On error, show the error in the detail's danger notice. Always clear the pending state.

### 1.9 Errors

Tabs report failures through the detail page's danger `Notice`, which sits above the tab strip with `margin-top: 12px` and a "Dismiss" action (or a custom action such as "Preferences"). Success feedback is a toast.

---

## 2. Processes tab

Reference: `page-projects-tabs-processes.png` (dark, live data, project `nimble-lotus`/"streaxfit" with one running process) and `page-projects-tabs-processes-light.png`.

Layout: a vertical stack with a **16px** gap, in this order:

1. **Listening ports** (`ListGroup`, icon `globe`, title "Listening ports", subtitle "Servers started from this project", count = number of ports). **Hidden when there are no ports.** No empty state.
2. **Processes** (`ListGroup`, icon `square-terminal`, title "Processes", count = all processes, trailing `+` button with tooltip "Run command", empty label "Nothing has run in this project yet.").
3. **Log panel**, hidden until a row's logs are opened.
4. **Scripts** (`ListGroup`, icon `square-terminal`, title "Scripts", subtitle "Package scripts run with {pm}", where `pm` is `project.packageManager` or `"npm"`, count = number of scripts). **Hidden when `project.scripts` is empty.** It sits *after* the log panel; keep that order.

### Data

- Processes come from the detail snapshot (`GET /v1/processes?projectId=`), filtered to the project. They are sorted newest first by `startedAt`, then live ones are moved to the top with a stable sort. Live updates arrive through the WS event `process.updated` (upsert, matched on `projectId`).
- Ports: poll `GET /v1/ports` every **10s** while the tab is mounted and on screen. Keep `ports[]` where `projectId` matches, sorted by port ascending.
- Until the processes list has loaded, the Processes group shows `loading`.

### Port row (`RecordRow`, icon `globe`)

- Title `":{port}"` (e.g. ":41653"). Subtitle: `port.command` (e.g. "java"). Meta: the URL, or "No address reachable from this machine".
- URL: `port.url`, falling back to `port.dnsUrl`, then to `http://{controller host}:{port}`. The host is wrapped in `[]` when it contains `:` (IPv6).
- Hover actions (only when there is a URL): `copy` "Copy URL", which copies and toasts "URL copied"; `globe` "Open in browser", which opens it with `shell.openExternal`. Clicking the row opens the URL.

### Process row (`RecordRow`, icon `square-terminal`, mono subtitle)

- Status glyph from `process_state`: starting → "Starting" (info); running → "Running" (success); exited with code 0 or no code → "Exited" (neutral); exited with a non-zero code → "Failed" (danger); failed → "Failed" (danger); stopped → "Stopped" (neutral); orphaned → "Orphaned" (warning).
- Title: `name` or `id`. Subtitle: the command, with arrays joined by spaces. Meta (` · ` joined):
  - Live: `"started {relative}"`, then `":{port}"` if there is a port, `"display"` if `display`, and `"pid {pid}"`.
  - Ended: `"ran {duration} · ended {relative}"`, then `":{port}"`, `"display"`, and `"exit {code}"` when there is a code.
  - Relative time: "just now" under 45s, "{n}m ago" under 1h (rounded, at least 1), "{n}h ago", "{n}d ago" under 7d, otherwise `YYYY-MM-DD` (UTC). Duration: "{s}s", "{m}m {s}s" ("{m}m" when s=0), "{h}h {m}m", "{d}d {h}h".
- Actions (all icon-only, so they appear on hover), in order:
  1. If the process failed (state `failed`, or `exited` with a non-zero code): `sparkles` "Fix with AI", disabled while pending.
  2. `square-terminal` "Show logs" or "Hide logs". It is `active` when the panel shows this process.
  3. If live: `square` "Stop", destructive, disabled while a stop is pending.
- Clicking the row toggles its logs.

**Stop confirmation:**

- Title: "Stop {name}?"
- Body: "The process gets SIGTERM, then SIGKILL after 5 seconds."
- Buttons: "Stop" / "Cancel"

Confirming sends `DELETE /v1/processes/{id}`, upserts the result and toasts "Stopped {name}". On error, report it.

**Logs:** opening a process sets the panel title to "Logs · {name}", clears the status and action, shows the panel and follows `process/{id}`. If the shown process is failed, the panel header also gets the "Fix with AI" button. The title updates on every re-render.

### Script row (`RecordRow`, icon `square-terminal`, mono title and subtitle)

- Title: the script name. Subtitle: `"{pm} run {script}"`. The script is shell-quoted with `'…'` unless it matches `^[\w.:@/+=-]+$`.
- Actions: because one is labeled, both are always visible inline:
  - `monitor` "Run on display" (icon-only)
  - labeled `play` "Run" (secondary pill)
  - Both are disabled while that script is starting.
- Run: `POST /v1/processes` with `{projectId, command: "{pm} run {script}", name: script, display}`. For "Run", `display` is true only when the framework is `electron`; "Run on display" forces true. On success: upsert, toast "Started {name}", and open its logs.

### Run command dialog (the "+" button)

This is a `FormDialog`, specified with the shared form dialog. Breadcrumb: context = project name, icon `package`, title "Run a command". Group description: "Runs with bash -lc in {path}". Fields:

- A large mono title entry, "Command"
- "Name (optional)"
- "Port (optional)", digits only
- A chip "Show on the sandbox display" (icon `monitor`, subtitle "Sets DISPLAY so GUI apps appear in the VNC view"), on by default for Electron projects

Buttons: "Run" / "Cancel".

Validation:

- Command required: "Enter a command to run."
- At most 16384 chars: "Keep the command under 16384 characters."
- Name at most 128: "Keep the name under 128 characters."
- Port 1–65535: "Use a port between 1 and 65535."

Submit sends `POST /v1/processes` with `{projectId, command, name?, port?, display?: true}`. A 409 or `conflict` with a port puts the field error "Port {port} is taken: {message}" on the port field. Other errors show at dialog level. On success the dialog closes and the run is handled like a script run (toast and logs).

---

## 3. Builds tab

Reference: `page-projects-tabs-builds.png` (dark, live; `brave-hare`/"hybrid-pos", 3 targets, no builds yet).

A vertical stack with a 16px gap:

1. **Build targets** (`ListGroup`, icon `hammer`, title "Build targets", subtitle "Detected from the project's package.json and native folders", which ellipsizes as in the screenshot, empty label "No build targets detected for this project."). The trailing area holds the **profile chip group**:
   - Chips "Debug" (default) and "Release", 8px gap, single select (clicking the selected chip keeps it selected).
   - Chip: min-height 28, padding `0 12px`, radius 999, `1px solid border`, transparent, `textSecondary`, 500. Hover: `backgroundElement` and `text`. Selected: `backgroundSelected`, `borderStrong`, `text`.
   - Hidden when there are no targets.
2. **Builds** (`ListGroup`, icon `history`, title "Builds", count = all builds, so it shows "0"; empty label "No builds yet.").
3. **Log panel.**

### Target row (`RecordRow`, icon `hammer`)

- Title and platform come from `BUILD_TARGETS`:
  - `electron-linux`: "Linux AppImage" / "Electron"
  - `electron-windows`: "Windows installer" / "Electron + wine"
  - `android-apk`: "Android APK" / "Gradle"
  - `web`: "Web bundle" / "Static files"
  - `script`: "Build script" / "Logs only"
  - Unknown targets show the raw id with no platform.
- Subtitle: `"{platform} · {target id}"`, e.g. "Electron · electron-linux".
- Action: labeled `play` "Build", always visible, disabled while that target is starting. Clicking sends `POST /v1/builds` with `{projectId, target, profile}`, using the currently selected profile. On success: upsert, toast "Building {target label}", and open its logs.

### Build row (`RecordRow`, icon `hammer`)

- Status glyph: queued "Queued" (neutral); running "Running" (info); succeeded "Succeeded" (success); failed "Failed" (danger); cancelled "Cancelled" (warning).
- Title: the target label. Subtitle: `build.error` (shown only when present).
- Meta (` · ` joined):
  - `"{Debug|Release} · {relative startedAt or createdAt}"`
  - then `stage` while the build is not final
  - then the duration when final and `startedAt` is set
  - then `"{n} artifacts"` when `artifacts` is non-empty
- Progress bar (80px): shown while the build is not final. It is determinate when `progress` is a number (0–1), otherwise indeterminate.
- Actions, icon-only on hover:
  - When failed: `sparkles` "Fix with AI"
  - `square-terminal` "Show logs" or "Hide logs" (active when open)
  - When not final: `square` "Cancel build", destructive, disabled while pending
- Clicking the row toggles its logs. The panel title is "Logs · {target label}". The panel's Fix action appears when the build failed.

**Cancel confirmation:**

- Title: "Cancel this build?"
- Body: "{target} ({profile}) stops and its outputs are discarded."
- Buttons: "Cancel Build" / "Keep Building"

Confirming sends `DELETE /v1/builds/{id}` and upserts the result.

Data: builds come from the snapshot (`GET /v1/builds?projectId=`), sorted newest first by `createdAt`, with live updates from the WS event `build.updated`.

---

## 4. Artifacts tab

Reference: `page-projects-tabs-artifacts.png` (dark, live; `sante-production` has no artifacts, so the empty state shows).

The tab reuses the Files page's `ArtifactList` with a single group (no per-project grouping). See the files spec for the row actions and download behavior. In short:

- States (180ms crossfade):
  - `loading`: a centered 24px spinner.
  - `empty`: the `EmptyState` with a 48px `files` glyph in `textTertiary` (4px below it), the title "No artifacts yet" (`h4` 14/500 `textSecondary`, centered), the message "Successful builds and files Claude shares put their outputs here." (`bodySmall` 12px `textTertiary`, centered, about 56 characters wide), and margins of 40px top/bottom and 24px left/right.
  - `content`: one `ListGroup` titled "Artifacts" with icon `package` and count = the number of artifacts.
- Row (`RecordRow`):
  - Icon by file type; the title is the `fileName`; the subtitle is the trimmed `note`; the meta comes from `artifact_meta`; a source status pill is shown when its tone is not neutral.
  - A progress bar appears while downloading.
  - Hover actions: `download` Save (disabled while downloading), `external-link` Open, `arrow-up` Send (only when Taildrop is available), and `trash-2` Delete (destructive).
- Data: `GET /v1/artifacts?projectId=` from the snapshot, newest first by `createdAt`. WS `artifact.created` upserts and `artifact.deleted` removes. A deletion from the row also removes the item locally.

---

## 5. Git tab

References: `page-projects-tabs-git.png` (dark, live; 5 changed files and 20 commits) and `page-projects-tabs-git-light.png`.

A vertical stack with a 16px gap:

1. **Notice**, hidden by default:
   - When the project has no `git` summary: neutral "Not a git repository". Both groups are hidden.
   - When the details fetch failed: warning "Couldn't read git status: {error}". The groups stay visible and keep showing the summary subtitle.
2. **Working tree** (`ListGroup`, icon `git-branch`, title "Working tree", count = number of files, empty label "Nothing to commit, working tree clean."). The subtitle is ` · ` joined:
   - the branch, or "detached"
   - the ahead/behind label (`↑{n}`, `↓{n}`, space-joined), or "In sync"
   - "Clean" when there are no files
3. **Recent commits** (`ListGroup`, icon `git-commit-horizontal`, title "Recent commits", count = number of commits, empty label "No commits yet.").

Data: `project.git` (the summary) comes from the project. Details come from `GET /v1/projects/{id}/git` (`{branch, ahead, behind, files[], log[]}`), fetched only when `project.git` is set. The fetch is part of the 15s detail poll, and it is refreshed when the project's git summary changes in the store. Both groups show `loading` while the details are null and there is no error.

### File row (`RecordRow`, no icon, mono title)

- Code: `index` + `worktree` trimmed (e.g. "M", "??", "AM"); "?" if empty. Tone:
  - contains `?` → info
  - contains `U` or `D` → danger
  - contains `A` → success
  - otherwise → warning
- Title: the path. Meta, the kind: a code containing `U` gives "Conflict"; otherwise the first known letter gives Modified/Added/Deleted/Renamed/Copied/Untracked (`?`)/Ignored (`!`)/"Type changed" (`T`).
- No actions and not clickable.

### Commit row (`RecordRow`, icon `git-commit-horizontal`)

- Title: `subject`, or the 7-character sha. Meta: `"{sha7} · {author} · {relative date}"`.
- No actions and not clickable.

---

## 6. Sync back tab

References:

- `page-projects-tabs-sync.png` (dark, live): `sante-production` is linked with no sandbox changes. "Sync to host" is disabled at 50% opacity and "Sync from host" carries the attention style because host files changed.
- `page-projects-tabs-sync-changes.png` (dark, live): `brave-hare` has 12 sandbox changes (A/M codes and sizes). "Sync to host" is enabled as primary and "Discard changes" is enabled.
- `page-projects-tabs-sync-light.png` (light): shows the invisible Discard label quirk from §9.1.

A vertical stack with a 16px gap:

1. **Status notice** (neutral, hidden when there is no message). The first rule that matches wins:
   - Not linked: "Not linked on this computer. Run tesseract --sync in the project's checkout to link it, then changes made in the sandbox can be synced back."
   - Load error (warning): "Couldn't read sandbox changes: {error}"
   - Changes loaded but `baselineAt` is null: "The sandbox has no push baseline yet. Run tesseract --sync in {path}."
2. **Result notice**: shows the outcome message of a Discard, with tone success or warning. It has a "Dismiss" action that hides it, and its message is multi-line.
3. **Summary card**, visible only when linked: padding `4px 12px`, radius 8, `1px solid border`, no background. It is a key/value list; each row has padding `4px 0` and a 12px gap, with the key on the left (`bodySmall` 12px `textSecondary`) and the value right-aligned (`bodySmall` 12px `text`, wraps up to 2 lines, selectable). Rows:
   - "Host folder": the host path
   - "Linked": relative `pushed_at`, or "—"
   - "Last get": relative `got_at`, or "—"
   - "Sandbox baseline": relative `changes.baselineAt`, or "—"
4. **Action buttons**: a wrapping row with 8px column and 8px line gaps (§6.2).
5. **Sandbox changes** (`ListGroup`, icon `cloud-download`, title "Sandbox changes", empty label "Nothing to sync. The host folder matches the sandbox.", no count).
   - Subtitle: `"{n file(s)} · {size}"`, e.g. "12 files · 721 KB", shown only when there are files.
   - Visible when linked or when there are files.
   - Shows `loading` until the first load finishes, or while changes are null and there is no error.
6. **Recent requests** (`ListGroup`, icon `monitor`, title "Recent requests", empty label "No sync requests yet."). Shows at most the **10** most recent. Visible when linked or when there are any requests.
7. **Snapshots** (`ListGroup`, icon `history`, title "Snapshots", subtitle "Taken before every sync to host; the newest 20 are kept", empty label "No syncs yet."). Visible when linked or when there are any snapshots.

### 6.1 Sync view (data model)

`SyncView = {link, changes, requests, snapshots, conflicts, error, hostFiles}`, loaded by `load_sync_view`:

- `link` and `snapshots` come from **local host state** in `$XDG_STATE_HOME/tesseract/` (default `~/.local/state/tesseract/`): `links.json` and the snapshot files. Electron must read the same files in the main process, so the CLI (`tesseract --sync`) and the app share links.
- `changes = GET /v1/projects/{id}/sync/changes` returns `{baselineAt, totalBytes, changes:[{path, kind: added|modified|deleted, size?, sha256?, discardable?}], host?}`.
- `requests = GET /v1/projects/{id}/sync/requests`, newest first.
- If either call fails, the view keeps `link` and `snapshots`, sets `error`, and leaves `changes` null.
- `conflicts`: for each change, the path conflicts when the current host file hash differs from both the manifest hash recorded at push (`link.manifest[path]`) and the incoming `sha256`. A path outside the root, or an error, also counts as a conflict.
- `hostFiles`: host files changed since the last push/get. It is computed by walking the host folder with a digest cache, and is empty when the folder is missing or unreadable.
- Polling: every **15s** while the tab is mounted (the poller is bound to the detail widget), and immediately whenever the sync-back service's revision changes or the project's busy state changes. The header refresh button also refreshes it. A load result for a stale project id is discarded and the poll repeats.
- Derived values:
  - `files = changes.changes`
  - `revertible` = the first snapshot that is not reverted
  - `inFlight` = any request that is `pending` or `claimed`
  - `pushed` = `changes.baselineAt != null`
  - `discardable` = files with `discardable`
  - `getConflicts` = the `result.conflicts` of the newest `get` request, if its status is `failed`

### 6.2 Action buttons (`SyncActions`)

| id | label | variant | icon | tooltip when enabled |
|---|---|---|---|---|
| pull | "Sync to host" | primary | `cloud-upload` | "Copy the sandbox changes into the host folder" |
| get | "Sync from host" | secondary | `cloud-download` | "Copy the host folder's changes into the sandbox" |
| revert | "Revert last sync" | secondary | `undo-2` | "Undo the last sync to host on this computer" |
| discard | "Discard changes" | destructive (see §1.5) | `trash-2` | "Throw away the sandbox changes and restore the synced versions" |

Each button is disabled when the project id is missing, while a sync/discard submission is pending, or when it has a blocker. **The blocker text becomes the tooltip.** Blockers, first match wins (`SYNC_BLOCKED`):

- pull: not linked → "Not linked on this computer. Run tesseract --sync in the checkout first"; changes null → "Loading the sandbox changes…" (or "The sandbox changes couldn't be read" on error); not pushed → "Never pushed. Run tesseract --sync in the checkout first"; busy or in flight → "A sync request is already in progress"; no files → "Nothing to sync. The host folder matches the sandbox".
- get: the same, without the no-files rule.
- revert: not linked; busy or in flight; no revertible snapshot → "No sync to revert".
- discard: loading/unavailable; not pushed; busy or in flight; no files → "Nothing to discard. The sandbox matches the last sync"; nothing discardable → "The sandbox has no copy of the synced versions of these files".

Attention: when enabled, **get** gets the attention style (§1.5) if `hostFiles` is non-empty. GTK also adds it to **pull** when `files` is non-empty, but CSS only styles secondary buttons, so pull shows no change. Do not add a visual for pull.

Actions:

- **Sync to host** opens the review dialog (§7). The guard is: linked and files exist.
- **Sync from host**:
  - With no `getConflicts`, submit `get` directly (force=false).
  - Otherwise confirm:
    - Title: "Sync from {path}?"
    - Body: "Copies what changed in {path} since the last push or sync into the sandbox." then `\n\n`, then "The last sync from this computer stopped because the sandbox also edited {n file(s)}. Syncing again overwrites them; copies of the sandbox versions are kept on the sandbox.\n\n{files}"
    - Buttons: "Overwrite and Sync" (destructive) / "Cancel"
    - Confirming submits `get` with force=true.
- **Revert last sync**: confirm:
  - Title: "Revert snapshot {id}?"
  - Body: "Puts back the {n file(s)} as they were before that sync. The sandbox is not changed." then `\n\n` and the listed paths
  - Buttons: "Revert" / "Cancel"
  - Confirming submits `revert`.
- **Discard changes**: confirm:
  - Title: "Discard {n file(s)} in the sandbox?"
  - Body: "Puts these files back as they were at the last sync. Added files are deleted. The host folder is not changed.\n\n{files}", plus "\n\n{k file(s)} can't be restored by the sandbox and stay as they are." when some files are not discardable
  - Buttons: "Discard" / "Cancel"
  - Confirming sends `POST /v1/projects/{id}/sync/discard` with `{paths}`. The result notice then shows these lines:
    - "Discarded {n file(s)} in the sandbox", or "Nothing was discarded"
    - plus "{k file(s)} kept, the sandbox has no copy of the synced version: {comma list}"
    - plus "Previous versions saved in {backupPath}"
    - The tone is warning when anything was unavailable or nothing was discarded, otherwise success.
  - On failure: "Couldn't discard the sandbox changes: {error}" (danger).
  - Always clear pending and refresh afterwards.
- Listed paths show at most 12, one per line, then "… and {n} more".
- `plural(n, "file")` gives "1 file" / "{n} files".
- **Submit** (pull/get/revert) goes through the sync-back service, which sends `POST /v1/projects/{id}/sync/requests` with `{kind, force, source:"desktop", paths?}` and then queues the request for local execution by the host-side sync worker. Pending is set while the call runs. Toast right away:
  - pull: "Sync requested"
  - get: "Sync from host requested"
  - revert: "Revert requested"
  - On error, report it through the detail notice.

### 6.3 Rows

- **Change row** (`RecordRow`, no icon, mono title):
  - Code `A` (success) / `M` (warning) / `D` (danger), with `?` (neutral) as the fallback.
  - Title: the path. Meta: "changed on the host since the push" when the path conflicts, otherwise the formatted size. Sizes are 1024-based: "568 B", "5.4 KB", "538 KB".
  - Status pill "Host edit" (warning) on conflicts.
- **Request row** (`RecordRow`, icon `monitor`):
  - Status glyph: pending "Waiting" (info); claimed "Applying" (info); applied "Applied" (success); failed "Failed" (danger); cancelled "Cancelled" (neutral).
  - Title (`SYNC_KINDS`): pull "Sync to host", revert "Revert", get "Sync from host".
  - Subtitle: `error`, or for applied requests with a result:
    - pull: "Pulled {n file(s)} into {hostPath} ({a added, m modified, d deleted})", or "(no changes)"
    - revert: "Reverted the last sync in {hostPath} ({m restored, a recreated, d removed})", or "(no files)"
    - get: "Sent {n file(s)} to the sandbox ({counts})" or "Sandbox already up to date", then ` · +{insertions} −{deletions}`, then ` · updated .git ({n file(s)})`, then ` · sandbox edits kept in {backupPath}` (each part only when present)
  - Meta: "from {source} · {relative createdAt}".
  - Pending requests get a hover action `square` "Cancel" (destructive), which sends `POST /v1/sync/requests/{id}/cancel` and then refreshes.
- **Snapshot row** (`RecordRow`, icon `history`, mono title): the title is the snapshot id; the meta is "{n file(s)} · {relative createdAt}"; a status pill "Reverted" (neutral) appears when reverted.

---

## 7. Sync review dialog ("Review sync to host")

There is no screenshot, because the dialog only opens by clicking. Build it from these numbers.

- `DialogShell`, content **1120 × 720**, radius 12. Breadcrumb header: context chip = project id with the `cloud-download` icon, then a `›` caret (`caret-right`, `textTertiary`), then the title "Review sync to host" (`bodyStrong`), and an `x` close button. Header padding is `12px 12px 4px 16px`.
- Body: a horizontal split pane. The sidebar starts at **360px** and cannot shrink below its content. Only the diff pane grows when the dialog resizes. The divider is 1px `divider`; it is draggable in GTK, and keeping it draggable is optional.
- Footer: padding `8px 12px 12px 16px`, buttons min-height 30.
  - Left: the caption "A snapshot is taken first, so Revert can undo this." in `textTertiary`.
  - Right: "Cancel" (flat), then the confirm button (primary):
    - With no conflicts: "Sync {n file(s)}", e.g. "Sync 12 files".
    - With conflicts: "Overwrite and Sync", styled destructive (red `dangerSolid`, white text).
  - Enter is the default for confirm.
- Confirm closes the dialog, then submits `pull` with `force = conflicts exist` and `paths = all changed paths`.
- Closing the dialog cancels any in-flight diff load.

### Sidebar

Padding `8px 12px 12px 16px`, a vertical box with a 10px gap:

1. "Into {host path}": `caption` `textSecondary`, ellipsized in the middle, with the full path as a tooltip.
2. "{n file(s)} · {total size}": `bodyStrong`.
3. Kind counts, a row with a 12px gap. For each kind in the order added, modified, deleted that has a non-zero count, a 4px-gap pair: the code letter (mono, tone color) and "{count} {kind}" (`caption` `textSecondary`), e.g. "A 2 added".
4. If any path conflicts, a warning Notice: "{n file(s)} changed on this computer since the push and will be overwritten."
5. A search entry with the placeholder "Filter files". It fills the width with min-height 32, radius 6, background `surfaceElevated` and `1px solid border`; the focus border is `accent` with a 1px `focusRing` outline offset by 1. It does a case-insensitive substring match on the full path.
6. "No files match": `caption` `textTertiary`, centered, visible only when the filter matches nothing.
7. The file list: scrolls vertically, never horizontally, and fills the remaining height.
   - Rows are sorted with conflicts first, then by path.
   - Row: padding `4px 8px`, radius 6, 8px gap. Hover background `backgroundElement`; selected `backgroundSelected`.
   - Row content: the code letter (mono, tone color) · the file name (`body`, ellipsized in the middle) · the directory (`caption` `textTertiary`, flexes, ellipsized at the **start**) · "Host edit" (`caption`, `warning`) only on conflicts. The tooltip is the full path.
   - Single selection; it cannot be cleared. The first row is selected on open.

### Diff pane

Margins `0 12px`, `1px solid border`, radius 8, background `codeBackground`.

- **Header**: padding `8px 12px`, `border-bottom: 1px solid divider`, 10px gap.
  - The code letter (mono, tone color)
  - The path (mono, flexes, ellipsized at the start, full-path tooltip)
  - The kind (`caption`): "New file" / "Modified" / "Deleted on the host", or "Host edit" in `warning` on conflicts
  - `+{added}` (mono, `success`) and `−{removed}` (mono, `danger`, using U+2212), shown only for text diffs
- **Lines**: a virtualized list that scrolls vertically, never horizontally, and wraps long lines. Each row has padding `0 8px 0 0`:
  - Old line number gutter: mono `textTertiary`, right-aligned, min-width 44, padding `0 4px`, `border-right: 1px solid divider`.
  - New line number gutter: same as the old one.
  - Sign: mono, min-width 16, `padding-left: 4px`. "+" in `success` on adds, "−" in `danger` on deletions, blank otherwise.
  - Text: mono 12px, wraps.
  - Row backgrounds: `add` uses `successMuted`; `del` uses `dangerMuted`; `hunk` uses `infoMuted` with `margin-top: 4px`, and all its text is in `info` (the hunk text is `@@ -a,b +c,d @@`); `ctx` has no background.
  - Scroll to the top whenever a new file is shown.
- **Message**, used instead of the lines: `body` `textSecondary`, centered horizontally and vertically, wrapping. Messages:
  - Initial: "Select a file to see what changes on the host"
  - While loading: "Loading the diff…"
  - On error: "Couldn't load the diff: {error}"
  - binary: "Binary file, {before} → {after}", with "none" for an absent side
  - too_large: "Too large to preview ({size})"
  - identical: "Same content as the host copy"
  - empty: "Empty file"
- **Footnote** (`caption` `textTertiary`, centered): "Diff cut off after {count} lines" when truncated, otherwise hidden.

### Diff loading (per selected file, cached per path)

- Before (host copy): read `{hostRoot}/{path}` from the local disk in the Electron main process. A symlink yields its target as bytes; a missing file yields null.
- After (sandbox copy):
  - null when the kind is `deleted`
  - "too_large" when `size > 1 MiB` (1,048,576 bytes)
  - otherwise `POST /v1/projects/{id}/sync/export` with `{paths:[path]}`, which returns a gzip tar; extract the member, stripping a leading `./`
- Diff rules:
  - Equal contents → `identical`, or `empty` when both are empty or absent.
  - A NUL byte in the first 8192 bytes, or invalid UTF-8 → `binary`.
  - Otherwise a unified diff with **3** context lines and a cap of **4000** lines (`truncated`). Strip `\r\n`.
- Only the currently selected file renders. Selecting another file cancels the in-flight load.

---

## 8. Chats tab

Reference: `page-projects-tabs-conversations.png` (dark, live; `sante-production` has no chats, so it shows "Chats 0" and the empty label).

- One `ListGroup`: icon `mouse-pointer-2`, title "Chats", count = number of sessions (shows "0"), trailing `+` with tooltip "New chat" (navigates to `agents` with `{new: true, projectId}`), empty label "No chats about this project yet.". Shows `loading` until the sessions load.
- Data:
  - `GET /v1/sessions?limit=50&projectId={id}` in the 15s detail poll. A failure is logged and treated as `[]`.
  - Agent runs come from the store (`agent_runs`). When a new run for this project appears, the detail poll refreshes.
- Session row (`RecordRow`, icon `mouse-pointer-2`):
  - Status glyph: when `agentRunId` matches a run, use the run state: running "Working" (info), succeeded "Done" (success), failed "Failed" (danger), cancelled "Cancelled" (warning). Otherwise "Active" (success) when `active`, else no status (neutral `circle` glyph with no tooltip).
  - Title: `title` with whitespace collapsed, or "Untitled chat".
  - Subtitle: `preview`.
  - Meta: the source ("Agent run" / "Terminal" / "Claude Code"), the relative `lastActiveAt`, and the tokens (compact count, e.g. "12.3k tokens").
  - Target: navigate to `agents` with `{runId: agentRunId}`, or to `terminals` with `{terminalId}`. With a target, the row has a hover action `arrow-right` "Open chat" and is clickable; otherwise there are no actions.

---

## 9. Emulator panel and launch flow

This covers the fourth quick-action button in the detail header and what it does. It applies to the host Android emulator described in `docs/architecture/app-runs-and-emulator.md`. In Electron, the host daemon is the local "host shell" on port **7701**; it runs the emulator with KVM, WHPX or HVF using the AVDs that onboarding created.

### 9.1 Button state (`display_button`)

Inputs:

- run targets: `GET /v1/projects/{id}/run-targets`, which returns `[{target, viewer, available, reason?, dir?}]`
- app runs: `GET /v1/app-runs?projectId=`, updated live by the WS event `app.updated`
- `project.framework`
- the run-target fetch error

The Android target is the first run target with `viewer == "android"`.

| situation | label | icon | enabled | tooltip |
|---|---|---|---|---|
| no Android target and framework not in `expo`, `react-native`, `android` | "Display" | `monitor` | yes, navigates to `display` | none |
| no Android target, Android framework, targets still loading | "Open on emulator" | `smartphone` | **no** | none |
| no Android target, Android framework, loaded | "Open on emulator" | `smartphone` | no | "No Android app was detected in this project" |
| no Android target, Android framework, 404 error | "Open on emulator" | `smartphone` | no | "This sandbox can't run apps on the emulator yet; update the sandbox" |
| no Android target, Android framework, other error | "Open on emulator" | `smartphone` | no | "Couldn't read the project's run targets: {error}" |
| Android target, a live run exists (`starting`/`ready`) | "Show emulator" | `smartphone` | yes | see below |
| Android target, no live run | "Open on emulator" | `smartphone` | yes | see below |

Tooltip when there is an Android target:

- available: "Build the app in {dir} and install it on the host Android emulator", or without a dir "Build the app and install it on the host Android emulator"
- not available but host-fixable: "{reason}. Tesseract starts and links the emulator on this computer first"
- otherwise: the reason as given

The button is also disabled while a launch is busy. While busy, the button label is replaced by the progress label (see §9.3). The Display button is a secondary pill, the same size as "Shell".

Host-fixable reasons (exact strings from the controller): "Link the host Android emulator first", "Start the emulator on the host", "The host emulator is not isolated; start it from the app".

### 9.2 Launch (`EmulatorLauncher.launch(target)`)

1. **Target available**: set busy (no label), then call `run_on_emulator`:
   - `GET /v1/app-runs?projectId=`; reuse a live run of the target, or `POST /v1/projects/{id}/app-runs` with `{target}`
   - then `GET /v1/android` to read `emulator.serial`
   - Afterwards clear busy and go to the result handling (§9.4).
2. **Not available and not host-fixable**: report "Can't run on the emulator: {reason}".
3. **Host-fixable**, so prepare the emulator with the host daemon:
   1. **Host blocker**, from the host-shell service state:
      - stopped, stopping or failed: "The host shell isn't running, so Tesseract can't start the emulator. Turn on Serve host shell in Preferences."
      - starting, or pairing unknown: "Tesseract is still reading the host shell settings; try again in a moment."
      - no PIN set: "Set a host shell PIN in Preferences so Tesseract can start the emulator."
      - When blocked, refresh the host-shell state and report the message in the danger notice with a **"Preferences"** action that opens Preferences on the `host-shell` page.
   2. **Not unlocked yet** (no host session): open the `HostUnlockDialog`, which trades the PIN for a session kept in memory (`POST /v1/host/unlock {pin}` on the host daemon). On success, retry from step 3.1.
   3. Set busy with "Checking the emulator…", then `GET /v1/android` on the **host daemon**. If that fails with an auth error, forget the session and retry from 3.1. Any other error reports "The host shell couldn't prepare the emulator: {error}".
   4. **Plan** (`plan_emulator(status, sandboxUrl)`), first match wins:
      - Status unavailable, or emulator state `unavailable`: blocked with `status.reason`, or "The host can't run the Android emulator".
      - `isolation == "none"`: blocked with "The host shell runs with TESSERACT_EMULATOR_ISOLATION=none, so the sandbox may not use its emulator".
      - Emulator `stopping`: blocked with "The emulator is stopping; try again in a moment".
      - Compute these flags:
        - `linked = link.configured && link.sandboxUrl` equals this sandbox URL, comparing trimmed, trailing-slash-stripped, lowercased values
        - `relink = !(linked && link.connected)`
        - `replaces = link.sandboxUrl` when it is configured and connected but not linked to this sandbox
      - If the emulator is `starting` or `running` **and** `isolated`: plan `{link: relink, replaces}`.
      - Otherwise pick an AVD: the current `emulator.avd` if it is in `avds`, else the first AVD. With none: blocked with "This computer has no Android virtual device; create one in Android Studio". In Electron, point this at the onboarding emulator step instead.
      - Plan `{stop: state is starting or running, avd, link: relink, replaces}`.
      - A blocked plan reports "Can't run on the emulator: {blocked}".
   5. **Confirm**:
      - If `stop` (non-isolated emulator running):
        - Title: "Restart the emulator isolated?"
        - Body: "The running emulator was started outside Tesseract, so the sandbox may not use it. Tesseract stops it and starts {avd} in an isolated network."
        - Buttons: "Restart" (destructive) / "Cancel"
        - Then, if `replaces` is set, the relink confirm follows.
      - If `replaces` is set:
        - Title: "Link this sandbox instead?"
        - Body: "The host emulator is linked to {url}. Linking it to this sandbox ends that link."
        - Buttons: "Link" (**non-destructive**, primary) / "Cancel"
      - Otherwise proceed with no dialog.
   6. **Prepare**, off the UI thread (main process). Each stage updates the busy label and toasts the label, except `booting`, which only updates the label:
      - `stopping`, "Stopping the emulator…": `DELETE /v1/android/emulator` on the host daemon. Then poll `GET /v1/android` every **2s** until the state is `stopped` or `failed`. Timeout **60s**: "The emulator did not stop in time".
      - `starting`, "Starting the emulator…": `POST /v1/android/emulator` with `{avd}`.
      - `linking`, "Linking the emulator to the sandbox…": `POST /v1/android/link` with `{sandboxUrl: controller base URL, token: controller token}`.
      - `booting`, "Waiting for the emulator…": poll every 2s until the emulator is `running`, `isolated`, linked to this sandbox and `connected`. Timeout **330s**: "The emulator did not boot within 6 minutes". If the state goes `failed` before that, raise "The emulator failed: {error or 'unknown error'}".
      - Then poll `GET /v1/projects/{id}/run-targets` on the sandbox every 2s until the target exists and is `available`. Timeout **60s**: "The sandbox did not pick up the emulator within 60 seconds".
      - Then `run_on_emulator`, as in step 1.
   7. Errors: a host request error reports "The host shell couldn't prepare the emulator: {error}" and forgets the session if it was an auth error. Any other error reports "Couldn't run on the emulator: {error}". Busy is cleared in every case.

### 9.3 Busy labels (`EMULATOR.progress`)

- `checking`: "Checking the emulator…"
- `stopping`: "Stopping the emulator…"
- `starting`: "Starting the emulator…"
- `linking`: "Linking the emulator to the sandbox…"
- `booting`: "Waiting for the emulator…"

While busy the button is disabled and shows this text in place of its label. Crossfade the label change over 120ms, and add a 16px spinner in place of the icon. GTK keeps the static `smartphone` icon; the spinner is an Electron improvement.

### 9.4 Result handling (`_on_emulator_run`)

1. Upsert the app run so the button switches to "Show emulator".
2. If a run was started: toast "Building for the emulator; the app opens there when the build finishes".
3. Viewer: GTK spawns `scrcpy --serial {serial} --window-title "{name} · Android emulator" --no-audio`, one window at a time; opening it again while it runs does nothing.
   - scrcpy not installed: toast "The app runs on the emulator; install scrcpy to see its screen here".
   - no serial: report "The emulator is not reachable from this machine".
   - scrcpy exits non-zero: report "Couldn't show the emulator: {msg}", where `msg` is the last `ERROR:` line of stderr (keep the last 20 lines), or "scrcpy exited with code {code}".
   - In Electron, do the spawn in the main process behind IPC. Use the same single-instance rule and the same messages.

---

## 10. Detail-level data flow (what feeds the tabs)

- One poller fetches every **15s** while the detail is mounted and on screen. It calls, in this order:
  - `GET /v1/projects/{id}`
  - `GET /v1/processes?projectId=`
  - `GET /v1/builds?projectId=`
  - `GET /v1/artifacts?projectId=`
  - `GET /v1/projects/{id}/run-targets` and `GET /v1/app-runs?projectId=` (one try; a failure goes into `run_targets_error`)
  - `GET /v1/sessions?limit=50&projectId=` (a failure is ignored)
  - `GET /v1/claude/accounts` (a failure is ignored)
  - `GET /v1/projects/{id}/git` when `project.git` is set (a failure goes into `git_error`)
- WebSocket events (match on `projectId`): `process.updated`, `build.updated`, `artifact.created` (upsert); `artifact.deleted` (remove by id); `app.updated` (upsert the app run).
- If the initial load fails, the detail shows the error empty state "Couldn't load this project" with "Try again". If a later refresh fails, the danger notice shows the error. The notice hides after the next successful load.
- The header refresh button (`refresh`, "Refresh") re-polls the detail and the sync view, and refreshes the workspace.

---

## 11. GTK quirks NOT to copy

1. **The destructive secondary button is broken.** "Discard changes" uses `destructive-action` together with `to-secondary`. The secondary rule wins at rest, so the button looks neutral in dark mode and only turns red on hover. In light mode its label is **white on white** and invisible; `page-projects-tabs-sync-light.png` shows an empty pill. Electron: render it as a secondary pill with readable `text`, and on hover/press use background `dangerSolid` with white text.
2. **The attention class on the primary Sync to host does nothing.** Do not invent a style for it; only the secondary "Sync from host" shows attention.
3. **Git subtitle says "Clean" while loading.** Before the details load, `files` is empty, so the subtitle reads "… · In sync · Clean" over a spinner (seen in a first, too-early capture during this survey). Show "Clean" only after the details have loaded.
4. **Group counts show "0"** ("Builds 0", "Chats 0") while the tab pills hide zero. Keep both behaviors to match pixel-for-pixel; they are intentional Linear-style band counts.
5. **Scripts sit below the log panel** in the Processes tab, because GTK appended them after the panel. Keep the order (screenshots match), but render the panel directly under the Processes group.
6. **Hover-actions overlay** covers the meta text with no fade. Add a 120ms opacity fade; positioning is unchanged.
7. **The snapshot tool clamps at 1024×768.** Broadway's virtual monitor is 1024×768, so every reference PNG is 1024×768 even though 1440×900 was requested. Layout numbers in this spec are exact; widths in the PNGs are not representative of 1440px.
8. **Unused strings.** `SYNC["syncing"]`, `SYNC["get_confirm"]` and `SYNC_REVIEW["lines"]` are defined but never used, and the diff line kind `note` is never produced. Don't build UI for them.
9. **`EmulatorViewer` is a module-global singleton** shared by all projects. In Electron, keep one scrcpy child per serial in the main process.
10. **Sync-review sidebar divider.** GTK lets the user drag the divider in the sync review, but it has no min/max and isn't persisted. A fixed 360px sidebar is acceptable.
11. **Blocking polls.** `prepare_emulator` blocks a worker thread with `time.sleep` polling. In Electron, use async polling with an `AbortController` tied to the window/project. If the user navigates away, the flow keeps running, as in GTK, but must not update unmounted components.

---

## 12. Reference screenshots

All were captured headless with `apps/desktop/tools/snapshot.sh --zoom 1 --width 1440 --height 900 --page projects --params '{"projectId":…, "tab":…}'`. They are clamped to 1024×768 (see quirk 7). Data is **live** from the user's sandbox. The sidebar on the left belongs to the shell spec.

| file | shows |
|---|---|
| `docs/electron/reference/page-projects-tabs-processes.png` | Dark. "streaxfit" (`nimble-lotus`, Confidential, Node · pnpm). The tab pill reads "Processes 1" and "Chats 4". **Listening ports 2** with rows ":41653 java" and ":41769 java", URLs right-aligned in the meta. **Processes 7**: one running row (green `circle-check`, "started 13m ago · :8081 · pid 86081"), failed rows (red `circle-x`, "ran 1s · ended 5h ago · :8081 · exit 1"), and exited rows (grey circle, "exit 0"). The `+` sits at the right of the band. The quick-action button reads "Show emulator" because a live Android app run exists. |
| `…-processes-light.png` | The same data in light mode. The group bands are invisible (white on white), the dividers are faint and the tab pill is `#E7E7EA`. |
| `…-builds.png` | Dark. "hybrid-pos" (`brave-hare`, Electron · bun). The **Build targets** band has an ellipsized subtitle and the Debug (selected) / Release chips on the right. Three target rows each have an always-visible "▷ Build" secondary pill. **Builds 0** shows the empty label "No builds yet.". The quick-action button is "Display" (non-Android). |
| `…-artifacts.png` | Dark. "sante-production" (Expo). The empty state shows the files glyph, "No artifacts yet" and the message. The quick-action button is "Open on emulator". The Claude-account dropdown wraps onto a second line. |
| `…-git.png` | Dark. The **Working tree 5** band has the subtitle "prod/storefront-fixes · In sync". Four rows have a yellow `M` code (.env, app.json, bun.lock, package.json) with "Modified" meta, and one has a blue `??` (feature_deploy.md) with "Untracked". **Recent commits 20** rows have the commit glyph, a subject and "sha · author · YYYY-MM-DD". |
| `…-git-light.png` | The same in light mode. The `M` code is dark amber `#8F6400` and `??` is blue `#1F6FCB`. |
| `…-sync.png` | Dark. Linked project with no sandbox changes. The summary card shows Host folder, Linked "7h ago", Last get "—" and Sandbox baseline "7h ago". "Sync to host" is disabled (indigo at 50% opacity). "Sync from host" has the attention style (indigo-muted fill, indigo border and text). Revert is disabled and Discard is shown neutral. All three groups show their empty labels, and the Snapshots band shows its subtitle. |
| `…-sync-changes.png` | Dark. "hybrid-pos", with "Sync back 12" in the tab pill. "Sync to host" is enabled (solid indigo) and "Discard changes" is enabled (neutral). The **Sandbox changes** subtitle reads "12 files · 721 KB". Rows have green `A` and yellow `M` codes, mono paths and right-aligned sizes. |
| `…-sync-light.png` | Light, same project as `sync.png`. It shows quirk 1: the Discard pill renders as an empty white pill with an invisible label. |

The log panel, the hover actions, the confirm dialogs, the sync review dialog and the emulator busy states need interaction and could not be captured by the snapshot tool. They are specified numerically above.
