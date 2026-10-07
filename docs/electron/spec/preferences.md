# Preferences ("Settings") window — Electron rebuild spec

Source of truth: `apps/desktop/monolith_desktop/preferences/**` plus the widgets, strings, theme and services it uses
(`widgets/preference_rows.py`, `widgets/radio_rows.py`, `widgets/dialog.py`, `widgets/badges.py`, `widgets/buttons.py`,
`widgets/confirm_dialog.py`, `widgets/host_pin_dialog.py`, `strings.py`, `theme/extras/dialogs.py`, `theme/css.py`,
`theme/tokens.py`, `theme/semantic.py`, `theme/palette.py`, `config/storage.py`, `services/connection.py`,
`hostshell/service.py`, `claude/model.py`, `claude/host.py`, `stt/model.py`).

All strings below are quoted verbatim; `…` is the single Unicode ellipsis (U+2026), `·` is U+00B7, `—` is U+2014,
`›`/caret is an icon, not text. Put every string in a labels module, every number in a constants module (CODING.md).

---

## 1. Entry points

| Trigger | Opens on page |
|---|---|
| App action `preferences` (main menu "Preferences", `Ctrl+,` in the GTK app) | first page (`connection`) |
| Sidebar footer status button (tooltip "Connection settings") | `connection` |
| Connection banner buttons "Set Up" / "Fix Connection" / "Details" | `connection` |
| Overview page "set up" action | `connection` |
| Emulator launch blocker "Preferences" action (`pages/projects/emulator_launch.py`) | `host-shell` |

API: `openPreferences(pageId?: PageId)`. Unknown ids fall back to the first page. Only one instance should exist; the
GTK app actually creates a new dialog per call (quirk — do not copy: focus the existing one and switch page instead).

Page registry (sorted by `order`, then id). Pages are discovered dynamically in GTK; in React use a static array.

| order | id | Title (nav + breadcrumb) | Icon key | Lucide icon |
|---|---|---|---|---|
| 0 | `connection` | "Connection" | `connection` | `plug` |
| 5 | `appearance` | "Appearance" | `appearance` | `sun-moon` |
| 10 | `claude` | "Claude" | `agents` | `mouse-pointer-2` |
| 15 | `host-shell` | "Host shell" | `host` | `monitor` |
| 20 | `stt` | "Speech-to-text" | `microphone` | `mic` |

---

## 2. Window chrome (SettingsDialog)

A modal sheet over the main window (Adw.Dialog), not a separate OS window. Recommended in Electron: an in-renderer modal
(portal) over the app shell, not a `BrowserWindow`.

### 2.1 Geometry (measured on the reference PNGs, 1 css px = 1 device px)

```
backdrop (overlay color, full window)
└─ sheet  882 × 622 incl. 1px outer border, radius 12, centered in the window
   └─ root  880 × 620, bg = background (#09090A dark / #F5F5F6 light), radius 12, row layout
      ├─ nav     216 wide (min-width 200 + padding 12px top/bottom, 8px left/right), column, gap 4
      │   ├─ overline "Settings"  (padding 4px 8px)
      │   └─ list of nav rows (each 200 × 28, 1px gap below)
      └─ content panel  flex 1 (656 × 604), margin 8px 8px 8px 0, radius 10, 1px border, bg = surface
          ├─ header  40px tall (+1px divider), padding 8px 8px 8px 16px
          └─ scroll area (vertical only) → page column
```

- Content width 880, content height 620 (`SETTINGS_SIZE = (880, 620)`). Fixed size; on windows smaller than that,
  libadwaita turns it into a bottom sheet — do NOT copy; instead clamp to `min(880, vw - 32) × min(620, vh - 32)`.
- Sheet: radius 12, border 1px `border`, shadow `0 16px 48px rgba(0,0,0,0.5)` (level4). The root fully covers the sheet
  surface, so the visible fill is `background`. The measured 1px outer ring is `#3A3A3B` in dark (libadwaita dialog
  outline over the dim); use `1px solid rgba(255,255,255,0.08)` + the shadow, close enough.
- Backdrop: `overlay` = `rgba(0,0,0,0.55)` dark, `rgba(0,0,0,0.28)` light.
- Escape closes. Clicking the backdrop closes (Adw.Dialog default `can-close`).
- The dialog title for a11y: "Settings".

### 2.2 Nav column

