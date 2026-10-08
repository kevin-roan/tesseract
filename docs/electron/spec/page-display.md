# Spec: Display page (VNC viewer)

Status: survey of the GTK app for the Electron rebuild. Everything here comes from
`apps/desktop/tesseract_desktop/pages/display/**` and `apps/desktop/tesseract_desktop/vnc/**`,
plus the shared widgets and theme tokens they use. Numbers are taken from the code and checked
against the reference screenshots. Strings in `"..."` are user-facing: copy them exactly
(including `…` U+2026, `×` U+00D7 and `·` U+00B7).

Electron does not port the Python RFB client. It uses **noVNC** (`@novnc/novnc`, 1.7.0 is
already in the repo for the controller's `/ui/vnc` page) on the controller's binary WebSocket
bridge `WS /v1/display/vnc?ticket=…` (see `docs/architecture/display-vnc.md`). §8 says
which RFB behaviours noVNC must reproduce and how to configure it.

Page registration: id `display`, title `"Display"`, sidebar icon `display` (Lucide `monitor`),
section `sandbox`, order `40`.

---

## 1. Reference screenshots

All of these were captured headless (broadway, `--zoom 1`) against the user's **live** sandbox
(`tesseract-sandbox`). The display showed Chromium maximized on `about:blank`, with its
`--no-sandbox` warning bar. Broadway limits its virtual monitor to 1024×768, so a requested
1440×900 render comes out at 1024×768.

| File | What it shows |
|---|---|
| `docs/electron/reference/page-display-live.png` | Dark (graphite), 1024×768, sidebar expanded. Viewer mode, phase `connected`. Toolbar: green `"Live"` badge, meta `"1600×900 · 44% · Tesseract tesseract-sandb…"` (ellipsized), `Fit` (checked) / `1:1` pills, windows button, view-only eye, clipboard toggle (**checked**, the default), keyboard menu button, separator, camera, globe, refresh, maximize. The stage is fit-scaled to 44% (1600×900 → 710×399), horizontally flush and vertically centered on `#09090A`. The remote cursor appears in the frame. |
| `docs/electron/reference/page-display-live-light.png` | The same state in light (graphiteLight): toolbar `#FFFFFF`, stage `#F5F5F6`, badge dot `#2E8A5B`, checked pills/toggles `#E7E7EA`. |
| `docs/electron/reference/page-display-compact.png` | Dark, 500×600 window (sidebar collapsed, back chevron in the header). The page is narrower than 540 sp, so it is in **compact** mode: the secondary actions (view-only, clipboard, keys, separator, screenshot, browser) are hidden and the `…` overflow menu button shows. Remaining: badge, meta (`"1600×900 · 30% · TheOn…"`), Fit, 1:1, windows, reconnect, fullscreen, more. Scale 30%. |

States that could not be captured without changing the user's sandbox (offline, no display,
preview, overlays, windows popover, fullscreen) are fully specified below.

---

## 2. Layout tree

```
DisplayPage  (min size 300×280; container query: compact when width ≤ 540px)
└─ root  .to-display-page  (column, bg = surface)
   ├─ DisplayToolbar  .to-display-toolbar        (§3)
   └─ Stack (crossfade 180ms, fills rest)
      ├─ "empty"   EmptyState                    (§5)
      ├─ "preview" ScreenshotPreview             (§6)
      └─ "viewer"  .to-display-holder (bg = background)
                   └─ DisplayStage .to-display-stage (§4)
                      ├─ scroller → VncView (.to-vnc-view)
                      └─ overlay card .to-display-overlay (status card, §4.2)
```

The page header (`"Display"` title, window controls) belongs to the shell and is specified
elsewhere. In the screenshot the header is y 0–55 and the toolbar starts at y 56.

### Tokens used (graphite dark / graphiteLight)

| Token | Dark | Light |
|---|---|---|
| `background` (stage, holder, preview) | `#09090A` | `#F5F5F6` |
| `surface` (page, toolbar) | `#121213` | `#FFFFFF` |
| `surfaceElevated` (overlay card, popover) | `#1A1A1B` | `#FFFFFF` |
| `backgroundElement` (hover) | `#1E1E20` | `#EEEEF0` |
| `backgroundSelected` (checked) | `#232325` | `#E7E7EA` |
| `text` | `#E3E3E4` | `#1B1B1F` |
| `textSecondary` | `#929294` | `#5C5D66` |
| `textTertiary` | `#6B6B6F` | `#7E7F88` |
| `border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| `borderStrong` | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| `divider` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| `accent` / `focusRing` | `#5E6AD2` | `#5E6AD2` |
| `accentPressed` | `#4F5BC4` | `#4F5BC4` |
| `textOnAccent` | `#FFFFFF` | `#FFFFFF` |
| tone fg: success / info / warning / danger | `#4CB782` / `#4EA7FC` / `#F2C94C` / `#EB5757` | `#2E8A5B` / `#1F6FCB` / `#8F6400` / `#C93A3A` |
| tone fg: neutral | `textSecondary` | `textSecondary` |
| shadow level3 | `0 8px 24px rgba(0,0,0,0.4)` | same |

