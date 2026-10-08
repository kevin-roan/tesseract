# Spec: Terminals page + terminal widget

Source of truth: `apps/desktop/tesseract_desktop/pages/terminals/*` and `apps/desktop/tesseract_desktop/widgets/terminal/*`.
Electron target: React + xterm.js (`@xterm/xterm`, `@xterm/addon-fit`, optionally `@xterm/addon-webgl`, `@xterm/addon-unicode11`).
All numbers are CSS px at zoom 1. Base text is 13px Inter.

## 1. Page registration

| Field | Value |
|---|---|
| id | `terminals` |
| title (page header) | `Terminals` |
| nav icon | `terminal` (Lucide `square-terminal`) |
| nav section | `sandbox`, order `30` |

Navigation params (`open(params)`):
- `{ terminalId: string }` attaches to and selects that session. It also un-hides it if the user had removed it locally.
- `{ kind: "shell" | "claude", projectId?: string }` creates a new session, as if the user clicked a launcher.
- Anything else is ignored.

## 2. Reference screenshots

These were captured with `apps/desktop/tools/snapshot.sh` (headless broadway, animations disabled). Broadway clamps the window to 1024×768, so a requested 1440×900 renders at 1024×768. The data comes from the user's live sandbox, which had 2 running sessions. The narrow capture rendered before the terminal list loaded.