- Overline label "Settings": 12px / 16px line, weight 500, color `textSecondary`, padding `4px 8px`.
- List: no background. Single selection, always one selected (first page selected on open).
- Nav row: height 28 (min-height), padding `0 8px`, margin-bottom 1px, radius 6. Content row gap 10:
  icon 16px (`textSecondary`), label 13px/18px weight 500 color `text`.
  - hover: bg `backgroundElement` (#1E1E20 dark / #EEEEF0 light).
  - selected: bg `backgroundSelected` (#232325 / #E7E7EA), label `text`, icon turns `text`.
  - Measured: first row top at y = sheet top + 41; rows pitch 29px; row x-span 200px.
- Keyboard: Up/Down move selection (GTK ListBox), Enter/Space select. Selecting a row immediately switches the page
  (no confirm, no unsaved-changes guard).

### 2.3 Content panel

- margin `8px 8px 8px 0`; radius 10 (`card`); border `1px solid border`; bg `surface` (#121213 / #FFFFFF).
- Header (`DialogHeader` with the settings overrides):
  - padding `8px 8px 8px 16px`, min-height 24, bottom border `1px solid divider`. Measured total 40px + 1px divider.
  - Left: breadcrumb, gap 6, vertically centered:
    `[settings icon 16, textSecondary] [gap 6] "Settings" (13/20, 500, textSecondary)` `[caret-right 16, textTertiary]`
    `<Page title>` (13/20, 500, `text`). In this dialog the context chip has no background and no padding
    (elsewhere it is a 24px pill with `backgroundSelected`).
  - Right: close icon button "Close" (tooltip + aria-label), 24 × 24, radius 6, icon `x` 16px, color `textSecondary`,
    hover color `text` + bg `backgroundElement`.
  - The breadcrumb title updates when the nav selection changes.
- Page area: vertical scroll (overlay scrollbar: 6px slider, `rgba(255,255,255,0.12)` / hover `0.22`; black on light).
  No horizontal scroll.
- Page column (Adw.PreferencesPage → Clamp → box): margin `20px 24px 32px 24px`, groups stacked with gap 24.
  Measured column width at the 880 dialog: **576px**, centered (39px gutters in the 654px inner width). Implement as
  `max-width: 576px; margin: 0 auto; padding: 20px 24px 32px`.

### 2.4 Page switching

GTK uses a Stack crossfade (default 200ms). Electron: crossfade 160ms ease-out (opacity only; optionally 4px y-offset
on enter), and reset scroll to top when the page changes. Each page keeps its state while the dialog is open
(GTK builds all five pages once at open). All pages are created on open, so all pages start loading at open, not
when first shown — keep that (data is ready when the user switches).

### 2.5 Toasts

`dialog.add_toast(...)` shows toasts inside the dialog (Adw.ToastOverlay over the root, bottom-center).
- Toast: radius 8, bg `surfaceElevated` (#1A1A1B / #FFFFFF), border `1px solid border`, shadow `0 8px 24px
  rgba(0,0,0,0.4)` (level3), text 13px `text`, padding ~ `10px 12px`, margin-bottom 12.
- Timeout: default 5s (Adw default); the ones marked "6s" below use 6s.
- New toast replaces the visible one (Adw queues; replacing is fine and snappier).
- Motion: slide up 8px + fade, 180ms ease-out in, 120ms out.

---

## 3. Shared row/group anatomy (Adw.PreferencesGroup / ActionRow equivalents)

Build these as reusable components: `SettingsGroup`, `SettingsRow`, `PropertyRow`, `EntryRow`, `ButtonRow`,
`SwitchRow`, `RadioRow(s)`, `ExpanderRow`, `SettingsActions`.

### 3.1 SettingsGroup

- Header: title 13px weight 500 `text`; description 12px `textSecondary`, wraps; title→description gap 2–4px
  (Adw default). Optional `headerSuffix` (a 28 × 28 flat icon button, vertically centered against the title +
  description block, right-aligned).
- Gap between header block, list and actions: 8 (`border-spacing 8`).
- Boxed list: bg `surface`, `1px solid border` (#252526 measured dark = rgba(255,255,255,.08) over #121213; #E8E8E8
  light), radius 8, rows separated by `1px solid divider` (#202021 dark / #F0F0F0 light); no divider after last row.
- Groups with zero rows render only their header.

### 3.2 Row

- Row header: margin `0 14px`, min-height 44; title box margin `8px 0`, title/subtitle gap 2.
- Title 13px `text` weight 400; subtitle 12px `textSecondary`, opacity 1. Measured: two-line row (title + 1-line
  subtitle) is 53px + 1px divider; single-line row 44px. (Titles look slightly heavy in the PNGs; that is cairo
  rendering of Inter 13px — still use 400.)
- Prefix slot (radio) then text block (flex 1), then suffix slot (gap 12).
- Activatable rows (radio rows) hover bg `backgroundElement` (#1E1E20 / #EEEEF0); transition 120ms
  `cubic-bezier(0.2,0,0,1)` on background/color/border/opacity.
- Insensitive rows: whole row opacity 0.5 (Adw dims to ~50%), not clickable.
- Subtitles can be multi-line (`\n` in data) — render with `white-space: pre-line`.

### 3.3 PropertyRow (read-only key/value, class `property`)

Inverted emphasis: title = key, 12px `textSecondary`; subtitle = value, 13px `text`. Value is user-selectable
(`user-select: text`) where noted "selectable". Same paddings as a row.

### 3.4 EntryRow

Title on the left; input on the right as suffix, vertically centered.
- Input: min-width 320, height 32, radius 6, bg `surfaceElevated` (#1A1A1B / #FFFFFF), `1px solid border`,
  text 13px `text`, placeholder `textTertiary`, horizontal padding ~10.
  Focus: border `accent` + outline `1px solid focusRing` offset 1 (focusRing = #5E6AD2).
- Password variant: masked with "●" glyphs, trailing eye icon toggle (show/hide, Lucide `eye`/`eye-off`, 16px,
  `textSecondary`).
- Enter in the input runs the row's `onActivate`.

### 3.5 Buttons (ActionButton)

Content: optional 16px icon + label (13/18, weight 500), gap 6, single line.

| variant | look |
|---|---|
| `primary` | height 28, padding `0 14px`, radius 999 (pill), bg `accent` #5E6AD2, text `textOnAccent` (#FFFFFF in the graphite schemes), no border. hover `filter: brightness(1.1)`; active bg `accentPressed` #4F5BC4; disabled opacity 0.5 |
| `secondary` | height 28, padding `0 14px`, radius 999, bg `surfaceElevated`, `1px solid border`, text `text`. hover bg `backgroundElement`, border `borderStrong` |
| `destructive` | see quirk below — render as secondary pill with `danger` text at rest; hover bg `dangerSolid` #EB5757, text #FFFFFF |
| `flat` | transparent; hover `backgroundElement`; active `backgroundSelected` |

Inside rows buttons are min-height 28. All buttons: `:active` scale 0.95, transitions 120ms
`cubic-bezier(0.2,0,0,1)`.

GTK quirk — do not copy: `destructive` = classes `destructive-action to-secondary`; the `to-secondary:not(:hover)`
rule out-specifies `destructive-action`, so at rest it is a grey pill with white text (unreadable on light), and only
turns red on hover. Use the table above instead.

### 3.6 SettingsActions

Right-aligned row of buttons under a group's list (`halign end`, gap 8), in the same 8px group spacing.
Order = insertion order, primary last (rightmost).

### 3.7 SwitchRow

Switch suffix: track 28 × 16, radius 999, off bg `backgroundSelected` (#232325 / #E7E7EA), on bg `accent`; knob 12 × 12
white, margin 2, no shadow. Knob slide 120ms ease-out. The whole row toggles on click. Insensitive → 0.5 opacity
(see Host shell screenshot: "Serve host shell" disabled but on).

### 3.8 RadioRow(s)

Single-choice group; each choice is a row with a radio prefix; clicking anywhere on the row selects.
- Radio: 14 × 14 (renders ~16 incl. border), `1px solid borderStrong`, transparent; checked: bg + border `accent`, white
  inner dot (~6px). Gap radio→text 12.
- Rows sensitive = `choice.available && !busy`.
- Programmatic updates must not fire `onSelect` (GTK uses a `_syncing` flag). In React: controlled `value`, and only
  call `onSelect` from user events, and only when the id differs from the current value.

### 3.9 ExpanderRow

Header row (title + subtitle + chevron `chevron-down` 16px `textSecondary`, rotates to up when expanded, 180ms
ease-out); click toggles. Children: nested list directly below inside the same boxed list, no dividers between
nested rows, nested row min-height 36, background shade **#0F0F11 dark / #F7F7F7 light** (measured; libadwaita nested
list tint; equivalent to `rgba(0,0,0,0.2)` over #121213 and `rgba(0,0,0,0.03)` over white). Expand/collapse: height
auto animation 180ms ease-out (motion `AnimatePresence` + `height`), respect reduced motion.

### 3.10 StatusBadge

Inline pill: height 20, padding `0 8px 0 7px`, radius 999, transparent bg, `1px solid border`; 6 × 6 dot in tone
foreground; gap 4; label 12px `textSecondary`. Tones: neutral → `textSecondary`, info → `info` (#4EA7FC / #1F6FCB),
success → `success` (#4CB782 / #2E8A5B), warning → `warning` (#F2C94C / #8F6400), danger → `danger` (#EB5757 / #C93A3A).

### 3.11 Color tokens used (dark = "graphite", light = "graphiteLight")

| token | dark | light |
|---|---|---|
| background | #09090A | #F5F5F6 |
| backgroundElement | #1E1E20 | #EEEEF0 |
| backgroundSelected | #232325 | #E7E7EA |
| surface | #121213 | #FFFFFF |
| surfaceElevated | #1A1A1B | #FFFFFF |
| text | #E3E3E4 | #1B1B1F |
| textSecondary | #929294 | #5C5D66 |
| textTertiary | #6B6B6F | #7E7F88 |
| border | rgba(255,255,255,0.08) | rgba(0,0,0,0.09) |
| borderStrong | rgba(255,255,255,0.13) | rgba(0,0,0,0.15) |
| divider | rgba(255,255,255,0.06) | rgba(0,0,0,0.06) |
| accent / focusRing | #5E6AD2 | #5E6AD2 |
| accentPressed | #4F5BC4 | #4F5BC4 |
| textOnAccent | #FFFFFF | #FFFFFF |
| dangerSolid | #EB5757 | #EB5757 |
| overlay | rgba(0,0,0,0.55) | rgba(0,0,0,0.28) |

Fonts: Inter (UI), Geist Mono (log). Text selection bg `rgba(94,106,210,0.35)`.

---

## 4. Persistence (shared)

One JSON file: `config.json` in `$XDG_CONFIG_HOME/monolith-desktop/` (default `~/.config/monolith-desktop/`), or the
path in env `MONOLITH_DESKTOP_CONFIG`. Legacy dir `theone-desktop` is renamed on first start if the new one doesn't
exist. Written atomically (`config.tmp` then rename), file mode 0600, dir mode 0700, `JSON.stringify(data, null, 2)`
+ trailing newline. Unknown keys are preserved (read-modify-write).

| key | type | written by | default |
|---|---|---|---|
| `url` | string | Connection › Save | — |
| `token` | string | Connection › Save | — |
| `name` | string? | Connection › Save (omitted when empty) | — |
| `pairingUrl` | string? | Connection › Save (omitted when empty) | — |
| `appearance` | `"system" \| "light" \| "dark"` | Appearance | `"dark"` |
| `zoom` | number | app zoom actions (not in Preferences) | 1.0 |
| `host_shell_autostart` | boolean (`true` only counts if exactly `true`) | Host shell › Start with Monolith | false |

Also readable (`load_file_config`): `apiUrl` as an alias of `url`. Env config (source `env`): `MONOLITH_DESKTOP_URL` +
`THEONE_TOKEN` (+ `MONOLITH_DESKTOP_NAME`, `MONOLITH_DESKTOP_PAIRING_URL`).

Electron: keep the exact schema; on Linux read/write the same path so users migrate seamlessly. On macOS/Windows use
`app.getPath('userData')/config.json` unless `MONOLITH_DESKTOP_CONFIG` is set. All file I/O lives in the main
process behind IPC; the renderer never sees the file path except for display (Connection › Source row).
Never log the token (GTK `redacted()` keeps the first 4 chars + "…").

---

## 5. Page: Connection (`connection`)

Reference: `preferences-connection.png`, `preferences-connection-light.png`.

### Group 1 — "Sandbox controller"
Description: "The desktop app talks to the controller REST API from this machine. Discovery asks Docker for the running
sandbox and picks the first address that answers."

| Row | Control | Value source |
|---|---|---|
| "API URL" | EntryRow (text) | `config.api_url` of the **active** connection (whatever its source) or "" |
| "Token" | EntryRow (password, eye toggle) | `config.token` or "" |
| "Display name" | EntryRow (text) | `config.name` or "" |

SettingsActions (right-aligned): `[search icon] "Rediscover"` (secondary) · `"Save & connect"` (primary).

### Group 2 — "Phone pairing"
Description: "The URL phones use. Leave empty to reuse the API URL."
- "Pairing URL" — EntryRow (text), value `config.pairing_url` or "".

### Group 3 — "Connection status"
- "Status" row (plain row). Subtitle = `state.error_message` ‖ sandbox name (`health.sandboxId` ‖ `config.name`) ‖ "".
  Suffix StatusBadge: label/tone from connection status:
  `unconfigured` "Not configured" neutral · `discovering` "Discovering…" info · `connecting` "Connecting…" info ·
  `online` "Online" success · `offline` "Offline" danger · `unauthorized` "Token rejected" warning ·
  `incompatible` "Incompatible" warning. (No sandbox name prefix in this badge.)
- "Source" row: title `"Source: <label>"` when a config exists, else `"Source"`; labels: `file` "Saved config file",
  `env` "Environment variables", `docker` "Docker discovery", `manual` "Entered manually". Subtitle
  `"Config file: <absolute path of config.json>"`, selectable.
- "Forget saved connection" row, subtitle "Removes the saved URL and token from this computer", suffix button
  "Forget" (destructive variant).

All three status rows update live from the connection store.

### Behaviour
- Enter in any of the four inputs = Save.
- **Save & connect**: 
  1. URL normalized with `parseBaseUrl` (rules below); token trimmed. If URL invalid or token empty → toast
     "Enter a valid http(s) URL and a token" and stop.
  2. Pairing URL trimmed; if non-empty it is normalized — an invalid pairing URL is silently dropped (GTK quirk —
     do not copy; show the same invalid toast or an inline error instead).
  3. Name trimmed, empty → null. `container` is kept from the current config.
  4. Write `url/token/name/pairingUrl` to config.json (remove the four keys first, then add the non-empty ones), connect
     with source `file` (store goes to `connecting` → `online`/…), toast "Connection saved".
- **Rediscover** (disabled while status = `discovering`): store → `discovering`; runs Docker discovery
  (find the sandbox container, read its pairing URL/token, probe candidate API URLs, pick the first that answers).
  - success: connect to the result, then **refill all four inputs** from the result config and toast the result
    message (6s): `"Found <name or container> at <api_url>"` or
    `"Found <name or container>, but none of its addresses answered from this machine"`.
  - failure: reconnect to the previous config if any (else store → `unconfigured` with the error); toast
    `"Discovery failed: <error>"` (6s).
  - Discovery does not write config.json.
- **Forget**: removes the four keys from config.json (other keys stay), clears all four inputs, then runs Rediscover
  (no toast, no confirmation). GTK has no confirmation here — keep it immediate (it's reversible by rediscovery).

`parseBaseUrl(value)` (shared with `packages/client` — reuse the TS implementation if one exists):
trim; must match `scheme://authority path`; scheme http/https only ("URL must start with http:// or https://");
no `@` in authority; host = hostname or bracketed IPv6, lowercased; port 1–65535; default ports dropped; path must not
contain whitespace/control chars/backslash; a trailing `/v<digits>…` or `/ui…` suffix is stripped; trailing slashes
stripped; trailing dot in host removed. Result `scheme://host[:port][path]`.

---

## 6. Page: Appearance (`appearance`)

Reference: `preferences-appearance.png`, `preferences-appearance-light.png` (dark one shows "Dark" selected — the saved
value; light one is a forced light render, so "Dark" is still the selected radio).

### Group — "Theme"
Description: "Choose how Monolith looks on this computer."

RadioRows (all always available):
| id | Title | Subtitle |
|---|---|---|
| `system` | "System" | "Follow the light or dark setting of your desktop" |
| `light` | "Light" | "Light panels with dark text" |
| `dark` | "Dark" | "Dark panels with light text" |

Selected = current appearance (default `dark`). Selecting applies immediately (whole app, including this dialog) and
writes `appearance` to config.json (skipped if unchanged). No toast. `system` follows the OS (`nativeTheme` in
Electron: set `nativeTheme.themeSource` to `system|light|dark` and render `graphite` for dark, `graphiteLight` for
light). Theme swap: crossfade colors 180ms (CSS variable transition on `background-color, color, border-color`), none
with reduced motion.

---

## 7. Page: Claude (`claude`)

Reference: `preferences-claude.png`, `preferences-claude-light.png` — captured with a **synthetic HOME fixture**
(`you@example.com` / `work@example.com`, 2 skill files, token expiring in ~2h) so no personal data is committed; the
Sandbox group below it is live (shows `· /home/dev/.claude`). Only the first two groups fit at 620px; the Accounts
group is below the fold.

### Group 1 — "This computer"
Description: "Loading…" until the first read finishes, then
"Claude Code accounts on this machine (~/.claude and ~/.claude-<name>)" (plain text; GTK markup-escapes it).

One ExpanderRow per host account, in order: primary (`claude`, from `$CLAUDE_CONFIG_DIR` or `~/.claude`), then every
`~/.claude-<name>` directory (name `^[a-z0-9][a-z0-9_-]{0,31}$`, sorted) that contains `.credentials.json` → id
`claude-<name>`. Only the **first created** expander starts expanded; later refreshes keep each expander's state,
remove accounts that disappeared and append new ones.

- Expander title: account id. Subtitle: `"<email> · <config dir>"` (email omitted if unknown).
- Nested PropertyRows:
  | key | value |
  |---|---|
  | "Login" | "Signed in" / "Login not found" (no credentials file) / "Login file is unreadable" / "Login not found (macOS keychain not supported)" (always on macOS) |
  | "Account" | `"<email> · <organization>"`, or "—" |
  | "Plan" | subscription type capitalized (`_`/`-` → space, first letter upper, e.g. "Max"), or "—" |
  | "Access token" | if signed in: `"Expires in <d>"` or `"Expired <d> ago · Claude Code refreshes it on next use"`; else "—" |
  | "Settings" | join with " · " of: "settings.json" (if regular file), "CLAUDE.md" (if regular file), then counts `"<n> skill file(s)"`, `"<n> agent file(s)"`, `"<n> command file(s)"`, `"<n> output style file(s)"` (only non-zero; recursive regular files, symlinks ignored, skipping `.git .hg .svn node_modules __pycache__`) — or "No settings found" |
- Duration format `<d>` (`format_uptime`, minimum 60s): `<1m` → "Ns"; `<1h` → "Nm"; `<1d` → "Nh Mm" / "Nh";
  else "Nd Hh" / "Nd".
- Data source (main process, read-only): `<dir>/.credentials.json` → `claudeAiOauth.{accessToken,subscriptionType,
  expiresAt(ms)}`; `.claude.json` (primary: `~/.claude.json`, or `<CLAUDE_CONFIG_DIR>/.claude.json`; extra accounts:
  `<dir>/.claude.json`) → `oauthAccount.{emailAddress,organizationName,displayName}`. Never send tokens to the renderer.

### Group 2 — "Sandbox" (header suffix: refresh icon button, tooltip "Refresh")
Description: "Claude Code inside the sandbox uses this computer's ~/.claude folders (linked)" and, once loaded,
`" · <configDir>"` appended.

PropertyRows (selectable):
- loading: one row "Status" / "Loading…"
- offline: one row "Status" / `"<connection label with name>"` + `" — <error>"` if any (e.g. "theone-sandbox · Offline — …")
- error: "Status" / error text; a 404 → "This sandbox is too old for Claude sign-in. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`." (backticks are literal)
- loaded (`GET /v1/claude/auth`):
  | key | value |
  |---|---|
  | "Status" | not available → "Claude Code is not installed in the sandbox"; `oauth_token`+fromEnv → "Signed in with a long-lived token from the environment"; `oauth_token` → "Signed in with a long-lived token"; `credentials` → "Signed in with this computer's login"; `api_key` → "Using an API key"; `none` → "Not signed in" |
  | "Account" | "<email> · <organization>" or "—" |
  | "Plan" | capitalized or "—" |
  | "Access token" | only for method `credentials`: expiry of `credentialsExpiresAt` (ISO) as above; else "—" |
  | "Settings" | "settings.json present" / "No settings.json" |

### Group 3 — "Accounts"
Description: "Accounts linked into the sandbox. The default is used by projects that don't pick one."
- Message PropertyRows above the radios: loading "Status"/"Loading…"; offline/error like group 2 (404 →
  "This sandbox is too old for multiple Claude accounts. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.");
  empty list → "Status"/"No accounts"; otherwise none.
- RadioRows from `GET /v1/claude/accounts` (`{defaultAccountId, accounts[]}`), selected = `defaultAccountId`:
  - title: `id` + `" · primary"` when `primary`.
  - subtitle, 3 lines (empty lines dropped): `"<email> · <organization>"` or "—"; `"<Plan> · <login>"` where login =
    "Not linked into the sandbox" (`!present`) / "Not signed in" / `"Signed in · <expiry>"`; `configDir`.
  - available = `present`. All rows insensitive while a change is pending.
- Select → `PUT /v1/claude/accounts/default {"accountId": id}`; success: toast
  `"Default Claude account set to <id>"`, reload groups 2–3, refresh the workspace (project list); failure: toast
  `"Couldn't change the default Claude account: <error>"` (6s) and the radio reverts.

### Loading lifecycle
- Host read on open and on refresh (off the UI thread; IPC in Electron).
- Sandbox calls fire when the connection becomes online (transition offline→online), and on refresh (only if online).
  Going offline replaces groups 2–3 content with the offline message. Cancel in-flight requests when the dialog closes
  (AbortController).

---

## 8. Page: Host shell (`host-shell`)

Reference: `preferences-host-shell.png`, `-light.png` — live data: the user's host daemon on 7701 is running outside the
app, so status is "Running outside Monolith · https://archlinux.tail511d9d.ts.net:8443", the Serve switch is on but
disabled, PIN set, autostart off, Log collapsed.

### Group 1 — "Server" (header suffix: refresh icon button "Refresh" → probe)
Description: "Lets paired phones open a terminal on this computer over Tailscale. Monolith runs it in the background and
stops it when you quit."
- SwitchRow "Serve host shell": on = `status ∈ {running, external, starting}`; disabled when `status ∈ {stopping,
  external}`; subtitle by status:
  `stopped` "Stopped" · `starting` "Starting…" · `running` "Running · <url>" (or "Running" without pairing url) ·
  `stopping` "Stopping…" · `external` "Running outside Monolith · <url>" · `failed` "Failed: <error>".
  User toggles: on → start the daemon (`<controller> host serve` child process, owned by the app); off → stop
  (SIGTERM, SIGKILL after 5s). Programmatic state updates must not trigger start/stop.
- SwitchRow "Start with Monolith", subtitle "Start serving whenever Monolith opens": writes `host_shell_autostart`
  to config.json immediately. At app start, if true → start, else probe.

### Group 2 — "Security"
- "PIN" row: subtitle "Set · phones unlock with it" / "Not set · phones can't unlock the shell"; suffix secondary
  button "Change…" / "Set PIN…" → Host PIN dialog (§8.1).
- "Host token" row, subtitle "Paired phones use it to reach this computer", button "Rotate…" (secondary) → confirm
  dialog (§8.2).

### Group 3 — "Pairing"
- "Pair a phone" row, subtitle "Show the theone://host link and QR code", button "Show QR…" (secondary) → the Pair
  dialog on its "This computer" tab (see the pair dialog spec; not part of this page).
- ExpanderRow "Log" (collapsed by default; no subtitle). Content: monospace (Geist Mono) 12px label, wraps,
  selectable, margins 8px top/bottom 12px left/right, last **40** lines of the daemon output joined by "\n", or
  "No output yet". (Service keeps 200 lines.) Auto-update while open; in Electron keep scroll pinned to bottom.

### Service semantics (main process)
- Probe = run `<controller> host pair --json` (30s timeout), parse the last `{…}` line `{link,url,name,pinSet}`, then if
  not owned: `GET <url>/v1/health` (1.5s) and treat `{ok:true, service:"host-shell"}` as `external`.
- `<controller>` = `MONOLITH_CONTROLLER_COMMAND` (shell-split) or `bun apps/controller/src/index.ts` from the checkout;
  in the packaged app use the bundled `monolith` CLI. Errors: "Bun is not installed or not on PATH; install it from
  bun.sh", "The controller did not answer in time", "The controller printed no pairing link", CLI's last `error:` line.
- Starting → `running` when a stdout line contains "host shell listening", then re-probe. Exit code ≠ 0 while not
  stopping → `failed` with the last error line. On app quit: SIGTERM, wait 3s, SIGKILL. Linux: wrap with
  `setpriv --pdeathsig TERM --` when available.
- Re-probe after PIN set and token rotation.

### 8.1 Host PIN dialog (opens above Settings, toasts go to Settings)
Form dialog, width 400, breadcrumb context chip `[monitor] "This computer"` › title "Host shell PIN", subtitle
"6 to 12 digits". Group description "Saving a new PIN ends every open phone session." Fields (password):
"New PIN", "Repeat PIN". Footer: "Cancel" (flat, left) · "Save PIN" (primary pill, right).
Validation on submit: `^[0-9]{6,12}$` else field error "The PIN must be 6 to 12 digits" on New PIN; mismatch →
"The PINs do not match" on Repeat PIN. Busy while saving; runs `host pin --stdin` with `"<pin>\n"` on stdin (never argv).
Success: close + Settings toast "Host shell PIN saved". Failure: inline error "Couldn't save the PIN: <error>".

### 8.2 Rotate confirm
Confirm dialog width 420, heading "Rotate the host token?", body "Every paired phone stops working until you pair it
again." (13px `textSecondary`), footer right: "Cancel" (flat, focused by default) · "Rotate" (destructive: bg
`dangerSolid`, text `textOnAccent`, no border, height 30). Confirm → `host token --rotate` → toast
"Host token rotated; pair your phones again" or "Couldn't rotate the token: <error>" (6s).

---

## 9. Page: Speech-to-text (`stt`)

Reference: `preferences-stt.png`, `-light.png` — live sandbox data: profile Eco, Gemini key not set
(`gemini-2.5-flash`); the Status group is below the fold (only its header is cut at the bottom edge).

### Group 1 — "Resource usage"
Description: "Voice notes are transcribed locally with whisper.cpp inside the sandbox. Pick how much of this computer it
may use."

Four radio rows, fixed order `off, eco, balanced, performance`, always rendered:
| id | Title | Line 1 |
|---|---|---|
| off | "Off" | "Voice notes are not transcribed" |
| eco | "Eco" | "Lowest impact: base model, 2 threads, idle CPU and disk priority" |
| balanced | "Balanced" | "Faster: base model, a quarter of the CPU cores, low CPU priority" |
| performance | "Performance" | "Most accurate: small model, half the CPU cores, normal priority" |

Line 2 (not for `off`; from `status.profiles[id]`): `"<model> · <n> thread(s) · nice <n>"`, parts omitted when
null/0 (e.g. "small · 4 threads"). Line 3 when loaded and unavailable: "Model not installed in the sandbox".
Availability: `off` always; others `profiles[id].available`. Row sensitive = loaded && available && !pending.
Checked = loaded && `status.profile === id` (nothing checked before load).
Select (user only, different from current) → pending (all controls disabled) → `PUT /v1/stt {"profile": id}` →
toast `"Speech-to-text set to <Title>"`; failure toast `"Couldn't change speech-to-text: <error>"` (6s); radios
re-render from the server status either way.

### Group 2 — "Gemini"
Description: "Cloud transcription for voice notes sent with the Gemini provider. The key is stored on the sandbox and
shared with the mobile app."
- EntryRow "API key" (password, eye toggle). Subtitle: `"<source> · <model>"` where source = "Saved from an app"
  (`settings`) / "Not set"; empty before load. Input never shows the stored
  key; it is always empty after load/save. Disabled until loaded and while pending.
- SettingsActions: "Remove saved key" (destructive; visible only when source = `settings`; disabled while pending) ·
  "Save" (primary; disabled until loaded / while pending).
- Save (button or Enter): trimmed key non-empty → `PUT /v1/stt {"geminiApiKey": key}` → clear input, toast
  "Gemini API key saved". Remove → `{"geminiApiKey": null}` → toast "Gemini API key removed". Failure toast
  `"Couldn't update the Gemini API key: <error>"` (6s). Empty input: silently ignored (consider disabling Save when
  empty — GTK leaves it enabled).

### Group 3 — "Status" (header suffix: refresh icon button "Refresh"; no description)
PropertyRows (selectable):
- before load "Status"/"Loading…"; offline "Status"/`"<connection label> — <error>"`; error 404 →
  "This sandbox is too old for speech-to-text settings. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`."
- loaded (`GET /v1/stt`): "Engine" (engine or "—"), "Model" (or "—"), "State" ("Ready" or "Not ready · <reason>"),
  "Activity" ("Idle"/"Transcribing" + " · <n> queued" when >0), "CPU cores" (number or "—").
Loads on offline→online transition and on refresh; requests cancelled when the dialog closes.

---

## 10. Motion summary (Electron)

Use `motion` with tokens from the shared constants module; disable (duration 0) under `prefers-reduced-motion`.
- Dialog open: backdrop fade 180ms; sheet opacity 0→1 + scale 0.98→1, 180ms `cubic-bezier(0.2,0,0,1)`; close 120ms.
- Page switch: 160ms crossfade.
- Hover/active colors: 120ms. Button press: scale 0.95. Switch knob 120ms. Expander chevron + height 180ms.
- Toasts: 180ms in (y +8 → 0, fade), 120ms out.
- Pending states: dim controls (opacity 0.5) with a 120ms fade; no spinners in GTK — optional 12px spinner in the
  primary button while saving.

## 11. GTK quirks not to copy

1. New dialog per `open_preferences` call; refocus the existing one instead.
2. Bottom-sheet fallback on small windows; clamp the modal instead.
3. Destructive pill renders grey/white at rest (CSS specificity bug) — use danger text + red hover.
4. Invalid Pairing URL silently dropped on Save.
5. Rediscover refills the inputs, overwriting unsaved edits without warning (keep behavior, but it is surprising — at
   least do it only when the result has a config; GTK fills empty strings when `result.config` is None).
6. Claude host group description uses Pango markup escaping; render plain text.
7. Libadwaita nested-list tint and the `#3A3A3B` outer ring come from Adwaita defaults, not tokens — use the measured
   values given above.
8. Gemini "Save" enabled with an empty input (no-op).
9. All pages fetch on open even if never viewed (acceptable; keep, it's cheap).

## 12. Reference screenshots

Captured with `apps/desktop/tools/snapshot.sh <out> --zoom 1 --width 1440 --height 900 --delay 7 --prefs <id> [--light]`
and a temporary empty `MONOLITH_DESKTOP_CONFIG` (so the app discovered the live sandbox via Docker and did not
autostart anything). **Broadway clamps the window to 1024 × 768**, so the main window is 1024 × 768, not 1440 × 900;
the Settings sheet is still its real 882 × 622 at (71, 73).

| file | shows |
|---|---|
| `docs/electron/reference/preferences-connection.png` / `-light.png` | Connection page, live: API URL `http://172.22.0.2:7700`, masked token, name `theone-sandbox`, Rediscover + Save & connect, pairing URL (tailnet), status Online badge, Source: Docker discovery, config path `/tmp/monolith-test-prefs-cfg/config.json`; Forget row below the fold |
| `preferences-appearance.png` / `-light.png` | Theme group with 3 radio rows, Dark checked; large empty area below |
| `preferences-claude.png` / `-light.png` | Synthetic host accounts (`claude` expanded with 5 property rows, `claude-work` collapsed), Sandbox group header with refresh + live configDir, first Status row cut off |
| `preferences-host-shell.png` / `-light.png` | Server (Serve on+disabled, external), Security (PIN Change…, Host token Rotate…), Pairing (Show QR…, Log collapsed) |
| `preferences-stt.png` / `-light.png` | Resource usage radios (Eco checked, model details lines), Gemini key row with Save, Status header at the bottom edge |