Type: Inter, 13px base. `caption` 12/16 400, `overline` 12/16 500, `h4` 14/20 500,
`bodySmall` 12/18 400, `body` 13/20 400, `bodyStrong` 13/20 500, `label` 13/18 500.

Motion: every stack switch on this page is a crossfade of **180ms** (`DURATIONS.normal`). The
GTK app uses no other easing, so use `ease-out` / `cubic-bezier(0.2,0,0,1)`. Under
`prefers-reduced-motion`, swap instantly.

---

## 3. Toolbar

`.to-display-toolbar`: a row with 12px gap, `min-height: 40px`, padding `0 8px 0 12px`,
`border-bottom: 1px solid divider`, color `text`, bg = page `surface`. Total height 41px
(rows y 56–95 content, y 96 border in the reference).

Left: an `info` row (gap 10px, flex 1, vertically centered) with:
- **Status badge** (`StatusBadge`): pill `min-height: 20px`, padding `0 8px 0 7px`,
  `border-radius: 999px`, `1px solid border`, transparent bg, gap 4px. Contents: a 6×6 round
  dot in the tone fg color, then the label (12px, `textSecondary`; the label is **not**
  tinted). Measured in the reference: x 318–368 for `"Live"`, with the dot at x 326–331.
- **Meta text**: `caption` (12/16), `textSecondary`, flex 1, single line, ellipsized at the
  end. Empty string → nothing.

Right: the `actions` row (gap 4px, vertically centered), in this order:

| # | Control | Icon (Lucide) | Tooltip / aria-label | Compact |
|---|---|---|---|---|
| 1 | Scale segmented toggle | – (`"Fit"`, `"1:1"`) | `"Scale the display to the window"`, `"Show the display pixel for pixel"` | shown |
| 2 | Windows menu button → popover (§7) | `app-window` | `"Open windows"` | shown |
| 3 | View-only toggle | `eye` | `"View only (ignore mouse and keyboard)"` | hidden |
| 4 | Clipboard toggle (default **on**) | `clipboard` | `"Sync clipboard with the sandbox"` | hidden |
| 5 | Send-keys menu button | `keyboard` | `"Send keys"` | hidden |
| 6 | Vertical separator | – | – | hidden |
| 7 | Save screenshot | `camera` | `"Save a screenshot"` | hidden |
| 8 | Open in browser | `globe` | `"Open in browser (noVNC)"` | hidden |
| 9 | Reconnect | `refresh-cw` | `"Reconnect"` | shown |
| 10 | Fullscreen | `maximize-2` | `"Fullscreen (F11)"` | shown |
| 11 | Overflow menu button | `ellipsis` | `"More actions"` | **only** in compact |

### 3.1 Icon buttons (2–5, 7–11)
28×28, padding 0, `border-radius: 6px`, transparent, no border or shadow, icon 16px in
`textSecondary`. Hover: bg `backgroundElement`, icon `text`. Checked or open (toggles on,
menu open): bg `backgroundSelected`, icon `text`. Measured x positions at 1024 wide: windows
740, eye 772, clipboard 804 (checked fill y 62–89), keyboard 836, separator 874, camera 883,
globe 915, refresh 947, maximize 979. The pitch is 32 (28 + 4 gap). Disabled: 50% opacity,
no hover. All buttons are vertically centered.

### 3.2 Scale toggle (1)
Two pills, one active at a time, default `Fit`. Each pill: height 28 (26 min-height + 1px
border top and bottom), padding `0 10px`, `border-radius: 999px`, `1px solid border`,
transparent, label 13px weight 500 in `textSecondary`. Hover: bg `backgroundElement`, label
`text`. Active: bg `backgroundSelected`, border `borderStrong`, label `text`. Measured: `Fit`
x 636–681 (46 wide), `1:1` x 690–735, so there is an **8px** gap between the pills. Selecting
one calls `setFit(name === "fit")`. The choice is not persisted: each page mount starts at
Fit.

### 3.3 Separator (6)
1px wide, `divider` color, margin `8px 4px` (so 24px tall inside the 40px bar).

### 3.4 Send-keys menu (5, and the overflow submenu)
A menu with these items, in order. Each item sends its key combo (§8.5):