| File | What it shows |
|---|---|
| `docs/electron/reference/page-terminals-default.png` | Dark (graphite) at 1024×768, with the app sidebar expanded. The page header is "Terminals". The Sessions pane (≈300px wide) shows heading `Sessions 2`, two split-button chips (`Shell ▾`, `Claude ▾`) and two rows: `Shell · Workspace` / `started 4h ago · 49×18` and `Claude Code · streaxfit` / `started 7h ago · 49×32`. Each row has a 6px green dot at the right. The content pane has no toolbar, because nothing is selected and the split is not collapsed. It shows the placeholder empty state: a 48px terminal glyph, `No session selected`, the message, the indigo pill `New shell` and the flat `New Claude session`. |
| `docs/electron/reference/page-terminals-default-light.png` | The same view in light (graphiteLight). The panels are white (#FFFFFF), the app sidebar is #F5F5F6 and the dots are green #2E8A5B. |
| `docs/electron/reference/page-terminals-narrow.png` | 800×700 dark. The app sidebar is collapsed (back chevron in the header) and the terminal split is still side by side. The store had not loaded yet, so the sidebar shows the centred `No sessions` text and the `Sessions` heading has no count. |
| `docs/electron/reference/page-terminals-collapsed.png` | 520×700 dark. The split is collapsed (page width ≤ 560). A 40px toolbar holds only the `sidebar` toggle button (Lucide `panel-left`). Below it is the full-width placeholder. |

No screenshot shows an attached terminal. Attaching to a live session would send a `resize` frame to the user's sandbox, which is a mutation. Section 6 describes the attached state precisely.

## 3. Colors used (resolved)

The app renders only the `graphite` (dark) and `graphiteLight` (light) schemes. The `dark`/`light` terminal palettes exist in code, but they are never selected (see the quirks section).

| Token | Dark (graphite) | Light (graphiteLight) |
|---|---|---|
| surface | `#121213` | `#FFFFFF` |
| surfaceElevated | `#1A1A1B` | `#FFFFFF` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected | `#232325` | `#E7E7EA` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| success / successMuted | `#4CB782` / `#14261C` | `#2E8A5B` / `#E5F4EC` |
| warning / warningMuted | `#F2C94C` / `#2B2410` | `#8F6400` / `#FBF2D9` |
| danger / dangerMuted | `#EB5757` / `#2C1517` | `#C93A3A` / `#FCE9E9` |
| info / infoMuted | `#4EA7FC` / `#122233` | `#1F6FCB` / `#E5F1FE` |
| neutral tone fg / bg | textSecondary / backgroundElement | same |
| accent (primary button) | `#5E6AD2` | `#5E6AD2` |

Tone mapping: the tone **dot** and **fg** use the tone's foreground color. The **bg** uses the muted color, but StatusBadge and Notice override the bg to transparent.

Typography (Inter):

| Variant | Size / line-height / weight |
|---|---|
| body | 13 / 20 / 400 |
| bodyStrong | 13 / 20 / 500 |
| bodySmall | 12 / 18 / 400 |
| label | 13 / 18 / 500 |
| caption | 12 / 16 / 400 |
| overline | 12 / 16 / 500 |
| h4 | 14 / 20 / 500 |

Counts use `font-feature-settings: "tnum"`.

## 4. Layout

```
Page root (crossfade 180ms between "empty" and "main")
└─ main: split view (min 280×240)
   ├─ Sessions sidebar  (surface bg, 1px right border divider)
   │   ├─ heading row      44px min-height, padding 0 16, gap 8: "Sessions"(label) + count(label, textTertiary, tnum)
   │   ├─ launchers row    padding 0 12 8, gap 6: [Shell ▾] [Claude ▾]
   │   ├─ session list     scrollable (vertical only), padding 2 8 8
   │   └─ "No sessions"    body, textSecondary, centered, padding 16, fills height (only when list empty)
   └─ Content (vertical)
       ├─ toolbar          see 4.3
       └─ stage (overlay)
           ├─ views stack  surface bg, overflow hidden: placeholder | one TerminalView per attached session
           └─ banner       bottom-aligned, margin 12 (see 4.5)
```

### 4.1 Split behaviour
- Sidebar width: `clamp(240, 0.34 × split width, 320)` per the Adw config (`min_sidebar_width=240`, `max_sidebar_width=320`, `sidebar_width_fraction=0.34`). In the references the pane measures ≈300px at a 710px page width. Libadwaita's fraction maths is not exactly 0.34 × width here, so treat **300px** as the observed value at common window sizes and keep it within [240, 320].
- Collapse when the page width is ≤ 560px. When collapsed, the sidebar becomes an overlay drawer over the content. The toolbar is always visible and shows the `sidebar` toggle button (tooltip/aria `Sessions`), which opens the drawer. Selecting a session closes the drawer.
- Toolbar visibility: visible when a session is selected **or** the split is collapsed. Otherwise it is hidden entirely, so the placeholder starts at the top of the pane.

### 4.2 Launch buttons ("Shell ▾", "Claude ▾")
A split button: the main half launches in the Workspace and the arrow half opens a project picker.
- Outer: `border: 1px solid border`, `border-radius: 999px`. A 1px separator between the halves uses the `border` color.
- Both halves: min-height **26px**, transparent background, no shadow, color textSecondary, font-weight 500, 13px. Hover: background backgroundElement, color text. Transition 120ms `cubic-bezier(0.2,0,0,1)`.
- Main half: padding `0 8 0 10`, radius `999 0 0 999`. Content is a 16px icon + label with a 6px gap.
  - Shell: icon `terminal`, label `Shell`, tooltip `Start a shell in the workspace`.
  - Claude: icon `agents` (Lucide `mouse-pointer-2`), label `Claude`, tooltip `Start Claude Code in the workspace`.
- Arrow half: padding `0 6 0 4`, radius `0 999 999 0`, tooltip `Choose a project`. GTK draws a small filled down-triangle (≈8×4, textSecondary). Match it with a filled triangle SVG, or use Lucide `chevron-down` 12px if the design pass prefers Linear's chevron.
- Picker popover (dialog surface #1A1A1B, radius 10): inner padding 6, vertical gap 6.
  - Overline header `Start in` (textTertiary).
  - List (max height 360, scrolls). Rows have padding `6 12 6 6`, gap 8, a 16px icon and a label (13/18/500) with a max of 32 chars (ellipsize).
  - The first row is always `Workspace` with the `sandbox` icon (Lucide `box`); it launches with no project.
  - If projects are still loading, a non-interactive row follows: `Loading projects…` (caption, textSecondary).
  - Otherwise there is one row per project (`project.name || project.id`, icon `project` = Lucide `box`).
  - Clicking a row closes the popover and launches with that project.
- While a create request is in flight, both launchers and the placeholder are disabled (GTK insensitive: ~50% opacity). A second launch is ignored until the first finishes.

### 4.3 Session row
- Row: padding `7 4 7 8`, margin `1px 0`, radius 6, no background. Hover: backgroundElement. Selected: backgroundSelected with text color. Single selection.
- Content is horizontal with a 10px gap:
  1. Kind icon, 16px, textSecondary, top-aligned with margin-top 2. `shell`→`terminal`, `claude`→`agents`, anything else→`terminal`.
  2. Text column (flex 1, gap 2):
     - Title (body, 1 line, ellipsize): `{Kind} · {Project}`. Kind is `Shell` or `Claude Code` (unknown kinds are title-cased). Project is the project's name, else its id, else `Workspace` when there is no projectId.
     - Subtitle (caption, textTertiary, 1 line): `started {relative}` and, while running and size known, `{cols}×{rows}` (U+00D7). The parts are joined with ` · `, e.g. `started 4h ago · 49×18`.
  3. Trailing 24×24 cell, vertically centred, holding two stacked layers:
     - Status dot, 6×6 round, in the tone foreground color. Tooltip = status text. It is not clickable.
     - Delete button, 24×24, padding 0, radius 4, icon `delete` (Lucide `trash-2`) 16px, textTertiary, **opacity 0**. Hover: background dangerMuted, color danger. Tooltip/aria: `Delete session` when ended, `Terminate and delete session` when running.
  - On row hover or selected (or delete focus-visible): the delete button goes to opacity 1 and the dot to opacity 0. Use a 120ms crossfade.
- Ended rows (not running): the icon and text column are at opacity 0.6.
- Row tooltip: `{title} · {status}`.
- Status/tone for a row:
  - If the session is attached in this view, use its live state (section 6.3).
  - Otherwise use the server state: `running` → `Running`/success; `exited` → `Exited` or `Exited ({code})`/neutral.
- Sorting: running sessions first, then `createdAt` descending.
- Heading count = number of running sessions. It is blank when 0.
- Relative times refresh every **30s** while the page is shown.

### 4.4 Toolbar (content header)
- Min-height **40px** (36 + 4), padding `0 8 0 12`, background surface, `border-bottom: 1px solid divider`, gap 8.
- Children in order:
  1. Sidebar toggle (collapsed only).
  2. Kind icon 16px textSecondary.
  3. Titles box (flex 1, centred, gap 8): title (label) · StatusBadge · subtitle (caption, textTertiary, flex 1, ellipsize). The subtitle is the terminal window title set via OSC 0/2, falling back to `info.cwd`, otherwise hidden.
  4. `refresh` button, tooltip `Restart`, shown only when exited.
  5. `close` (Lucide `x`) button, tooltip `Close session`, or `Remove` when exited.
  6. `more` (Lucide `ellipsis`) menu button, tooltip `Terminal actions`.
- All toolbar buttons are 28×28, padding 0, radius 6, flat. Hover/open background is backgroundElement.
- StatusBadge: inline-flex, gap 4, min-height 20, padding `0 8 0 7`, radius 999, `1px solid border`, transparent background. It holds a 6px tone dot and a caption label in textSecondary (font 12, weight 500).
- The `more` menu has 3 sections separated by dividers:
  1. `Copy`, `Paste`, `Select All`
  2. `Larger Text`, `Smaller Text`, `Reset Text Size`
  3. `Clear Scrollback`
  Each action applies to the current terminal and then refocuses it.

### 4.5 Banner (over the terminal, bottom)
Notice component, floating with margin 12 and aligned to the bottom of the stage.
- Container: padding `8 10`, radius 8, `1px solid border`, background **surfaceElevated** (opaque), shadow `0 4px 12px rgba(0,0,0,0.3)`. Horizontal, gap 10.
- Tone icon 16px in the tone fg: danger→`error`, warning→`warning`, success→`success`, else `info`.
- Body column (gap 2): title (bodyStrong, tone fg) and message (bodySmall, textSecondary, wraps).
- Optional action: a flat button, min-height 24, padding `0 8`, font 12, tone fg.

| State | Title | Message | Tone | Action |
|---|---|---|---|---|
| exited, code known | `Session ended` | `The process exited with code {code}.` | danger if code ≠ 0, else neutral | `Restart` (creates a new session with the same kind + project and selects it) |
| exited, code null | `Session ended` | `The process exited.` | neutral | `Restart` |
| closed | `Disconnected` | `The stream to this session closed. {error}` (trimmed) | danger | `Reconnect` |
| reconnecting | `Connection lost` | `Trying to reattach; output is replayed once the stream is back.` | warning | none |
| connecting / open / unavailable | no banner | | | |

Animation (new for Electron): slide up 8px plus fade, 180ms ease-out. Reverse the same animation on hide.

### 4.6 Placeholder (no session selected)
Shared EmptyState, centred:
- Icon `terminal` 48px, textTertiary, margin-bottom 4.
- Title `No session selected` (h4, textSecondary, centred).
- Message `Start a shell or a Claude Code session in the sandbox, or pick one from the list.` (bodySmall, textTertiary, centred, wraps).
- Actions (gap 8, margin-top 8): primary indigo pill `New shell` and flat `New Claude session`. Both launch in the Workspace.
- Vertical gap 8 between items.

### 4.7 Connection empty states (whole page)
These replace the page with a full EmptyState when the sandbox is not online **and** no session is attached. When the connection comes back online, attached sessions in `reconnecting`/`closed` reconnect automatically.

| status | Title | Message | Icon | Button → action |
|---|---|---|---|---|
| unconfigured | `Connect to your sandbox` | `Terminals run inside the sandbox. Connect to it first.` | sandbox | `Preferences` → open preferences |
| discovering | `Looking for the sandbox…` | — | spinner | — |
| connecting | `Connecting…` | — | spinner | — |
| offline | `Sandbox unreachable` | `{error}` | offline | `Retry` → refresh connection |
| unauthorized | `Token rejected` | `The controller refused the saved token.` | warning | `Preferences` |
| incompatible | `Version mismatch` | `{error}` | warning | `Preferences` |

### 4.8 Delete / close flow
- If the session has exited, call `DELETE /v1/terminals/:id` immediately with no confirmation.
- If it is running, show an alert dialog first:
  - Heading `Delete this session?`
  - Body `{title} and everything running in it will be terminated.`
  - Buttons `Cancel` (default and Esc) and `Terminate & Delete` (destructive red).
- On success:
  - Hide the id locally, detach the session and drop it from the store.
  - If it was the current session, select the next session in list order that is still attached. If there is none, show the placeholder.
- Toasts on failure:
  - create: `Couldn't start the session: {error}`
  - close: `Couldn't close the session: {error}`

## 5. Data and protocol

REST (bearer auth, prefix `/v1`):
- `GET /v1/terminals` → `TerminalInfo[]`. `TerminalInfo = { id, kind: "shell"|"claude", projectId|null, title, cwd, pid|null, cols, rows, state: "running"|"exited", exitCode|null, createdAt }`. The workspace service loads this list, and the `/v1/events` frame `{type:"terminal.updated", terminal}` upserts entries.
- `POST /v1/terminals` sends `{ kind, cols, rows, projectId? }` and returns `201 TerminalInfo`. The client upserts it into the store and selects it.
  - `cols`/`rows` come from the current terminal's fitted grid, or from an estimate of the stage size at 14px.
  - The fallback is **100×30**.
- `DELETE /v1/terminals/:id` → `TerminalInfo`.

WebSocket `/v1/terminals/:id/stream?ticket=<one-time ticket>`. Get a fresh ticket from `POST /v1/auth/ticket` before **every** connect, including reconnects.

| Direction | Frames (JSON text) |
|---|---|
| client → server | `{type:"input", data:string}` and `{type:"resize", cols, rows}` |
| server → client | `{type:"output", data:string}` and `{type:"exit", code:number}` |

- On attach the server replays scrollback (≤ 256 KiB) as one `output` frame. The client therefore **resets the terminal on every socket open** (`term.reset()`) before the replay arrives. This avoids duplicated output after a reconnect.
- `exit` is final: mark the session exited and do not reconnect. The server closes with 1000.
- Reconnect backoff: `base = min(30, 1 × 2^attempt)` seconds, `delay = clamp(base/2 + random()·base/2, 1, 30)`.
- On socket open:
  1. Set state `open` and clear the error.
  2. Send `resize` with the current grid immediately.
  3. Flush queued input in order.
- Input sent while the socket is not open is queued, capped at **65536** characters total. Input that would exceed the cap is dropped. Input after exit is dropped.
- `resize` is only sent while the state is `open`.
- Electron note: run the socket in the renderer with the ticket flow, or proxy it through main. Either way keep the same state machine.

## 6. Session lifecycle

### 6.1 Attach cache
- At most **6** sessions are attached (socket plus terminal instance) at once, evicted LRU and never the current one. Evicted sessions close their socket and dispose the xterm.
- Hidden attached sessions keep their xterm instance alive in the stack. In React, keep them mounted and hide them with `visibility:hidden` / `position:absolute` rather than `display:none`, so `fit()` keeps working. Refit when a session becomes visible.
- Switching between sessions has **no** transition in GTK. For Electron, an optional 120ms opacity fade is fine.
- After selecting a session, or when the page is shown, focus the terminal.

### 6.2 Socket state → session state
- `connecting` → `connecting` for the first connection, and `reconnecting` after the session has been open at least once.
- `open` → `open`.
- `closed` → `closed`. The error text comes from the socket error.
- If no socket can be created → `unavailable`.
- `exited` is sticky: no further state changes apply.
- If a store update reports `state: "exited"` while the session is not `open`, mark it exited with that `exitCode`.
- Input is enabled only in `open`, `connecting` and `reconnecting`. When input is disabled, the cursor is hidden and paste is disabled.

### 6.3 Badge labels
| state | label | tone |
|---|---|---|
| connecting | `Connecting…` | info |
| open | `Live` | success |
| reconnecting | `Reconnecting…` | warning |
| exited | `Exited` / `Exited ({code})` | neutral |
| closed | `Disconnected` | danger |
| unavailable | `Unavailable` | danger |

(Unused label strings in labels.py: `Not attached`, `Starting…`, and the error `Live terminal streams need libsoup 3.`)

## 7. Terminal widget → xterm.js

### 7.1 Metrics
| Setting | Value |
|---|---|
| Font family | `"Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", monospace`. Geist Mono is bundled in `apps/desktop/data/fonts`; load it with `@font-face` **before** `term.open()`, or call `term.options.fontFamily = …` again after `document.fonts.ready`. |
| Font size | **14px** default; zoom range **8–36px**, step 1px |
| Line height | **1.12**. GTK uses cell height `ceil(max(logical, ascent+descent) × 1.12)` and cell width = the advance of "M". xterm's `lineHeight: 1.12` gives the same result to within 1px. |
| Padding | **10px** on all sides, painted in the terminal background. xterm has no padding option, so put `padding:10px; background: <palette.background>` on the host element and let `FitAddon` measure the inner box. |
| Grid | `cols = max(2, floor((w − 20)/cellW))`, `rows = max(1, floor((h − 20)/cellH))` |
| Scrollback | **5000** lines (alt screen has none) |
| Bold | Bold weight using the same color. Never brighten bold. |
| Dim | GTK blends fg 45% toward bg. xterm uses 50% alpha, which is close enough. |
| Wide/emoji | East-Asian W/F = 2 cells. Use `@xterm/addon-unicode11` and `term.unicode.activeVersion = '11'`. |
| Box drawing | GTK draws box/block glyphs procedurally. xterm's `customGlyphs: true` (default) is equivalent. |

### 7.2 Cursor
- Default is a **block**, non-blinking. DECSCUSR (`CSI n SP q`) and DEC mode 12 can change shape and blink: 0/1 blinking block, 2 steady block, 3/4 underline, 5/6 bar.
- Block cursor: fill with `cursor` and draw the glyph in `cursorText`.
- Bar width is `max(2, round(cellH/9))`, which is 2px at 14px font. Underline thickness uses the same value.
- Unfocused: a 1px outline rectangle in the cursor color.
- Blink interval is 530ms. xterm's is fixed at ~600ms; accept that difference.
- The cursor is hidden entirely when input is disabled (exited/closed/unavailable). In xterm, set `disableStdin: true` and write `\x1b[?25l`, or set `cursor` to the background color.

### 7.3 Palettes (exact)

```ts
export const TERMINAL_THEMES = {
  graphite: {
    foreground: '#E3E3E4', background: '#09090A', cursor: '#E3E3E4', cursorAccent: '#09090A',
    selectionBackground: '#2A2C45', selectionInactiveBackground: '#2A2C45',
    black: '#222222', red: '#FF6369', green: '#3DD68C', yellow: '#F2C55C',
    blue: '#7FB8FA', magenta: '#C47BEA', cyan: '#7FD6C8', white: '#D4D4D4',
    brightBlack: '#7A7A7A', brightRed: '#FF6E6E', brightGreen: '#c3e88d', brightYellow: '#ffe08a',
    brightBlue: '#a6c8ff', brightMagenta: '#E7AEF8', brightCyan: '#a3f7ea', brightWhite: '#ffffff',
    scrollbarSliderBackground: 'rgba(255,255,255,0.13)',
    scrollbarSliderHoverBackground: 'rgba(255,255,255,0.13)',
    scrollbarSliderActiveBackground: 'rgba(255,255,255,0.13)',
  },
  graphiteLight: {
    foreground: '#1B1B1F', background: '#FFFFFF', cursor: '#5E6AD2', cursorAccent: '#FFFFFF',
    selectionBackground: '#D9DCF5', selectionInactiveBackground: '#D9DCF5',
    black: '#1B1B1F', red: '#C93A3A', green: '#2E8A5B', yellow: '#8F6400',
    blue: '#1F6FCB', magenta: '#8A4FD8', cyan: '#1B7C83', white: '#6B6B6F',
    brightBlack: '#5C5D66', brightRed: '#A40E26', brightGreen: '#1A7F37', brightYellow: '#7D5800',
    brightBlue: '#0969DA', brightMagenta: '#A475F9', brightCyan: '#3192AA', brightWhite: '#929294',
    scrollbarSliderBackground: 'rgba(0,0,0,0.15)',
    scrollbarSliderHoverBackground: 'rgba(0,0,0,0.15)',
    scrollbarSliderActiveBackground: 'rgba(0,0,0,0.15)',
  },
} as const;
```

Notes on these palettes:
- Colors 16–255 are the standard xterm cube (levels 0,95,135,175,215,255) plus the gray ramp `8 + 10·i`, which is xterm's default, so no `extendedAnsi` is needed.
- Selection replaces the cell background with an **opaque** selection color and keeps the cell's foreground. Pass the hex as opaque (xterm draws it at full alpha when the color has no alpha). Do not set `selectionForeground`.
- Reverse video (DECSCNM): swap the default fg/bg. The selection becomes a 30% blend of the selection color toward the swapped background. xterm handles reverse video itself.
- Switch the theme live when the app appearance changes (`term.options.theme = …`). Also update the host element's padding background.

### 7.4 Options

```ts
export const XTERM_OPTIONS: ITerminalOptions = {
  fontFamily: '"Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", monospace',
  fontSize: 14,
  lineHeight: 1.12,
  letterSpacing: 0,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  drawBoldTextInBrightColors: false,
  minimumContrastRatio: 1,
  cursorStyle: 'block',
  cursorBlink: false,
  cursorWidth: 2,
  cursorInactiveStyle: 'outline',
  scrollback: 5000,
  scrollSensitivity: 1,
  fastScrollSensitivity: 5,
  smoothScrollDuration: 0,
  allowProposedApi: true,
  allowTransparency: false,
  customGlyphs: true,
  rightClickSelectsWord: false,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: true,
  altClickMovesCursor: false,
  wordSeparator: ' ()[]{}<>\'"`|;!$^*',
  convertEol: false,
  windowOptions: { getWinSizePixels: true, getCellSizePixels: true, getWinSizeChars: true },
  theme: TERMINAL_THEMES.graphite,
};
```

- `wordSeparator`: GTK word characters are alphanumerics, `-#%&+,./=?@\_~:` and anything above U+2E7F. Everything else separates words.
- The `windowOptions` entries mirror GTK's replies to CSI 14t/16t/18t. GTK also answers:
  - DA1 `CSI ?62;22c`
  - DA2 `CSI >1;10;0c`
  - XTVERSION `DCS >|Tesseract(1.0) ST`
  - DSR 5/6
  - DECRQM
  - OSC 10/11/12 and OSC 4 color queries, using palette colors formatted `rgb:rrrr/gggg/bbbb`
  xterm's built-in replies are acceptable. OSC 7 (cwd) is parsed but unused.
- `onTitleChange` (OSC 0/2) → the toolbar subtitle.

### 7.5 Scrollbar
- GTK overlays a scrollbar on the right with margin `4 2`, a 6px slider in borderStrong and a transparent track. It is visible only once there is scrollback.
- In xterm, style `.xterm-viewport` scrollbar: `width: 10px` (6px thumb with a 2px transparent border), thumb `borderStrong`, `border-radius: 999px`, track transparent. Keep `.xterm-viewport { background: transparent }`.
- Optional micro-animation: fade the thumb in/out over 120ms while scrolling.

### 7.6 Keyboard (handle in `attachCustomKeyEventHandler`; return false to swallow)

| Keys | Action |
|---|---|
| Ctrl+Shift+C | copy selection (to clipboard) |
| Ctrl+Shift+V | paste |
| Shift+PageUp / Shift+PageDown | scroll scrollback by `rows − 1` lines |
| Ctrl+Shift+Home / Ctrl+Shift+End | scroll to top / bottom |
| Ctrl+`=` / Ctrl+`+` / Ctrl+Numpad`+` | font +1px |
| Ctrl+`-` / Ctrl+Numpad`-` | font −1px |
| Ctrl+`0` / Ctrl+Numpad`0` (no Shift) | reset to 14px |

- Everything else goes to the PTY using standard xterm encodings, which xterm.js already does:
  - Cursor keys: `CSI A..D/H/F`, or SS3 in application cursor mode, with modifiers `CSI 1;{mod}X`.
  - Tilde keys: `CSI n~` for Insert, Delete, PageUp/PageDown and F5–F12.
  - F1–F4 are SS3 P–S.
  - Enter is `\r` (Alt/Shift+Enter → `ESC \r`).
  - Backspace is `\x7f` (Ctrl → `\x08`, Alt → `ESC \x7f`).
  - Shift+Tab is `CSI Z`.
  - Ctrl+letter → C0; Alt+char → `ESC`+char.
  - Application keypad mode is supported.
  GTK sends `ESC \r` for **Shift**+Enter; xterm sends `\r`. Add a key handler for Shift+Enter → `\x1b\r` so Claude Code's newline works the same way.
- Any user keystroke or paste scrolls back to the bottom and resets cursor blink.
- Focus reporting (DEC 1004) sends `CSI I` / `CSI O`. xterm supports this.
- **Accelerator guard:** while a terminal has focus, app-level shortcuts are suspended if they use Ctrl or Alt without both Ctrl **and** Shift (Super shortcuts stay active). In Electron:
  - Don't register those accelerators in the application `Menu` while a terminal is focused. Rebuild the menu or use `before-input-event` with a focus flag from the renderer.
  - Check `document.activeElement` inside the renderer's global shortcut hook.
  - Ctrl+Shift+… app shortcuts keep working.
- IME: the commit text is sent as input, and GTK disables preedit display. xterm's textarea composition is fine.

### 7.7 Mouse and selection
- Mouse reporting (modes 9/1000/1002/1003, SGR 1006): xterm handles it natively.
  - Holding **Shift** bypasses reporting and selects text. Set `macOptionClickForcesSelection` for mac.
  - When mouse tracking is on and input is enabled, the pointer cursor is `default`; otherwise `text`.
- Selection:
  - Single click-drag selects characters; double-click selects a word; triple-click selects a line.
  - Shift+click extends the existing selection.
  - Dragging outside the canvas autoscrolls 1 line every **60ms**.
  - A zero-length selection clears on release.
- Primary selection (Linux): on mouse-up (and immediately on double/triple click), copy the selection to PRIMARY with `clipboard.writeText(text, 'selection')` via the preload bridge. Middle-click pastes PRIMARY (`clipboard.readText('selection')`).
- Wheel:
  - With mouse reporting, send wheel button events, one per 3 lines.
  - On the alt screen with alternate-scroll (DEC 1007, default on), send Up/Down arrow keys ×lines.
  - Otherwise scroll scrollback **3 lines** per wheel notch; pixel deltas use `dy / cellHeight`.
  - xterm's default behaviour matches.
- Right-click opens a context menu at the pointer (no arrow):
  - Section 1: `Copy` (disabled when nothing is selected), `Paste` (disabled when input is disabled), `Select All`.
  - Section 2: `Clear Scrollback`.
  - In Electron, use the app's custom React popover menu (Linear style), not a native menu, to stay pixel-consistent.

### 7.8 Copy / paste / clear semantics
- Copy: the selected text with trailing blanks trimmed per line. Soft-wrapped lines join without a newline. Wide-char tails are dropped. `term.getSelection()` matches.
- Paste: normalise `\r\n` and `\n` to `\r`. With bracketed paste (2004), wrap in `CSI 200~ … CSI 201~` and strip embedded markers. `term.paste(text)` does exactly this.
- Clear Scrollback: drop history, move the cursor line to the top of the screen, clear the selection and scroll to the bottom. Use `term.clear()`.
- Select All: `term.selectAll()`.

### 7.9 Resize
- Refit (FitAddon) on host resize (ResizeObserver), on font zoom, on font load and when a session becomes visible.
- Clear the selection whenever the grid changes.
- Debounce the outbound `resize` frame by **90ms** (trailing), and send it only when the socket is `open`.
- GTK reflows nothing on width change (it truncates and pads lines). xterm reflows; keep xterm's reflow.
- Shrinking rows pushes top lines into scrollback, keeping the cursor visible. Growing pulls lines back. xterm behaves the same.

### 7.10 Rendering performance
- GTK feeds output in 12ms time slices of 16 KiB to stay responsive.
- Synchronized output (DEC 2026) holds redraws for up to 200ms. xterm supports 2026 natively.
- Use `@xterm/addon-webgl` with a fallback to DOM when the context is lost.

## 8. Micro-animations (Electron)

All use `cubic-bezier(0.2,0,0,1)` (ease-out), and each one is disabled under `prefers-reduced-motion`.

| Element | Animation |
|---|---|
| Row / toolbar button / chip hover | background 120ms |
| Button press | scale 0.95 |
| Row delete button ↔ status dot | opacity crossfade 120ms |
| New session row | height + opacity 180ms (enter) |
| Removed row | height + opacity 180ms (exit) |
| Picker popover | scale 0.96→1 + fade, 120ms, origin top |
| Banner | translateY(8px)→0 + fade, 180ms |
| Page empty ↔ main | crossfade 180ms (GTK does this) |
| Collapsed drawer | slide from left 220ms, plus a scrim fade 180ms |
| Badge state change | label/color crossfade 120ms |

## 9. GTK quirks — do NOT copy
- Broadway snapshots clamp to 1024×768. The reference PNGs are not 1440×900.
- The session list is torn down and rebuilt on every store change and every 30s tick. Use keyed React rows so hover and focus survive.
- Adw.SplitButton needs CSS overrides to look like a pill chip. Build a real two-part chip component.
- `BannerModel.secondary = "remove"` for exited sessions is computed but never rendered. Render only the primary action. The toolbar's close button (`Remove`) already covers removal.
- There are two separate context menus: the toolbar `more` menu has zoom items and the right-click menu does not. Keeping both is faithful; just don't add zoom to the right-click menu by accident.
- The `dark`/`light` terminal palettes (`#0b0e14`, `#fbfbfd` …) are dead code. Ship only graphite and graphiteLight.
- The custom Pango renderer, row/layout caches, IM multicontext, GLib idle feeding and the libsoup "needs libsoup 3" error have no Electron equivalent.
- Accelerator juggling via `set_accels_for_action` is GTK-specific. Use the focus-aware approach in section 7.6.
- The 6px dot inside the row is sized via `min-width`/`min-height` overriding the global 8px `.to-tone-dot`. In React, give the row dot an explicit 6px size.