| id | Label |
|---|---|
| `ctrl-alt-delete` | `"Ctrl+Alt+Delete"` |
| `ctrl-alt-backspace` | `"Ctrl+Alt+Backspace"` |
| `alt-tab` | `"Alt+Tab"` |
| `alt-f4` | `"Alt+F4"` |
| `super` | `"Super"` |
| `escape` | `"Escape"` |
| `print` | `"Print Screen"` |

### 3.5 Overflow menu (11, compact only)
Section 1: `"View only"` (check item bound to the view-only state), `"Sync clipboard"`
(check item), `"Send keys"` → submenu (§3.4). Divider. Section 2: `"Save screenshot…"`,
`"Open in browser"`.
Menu styling (shared): popover padding 4px, radius 8px, bg `surfaceElevated`, `1px solid
border`, shadow level3. Items are 28px tall with padding `0 8px` and radius 4px. Hover:
`backgroundSelected`. Divider margin `4px 0`, color `divider`.

### 3.6 Compact breakpoint
When the page's own width is ≤ 540px (`max-width: 540sp`; use a container query or
ResizeObserver on the page, not the window), hide items 3–8 and show item 11. Otherwise
the reverse.

### 3.7 Badge label and tone
`mode === "viewer"` → use the session phase. Otherwise use the mode.

| key | Label | Tone |
|---|---|---|
| `offline` (mode) | `"Offline"` | danger |
| `loading` (mode) | `"Checking"` | info |
| `error` (mode) | `"Unreachable"` | danger |
| `no_display` (mode) | `"No display"` | neutral |
| `preview` (mode) | `"Screenshots only"` | warning |
| `idle` | `"Idle"` | neutral |
| `connecting` | `"Connecting"` | info |
| `authenticating` | `"Authenticating"` | info |
| `connected` | `"Live"` | success |
| `retrying` | `"Reconnecting"` | warning |
| `auth_failed` | `"Password rejected"` | danger |
| `unavailable` | `"VNC unavailable"` | warning |
| `failed` | `"Disconnected"` | danger |

### 3.8 Meta text
Only in `viewer` or `preview` mode. Otherwise it is `""`. Parts are joined with `" · "`, and
empty parts are skipped:
1. Resolution `"{width}×{height}"`. In viewer mode, use the session's framebuffer size when
   it is known, else `status.width/height`. In preview mode, use `status.width/height`. Omit
   the part if either value is 0 or null.
2. Scale `"{round(scale*100)}%"`, only in viewer mode, while `connected`, when the scale is
   known (§4.1).
3. The desktop name from ServerInit (e.g. `"Tesseract tesseract-sandbox"`), only in viewer mode
   when it is non-empty.

### 3.9 Enabled actions
| Mode | Enabled |
|---|---|
| `offline` | none (every toolbar control disabled) |
| `loading`, `error`, `no_display` | `reconnect` only |
| `preview` | `screenshot`, `browser`, `reconnect`, `windows` |
| `viewer` | `screenshot`, `browser`, `reconnect`, `windows`, `scale`, `view_only`, `clipboard`, `fullscreen`, plus `keys` **only while `connected`** |

When `windows` becomes disabled, close its popover if it is open.

---

## 4. Stage (viewer mode)

`.to-display-holder` bg `background`. `.to-display-stage` fills it, bg `background`, clips
its overflow. While anything inside has focus (`:focus-within`) it gets
`box-shadow: inset 0 0 0 1px focusRing` (`#5E6AD2`). The canvas itself has no outline
(`:focus-visible { outline: none }`).

### 4.1 Scaling (must match)
`fit_geometry(fbW, fbH, viewW, viewH, fit)`:
- When any of these values is ≤ 0 → scale 1, offset 0,0.
- `scale = fit ? min(viewW/fbW, viewH/fbH) : 1`. Fit both **up- and downscales**: a small
  framebuffer fills a big window.
- `offsetX = max(0, round((viewW − fbW·scale)/2))`, `offsetY` the same way, so the frame is
  centered on both axes, in fit and in 1:1 mode.
- Fit mode: no scrollbars. 1:1 mode: the content is fbW×fbH, and scrollbars appear only when
  it overflows (auto policy). When it is smaller than the view, it is centered.
- Filtering: nearest-neighbour at scale 1 (|scale−1| < 1e-3), smooth when downscaling,
  linear when upscaling. In the browser, use `image-rendering: pixelated` only at exactly
  1:1, otherwise the default smoothing.
- The scale used for the meta `%` is re-read after every layout change. Recompute it from
  the container size and the framebuffer size with this formula, rather than trusting
  noVNC's internal value, so the percentage matches (e.g. 710/1600 → `"44%"`).
- Pointer mapping: `fx = trunc((x − offsetX)/scale)`, clamped to `[0, fbW−1]`, and the same
  for y. noVNC does this internally. It only has to match for clicks on the letterbox (they
  clamp to the nearest edge pixel rather than being dropped).

noVNC: `scaleViewport = fit`, `clipViewport = false`, `resizeSession = false`. Put the RFB
target in a scroll container that only scrolls in 1:1 mode. noVNC centers its canvas with
`margin: auto`, which matches the GTK offsets.

### 4.2 Status overlay card (viewer mode, not connected)
Shown whenever `mode === "viewer"` and the phase is not `connected`. While it is shown, the
frame canvas gets the `dimmed` state, `opacity: 0.3`, with `transition: opacity 200ms
ease-out`. The **last frame stays visible** under the card; do not clear the canvas on
disconnect if you can avoid it.

Card `.to-display-overlay`: centered horizontally and vertically, max width 420px, margin
24px from the stage edges, bg `surfaceElevated`, `border-radius: 12px`, `1px solid border`,
shadow level3. Inside is an `EmptyState` (§5.1) with **28px margins on every side**
(replacing the default 40/24) and no glyph icon.

| phase | Title | Message | Spinner | Button |
|---|---|---|---|---|
| `idle` | `"Starting viewer…"` | – | yes | – |
| `connecting` | `"Connecting to the display…"` | `"Opening the VNC bridge through the controller."` | yes | – |
| `authenticating` | `"Authenticating…"` | `"Sending the VNC password."` | yes | – |
| `retrying` | `"Connection lost"` | `"{error}Reconnecting in {seconds}s (attempt {attempt})."` | no | `"Reconnect now"` |
| `auth_failed` | `"VNC password rejected"` | `"{error}The sandbox may have been restarted with a new password."` | no | `"Try again"` |
| `failed` | `"Viewer stopped"` | `"{error}"` | no | `"Reconnect"` |
| `unavailable` | `"VNC is not answering"` | – | no | `"Check again"` |

- `{error}` = `session.error` with trailing `.` characters stripped, followed by `". "`. If
  there is no error it is `""`. The formatted message is trimmed, and an empty result hides
  the message line.
- `{seconds}` = `max(0, round(retryAt − now))`. While `retrying`, re-render once per
  second so the countdown ticks, and stop the ticker in any other phase.
- `{attempt}` = the session's attempt counter (1 on the first retry).
- Button: in phase `unavailable` → "check again" (§9). Otherwise → `session.reconnect()`.
- In practice `unavailable` is never visible for long: it immediately flips the page into
  `preview` / `no_display` mode (§9).

---

## 5. Empty view (modes offline / loading / error / no_display)

### 5.1 EmptyState widget (shared)
A centered column with 8px gap and margins `40px 24px`. Its children, in order:
- a 24×24 spinner (only when loading);
- a glyph icon, 48px, `textTertiary`, margin-bottom 4px (only when it is not loading and an
  icon is given);
- the title, `h4` 14/20 500, `textSecondary`, centered, wrapping;
- the message, `bodySmall` 12/18, `textTertiary`, centered, wrapping, max ~56ch, hidden when
  empty;
- the actions row, margin-top 8px, gap 8px. It holds a **primary** button: 28px high,
  `border-radius: 999px`, padding `0 14px`, bg `accent`, text `textOnAccent` 13px 500.
  Hover `filter: brightness(1.1)`, active bg `accentPressed`, disabled opacity 0.5.

### 5.2 Content
| mode | Icon | Title | Message | Button |
|---|---|---|---|---|
| `offline` | `cloud-off` | `"Sandbox unreachable"` | `"{error}"` = the connection's error message | `"Retry"` |
| `loading` | spinner | `"Checking the display…"` | `"Asking the controller about the virtual display."` | – |
| `error` | `triangle-alert` | `"Couldn't reach the display"` | `"{error}"` = the described status-poll error | `"Try again"` |
| `no_display` | `monitor` | `"The display is not running"` | `"Xvnc on {display} is down, so there is nothing to show. It restarts automatically; check again in a moment."` (`{display}` = `status.display`, default `":1"`) | `"Check again"` |

Every button runs "check again" (§9).

---

## 6. Preview view (mode `preview`: X is up, VNC is not)

`.to-display-preview`: a column with 12px gap, padding 12px, bg `background`.
1. **Notice** (warning tone): a row with 10px gap, padding `8px 10px`, `border-radius: 8px`,
   `1px solid border`, **transparent** bg. Contents: a 16px `monitor` icon in the warning
   fg; a text column (2px gap) with the title `"VNC is not answering"` (`bodyStrong` 13/20
   500, `text` color) and the message `"The display is up but its VNC server is not. Showing
   a screenshot every 3s until it is back."` (`bodySmall`, `textSecondary`, wraps); then a
   flat button `"Check again"` in the warning fg, 24px high, padding `0 8px`, 12px text.
2. **Frame area** (flex 1, bg `background`, the same `.to-display-stage` class, so it also
   gets the focus ring), a crossfade (180ms) between:
   - `loading`: centered column with 12px gap: a 32×32 spinner and the caption `"Taking a
     screenshot…"` (`caption`, `textSecondary`);
   - `picture`: the latest PNG, `object-fit: contain`, can shrink, centered.

The screenshot poll is `GET /v1/display/screenshot` every **3s** while in preview mode. A
PNG that fails to decode is ignored, and the previous picture is kept. Leaving preview mode
for any mode other than viewer clears the picture and goes back to `loading`.

---

## 7. Windows popover

Opened from toolbar item 2. It has no arrow, a width of 400px and the standard popover
chrome (padding 4, radius 8, `surfaceElevated`, border, shadow level3). Animate it with a
scale 0.98→1 plus fade, 120–180ms.

- **Header** row: gap 8, margin-left 8, margin-right 2. Holds the title `"Open windows"`
  (`overline` 12/16 500, `textTertiary`, flex 1) and a 28×28 flat icon button `refresh-cw`
  (tooltip `"Refresh"`) that re-polls now.
- 4px gap, then a crossfade (180ms, not size-homogeneous) between:
  - `state`: EmptyState with margin-top and margin-bottom 20 (sides keep 24):
    - first open, before data: spinner + `"Reading the sandbox's windows…"`;
    - empty list: `app-window` icon, `"No windows open"`, `"Nothing is showing on the
      sandbox display."`;
    - error: `triangle-alert` icon, `"Couldn't list the windows"`, the described error, and
      a primary button `"Refresh"`.
  - `list`: a vertical scroller, never horizontal, that grows to its content up to
    **380px** and scrolls after that.
- **Polling**: `GET /v1/display/windows` every **2s**, only while the popover is open. It
  starts on open and stops on close/unmount. On reopen the last list is shown at once, and
  the spinner is only shown when there is no data.
- **Order**: reverse of the API order (newest first, like a task switcher).
- **Row** (RecordRow, keyed by `window.id`): `min-height: 40px`, padding `0 8px 0 12px`,
  gap 10, `border-radius: 6px`, hover bg `backgroundElement`, no dividers.
  - icon `app-window` 16px, `accent` color if `active`, otherwise `textSecondary`;
  - title: `title.trim()` || `app` || `"Untitled window"` (`label` 13/18 500, single line,
    ellipsized; tooltip when it is longer than 48 chars);
  - subtitle: `app` (`body` 13, `textTertiary`, flex 1, ellipsized), omitted when null;
  - meta, right-aligned: `"Active"` if active, else `"Minimized"` if minimized, else
    nothing (`caption`, `textTertiary`);
  - hover actions float over the right edge only while the row is hovered or focused: a box
    with gap 2, margin-right 4, padding `0 4px 0 8px`, `border-radius: 6px`, bg
    `backgroundElement`. It holds two 24×24 icon buttons (radius 6, `textSecondary`, hover
    `text`):
    - `x`, `"Close window"` → `POST /v1/display/windows/:id/close` with `{}`, then refresh;
    - `circle-x`, `"Force quit"`, destructive (hover color `danger`) → closes the popover,
      then a confirm dialog (420px wide) with the heading `"Force quit this app?"`, the body
      `"Its process is killed without a chance to save. Use this when the window doesn't
      respond to Close."`, the buttons `"Cancel"` (gets initial focus) and `"Force quit"`
      (destructive) → `POST …/close` with `{"force": true}`.
  - Clicking the row → `POST /v1/display/windows/:id/activate`. On success the popover
    closes and the VNC canvas is focused.
- **Busy**: while any of these calls runs, every row is non-clickable and its action
  buttons are disabled. They are enabled again when the call finishes. Failure → toast
  `"Window action failed: {error}"`.

---

## 8. VNC behaviour (what noVNC must reproduce)

### 8.1 Connection sequence (one attempt)
1. Set phase `connecting` (and clear `retryAt`). If there is no controller client → phase
   `failed` with the not-configured error text.
2. `GET /v1/display`. If it is not ready (`available && vnc.available` is false) → store the
   status and set phase `unavailable` (no retry). The page then switches mode (§9).
3. `POST /v1/auth/ticket` → `ticket` (single-use, so **every attempt fetches a new one**).
4. Open `client.wsUrl(wsPaths.vnc(), ticket)` (`ws(s)://<base>/v1/display/vnc?ticket=…`)
   with the subprotocol **`["binary"]`**. Create a new `RFB` per attempt:
   `new RFB(target, url, { wsProtocols: ["binary"], shared: true })`. Do not pass
   `credentials` up front (see step 6).
5. The bridge pipes to Xvnc `127.0.0.1:5901`. RFB versions: 3.8 / 3.7 / 3.3 (the GTK client
   picks the highest supported ≤ the server's, and 3.8 when the server major is > 3).
6. Security: prefer None (1), else VNC Authentication (2). Anything else is an error.
   Production Xvnc offers VncAuth only. When VncAuth is chosen → phase **`authenticating`**.
   In noVNC, handle `credentialsrequired` by setting `authenticating` and calling
   `rfb.sendCredentials({ password })`, where `password = status.vnc.password`. If it is
   null or empty, do not send anything → phase `auth_failed` with the error `"the server
   needs a VNC password"`.
7. ClientInit `shared = 1`. After ServerInit → phase **`connected`** with `attempt = 0`,
   `error = null`, `name` = the desktop name (noVNC `desktopname` event), and the width and
   height of the framebuffer.

The WebSocket keepalive in GTK is a ping every 15s with a 20s pong timeout, and incoming
message size is unlimited. Browsers handle ping/pong themselves, so there is nothing to do.

### 8.2 Encodings and pixel format
The GTK client asks for 32bpp BGRX, depth 24, little-endian true-colour, and these
encodings, in this order: Tight (7), CopyRect (1), Raw (0), CompressLevel 1 (−255),
ExtendedDesktopSize (−308), DesktopSize (−223), LastRect (−224), Cursor (−239). It sends
**no JPEG quality level**, so the server never sends lossy JPEG rectangles, and the image is
lossless.

noVNC always advertises a quality level. Set `rfb.compressionLevel = 1` and
`rfb.qualityLevel = 9` for the closest result. Everything else, such as the extra encodings
and pixel format, is decided by noVNC and is fine.

Updates: after each FramebufferUpdate, request the next one incrementally. After a
size change, request the whole framebuffer non-incrementally. The client **never** asks the
server to resize (`resizeSession = false`), but it follows server-side resizes (DesktopSize
or ExtendedDesktopSize). A size change updates the meta resolution and re-runs §4.1.
SetColourMapEntries is ignored.

### 8.3 Cursor
The server's cursor (pseudo-encoding −239) becomes the local CSS cursor over the canvas, with
its hotspot. An empty (0×0) cursor → `cursor: none`. In **view-only** mode, use the default
arrow instead of the remote cursor. noVNC does this when `showDotCursor = false`.

### 8.4 Mouse
- Motion, press and release send PointerEvent with the button mask (bit 0 = left, 1 =
  middle, 2 = right, 3/4 = wheel up/down, 5/6 = wheel left/right, 7 = button 8). Pressing a
  button focuses the canvas.
- Wheel: deltas accumulate, and each whole unit sends one click (mask with the wheel bit,
  then without it). This is noVNC's default wheel handling and is acceptable.
- Coordinates are clamped to the framebuffer (§4.1).
- View-only: no pointer or key events at all (`rfb.viewOnly = true`).

### 8.5 Keyboard
- Keys are sent as X keysyms. ISO_Left_Tab (0xFE20) is sent as Tab (0xFF09). The key-up for a
  key reuses the keysym that was sent on its key-down, tracked per physical key. noVNC does
  both.
- **F11** never goes to the remote. It toggles fullscreen (§10). Intercept it in a
  capture-phase `keydown` listener on the stage, before noVNC sees it, and
  `preventDefault()` + `stopPropagation()` there.
- **Focus out** releases every held key (in reverse press order) and, if any mouse button is
  held, sends a pointer event with mask 0. noVNC releases keys on blur. Make sure the button
  mask is released too.
- **Accelerator guard**: while the canvas has focus and is interactive, app shortcuts that do
  not use Super, and are not Ctrl+Shift combos, are suspended so those keys reach the
  sandbox. Restore them on blur, view-only, or unmount. In Electron, the renderer's global
  shortcut handler checks a "VNC has keyboard" flag. Only `Super+…` and `Ctrl+Shift+…`
  accelerators, plus F11, stay active while it is set. If menu accelerators exist, disable
  them over IPC while the flag is set.
- **Send keys** (§3.4) presses every keysym in order, then releases them in reverse. It is
  ignored when view-only, and focuses the canvas afterwards. Keysyms: Ctrl_L 0xFFE3, Alt_L
  0xFFE9, Delete 0xFFFF, BackSpace 0xFF08, Tab 0xFF09, F4 0xFFC1, Super_L 0xFFEB, Escape
  0xFF1B, Print 0xFF61. Use `rfb.sendKey(keysym, null, down)` for each event.

### 8.6 Clipboard (sync defaults to on)
- **Sandbox → host**: on a ServerCutText (noVNC `clipboard` event), if sync is on, the text
  is not empty, and it differs from the last synced text, remember it and write it to the
  system clipboard. No toast. (The `"Clipboard received from the sandbox"` label exists but is
  unused, so do not show it.)
- **Host → sandbox**: when the canvas gains focus, when the host clipboard changes, and when
  sync is switched on, read the host clipboard. If sync is on, the session is `connected`,
  not view-only, and the text is not empty and differs from the last synced text, send it
  with `rfb.clipboardPasteFrom(text)`. Electron has no clipboard-change event, so read on
  canvas focus and on `window` focus.
- Text goes over the wire with CRLF → LF and Latin-1, replacing characters that do not
  encode. noVNC does the Latin-1 part.

### 8.7 Bell
The GTK app plays the widget error bell. In Electron, play nothing (optionally
`shell.beep()`).

### 8.8 Phases, retry and failure

Phases: `idle`, `connecting`, `authenticating`, `connected`, `retrying`, `auth_failed`,
`unavailable`, `failed`.

| Event | Result |
|---|---|
| status/ticket request fails with an auth error (401/403) | `failed`, error = described error. No retry. |
| status/ticket request fails otherwise | retry |
| WebSocket fails to open (not cancelled) | retry, error = socket error message |
| RFB protocol/decoder error | close the socket, then retry with the error text |
| VncAuth result is not OK (`securityfailure`) | `auth_failed`, error = server reason (RFB 3.8) or `"authentication failed"`. No retry. |
| socket closes while waiting for the VncAuth result | `auth_failed`, error null. No retry. |
| socket closes otherwise (while running, phase not `auth_failed`/`failed`) | retry, error = close reason or null |

**Retry**: `delay = backoff(attempt)` with `base = min(30, 1 · 2^attempt)`. The delay is
uniformly random in `[base/2, base]`, then clamped to `[1, 30]` seconds. Then set phase
`retrying`, `attempt += 1`, `retryAt = now + delay`, and run §8.1 again when the timer
fires. A successful connect, `reconnect()` and `stop()` reset `attempt` to 0.

`reconnect()`: tear everything down (cancel the timer, cancel in-flight requests, close the
socket with 1000), then connect again right away. `stop()`: tear down and go to `idle`
with no error.

---

## 9. Page state machine

Mode:
```
!connection.online                         → "offline"
status == null → statusError ? "error" : "loading"
status.available && status.vnc.available   → "viewer"
status.available                           → "preview"
else                                       → "no_display"
```
**Active** = page shown **and** (the app window is visible **or** fullscreen is on) **and**
the connection is online.

On every change (connection, window visibility, page shown/hidden, status result, session
state):
- Not active: stop the session and both pollers. If offline, also clear the status and
  error, force mode `offline`, and exit fullscreen.
- Active and `viewer`: stop the status and screenshot pollers, start the session (no-op
  if it is already running).
- Active otherwise: stop the session, start the status poller (`GET /v1/display` every
  **5s**), and start the screenshot poller (3s) only in `preview`. Otherwise stop it and
  clear the preview picture.

A status success stores the status and clears the error. A status failure stores the
described error and sets the status to null (→ `error`). Session state updates copy
`state.status` into the page's status when present. Phase `unavailable` triggers a full
re-sync, which moves the page to `preview`/`no_display` and starts polling again, so VNC
recovery is detected by the 5s poll.

**Check again** (empty-state buttons, the preview notice, the overlay in `unavailable`):
if offline → ask the connection service to refresh. Otherwise clear the status error and
re-poll the status now.

**Reconnect toolbar button**: in viewer mode → `session.reconnect()`, otherwise → check
again.

Hiding the page exits fullscreen. Unmount stops everything: the ticker, fullscreen, the
session, the pollers and clipboard listeners.

---

## 10. Fullscreen

- F11, anywhere on the page or on the canvas, toggles it. It only enters in `viewer` mode.
  Toolbar item 10 does the same.
- GTK moves the stage into a separate undecorated fullscreen window with a **pure black**
  background (`#000000`, no focus ring). Electron: keep a single window. Call
  `BrowserWindow.setFullScreen(true)` over IPC and render the stage as a `position: fixed;
  inset: 0` layer above the shell (with a portal, so the RFB canvas element is reparented
  without reconnecting). Do **not** use the HTML Fullscreen API, because it takes Escape
  away from the remote session.
- The exit button is a circular OSD button: 16px icon `minimize-2`, tooltip `"Exit
  fullscreen (F11)"`, top-right with a 16px margin. Style: dark translucent bg
  (`rgba(0,0,0,0.65)`, white icon, size about 34px; this is Adwaita `.osd.circular`). It
  crossfades in over 180ms when fullscreen opens and whenever the pointer moves within
  **48px of the top edge**. It hides 3s after the last reveal.
- Exit on F11, the button, the window close request, Escape **only when the canvas does not
  take it** (view-only, or canvas not focused). Also exit when the page is hidden, the
  connection goes offline, or the page unmounts. After exit, put the stage back and re-sync.
- While fullscreen, the session counts as active even if the main window reports it is
  hidden.
- Focus the canvas on entering.

---

## 11. Toolbar actions

- **Save screenshot**: `GET /v1/display/screenshot` (PNG bytes). On success, open a save
  dialog with the title `"Save a screenshot"`, the default name
  `tesseract-display-YYYYMMDD-HHMMSS.png` (local time, `%Y%m%d-%H%M%S`) and a filter
  `"PNG image"` (`image/png`). Cancel does nothing. On write success → toast
  `"Screenshot saved to {basename}"`. A fetch or write failure → toast
  `"Screenshot failed: {error}"`. In Electron, use `dialog.showSaveDialog` and write in main.
- **Open in browser**: `client.vncPageUrl()` (the display status, plus a ticket, plus
  `<base>/ui/vnc#ticket=…&password=…`) → `shell.openExternal(url)`. Failure → toast
  `"Couldn't open the browser: {error}"`. A user dismissal is not an error.
- **View only** toggle: off by default. Switching it releases all held input, swaps the
  cursor (§8.3), and suspends or resumes the accelerator guard.
- **Clipboard** toggle: on by default. Switching it on pushes the host clipboard right away
  (§8.6).

---

## 12. GTK quirks NOT to copy

1. **Keyboard and overflow menu buttons render boxed.** In the screenshots, the `keyboard`
   button (x 836–865) and the compact `…` button are 30×30, with a `surfaceElevated` fill and
   a 1px border, unlike their flat neighbours. This is an Adwaita `image-button:not(.flat)`
   rule leaking through `MenuButton(icon_name=…)`. Render them as 28×28 flat icon buttons
   like the rest (§3.1).
2. **The `1:1` label renders lighter than intended.** It measures about `#C6C6C6` instead of
   `textSecondary` because of an Adwaita toggle label rule. Use `textSecondary` for inactive
   pills and `text` for the active one.
3. Broadway clamps the reference renders to 1024×768. Do not treat that as a size limit.
4. GTK starts the stage's 1px focus ring only on `:focus-within`, and the reference renders
   are unfocused, so it does not appear in them. It **is** part of the design.
5. The stale `toast` label `"Clipboard received from the sandbox"` is never shown. Keep it
   unused.
6. GTK uses a separate fullscreen window and reparents the widget. Use a single window with a
   fixed layer instead (§10).
7. The Python RFB, DES, Tight and JPEG decoders exist only because GTK has no VNC widget.
   Do not port them, because noVNC covers them.
8. The GTK client offers RFB 3.3, so with Security None it skips the SecurityResult on 3.7.
   noVNC handles this. There is nothing to do.

---

## 13. Suggested React structure (CODING.md)

- `pages/display/labels.ts`: every string above. `pages/display/config.ts`: the intervals
  (5000 / 3000 / 2000 ms, tick 1000), the compact width 540, min size 300×280, the overlay
  card max 420 and padding 28, the fullscreen reveal 3000 ms and edge 48 px, the windows
  popover width 400 and max height 380, the encodings settings (compression 1, quality 9),
  and the key combos.
- Pure model functions (port `model.py` 1:1, with unit tests): `modeFor`, `badge`,
  `emptyModel`, `overlayModel(state, now)`, `metaText`, `enabledActions`, `windowTitle`,
  `windowState`, `windowsInOrder`, `fitGeometry`, `backoffDelay`.
- Hooks: `useDisplayStatus` (5s poller), `useScreenshotPoller`, `useVncSession` (wraps
  noVNC, exposes `SessionState` and `reconnect`/`stop`/`sendKeys`/`setViewOnly`/`setFit`),
  `useVncClipboardSync`, `useDisplayWindows` (2s while open), `useFullscreenStage`,
  `useAcceleratorGuard`.
- Components: `DisplayToolbar`, `ScaleToggle`, `DisplayStage` + `StatusOverlayCard`,
  `ScreenshotPreview`, `WindowsPopover` + `WindowRow`, `FullscreenExitButton`. Reuse the
  shared `EmptyState`, `Notice`, `StatusBadge`, `IconButton`, `RecordRow`, `ConfirmDialog`
  and `Menu`.
