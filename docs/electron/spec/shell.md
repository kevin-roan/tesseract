# Shell spec: window, titlebar, sidebar, navigation, dialogs, tray

This spec describes the app shell of the GTK4/libadwaita desktop app (`apps/desktop`, "Tesseract", app id
`dev.tesseract.Desktop`, version `0.1.0`). Use it to rebuild the shell in React/Electron so it matches the
GTK app pixel for pixel. Every number here comes from the Python source. File references point to
`apps/desktop/tesseract_desktop/`.

Scope: the window chrome, the custom titlebar and window controls, the sidebar, the navigation model,
the command-line flags, the tray, the shell dialogs (DialogShell, FormDialog, ConfirmDialog, Pair, Host PIN,
Host Unlock), the keyboard shortcuts, the global state flow and all shell strings. The page bodies
(Overview, Agents, …) and the Preferences/Settings dialog have their own specs.

---

## 0. Design tokens the shell uses

### 0.1 Rendered schemes

The app has three appearances: `system | light | dark`. The default is **`dark`** (`theme/semantic.py`
`DEFAULT_APPEARANCE`). Only two palettes are ever rendered:

- dark → `graphite`
- light → `graphiteLight`

The `light` and `dark` palettes (`LIGHT`, `DARK`) are legacy and are **never rendered**. Do not port them.

| token | graphite (dark) | graphiteLight |
|---|---|---|
| background (window) | `#09090A` | `#F5F5F6` |
| surface (content panel, inset) | `#121213` | `#FFFFFF` |
| surfaceElevated (dialogs, popovers, toasts, tooltips) | `#1A1A1B` | `#FFFFFF` |
| surfaceSunken | `#09090A` | `#F5F5F6` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected (selection, pressed) | `#232325` | `#E7E7EA` |
| overlay (modal dimming) | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.28)` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| textInverse | `#09090A` | `#FFFFFF` |
| textOnAccent | `#FFFFFF` | `#FFFFFF` |
| border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| accent | `#5E6AD2` | `#5E6AD2` |
| accent hover (`button.suggested-action:hover`) | `#6C78E6` | `#6C78E6` |
| accentPressed | `#4F5BC4` | `#4F5BC4` |
| accentMuted | `#1E2036` | `#EDEEFA` |
| accentStrong (links) | `#9EA6F0` | `#4F5BC4` |
| focusRing | `#5E6AD2` | `#5E6AD2` |
| success / Muted / Solid | `#4CB782` / `#14261C` / `#4CB782` | `#2E8A5B` / `#E5F4EC` / `#4CB782` |
| warning / Muted / Solid | `#F2C94C` / `#2B2410` / `#F2C94C` | `#8F6400` / `#FBF2D9` / `#E2B22E` |
| danger / Muted / Solid | `#EB5757` / `#2C1517` / `#EB5757` | `#C93A3A` / `#FCE9E9` / `#EB5757` |
| info / Muted / Solid | `#4EA7FC` / `#122233` / `#4EA7FC` | `#1F6FCB` / `#E5F1FE` / `#4EA7FC` |
| text selection | `rgba(94,106,210,0.35)` | same |

Tones (`theme/tone.py`). Each tone maps to a foreground, a background and a solid colour:

| tone | foreground | background | solid |
|---|---|---|---|
| neutral | textSecondary | backgroundElement | textTertiary |
| info | info | infoMuted | infoSolid |
| success | success | successMuted | successSolid |
| warning | warning | warningMuted | warningSolid |
| danger | danger | dangerMuted | dangerSolid |

Project tints (`theme/palette.py PROJECT_TINTS`, Linear label hues, index 0..8):
`#5E6AD2 #26B5CE #4CB782 #F2C94C #F2994A #EB5757 #E255A1 #9B51E0 #4EA7FC`.

To assign tints, sort the projects by id. Each project takes `crc32(id) % 9`. If that tint is already
taken, it takes the next free index, wrapping around. This gives up to 9 distinct tints
(`theme/project_tints.py`). Use the standard zlib CRC-32 (the same as Node's `zlib.crc32`, or a small JS
implementation).

### 0.2 Spacing, radius, sizes (`theme/tokens.py`)

- Spacing: `xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40, 4xl 48, 5xl 64, 6xl 80`.
- Radius: `xs 4, sm 6, md 8, lg 10, xl 12, 2xl 16, 3xl 20, card 10, sheet 12, pill/full 999`. The graphite
  schemes use the same values: their "square" override only re-asserts card 10, sheet 12, pill 999.
- Control heights: `xs 24, sm 28, md 32, lg 36, xl 44`.
- Icon sizes: `xs 16, sm 16, md 16, lg 24, xl 32, 2xl 48, 3xl 64`. Almost every icon is 16 px. Carets are
  10 px.
- Border widths: `hairline 0.5, thin 1, thick 2, focus 3`. The shell only uses 1 px.
- Shadows:
  - level1 `0 1px 2px rgba(0,0,0,.2)`
  - level2 `0 4px 12px rgba(0,0,0,.3)`
  - level3 `0 8px 24px rgba(0,0,0,.4)`
  - level4 `0 16px 48px rgba(0,0,0,.5)`
- Durations: `fastest 60, fast 120, normal 180, slow 260, slower 400, slowest 720` ms.
- Easings:
  - standard / emphasized `cubic-bezier(0.2,0,0,1)`
  - decelerate `(0,0,0,1)`
  - accelerate `(0.3,0,1,1)`
  - overshoot `(0.34,1.56,0.64,1)`
- Press scale: card 0.98, control 0.95.

### 0.3 Typography (`theme/typography.py`)

Fonts are bundled in `apps/desktop/data/fonts`:

- Inter Regular/Medium/SemiBold/Bold
- Inter Display Medium/SemiBold/Bold
- Geist Mono 400/500/600/700

Font stacks:

- sans: `Inter, "Inter Variable", "Adwaita Sans", Cantarell, sans-serif`
- display: `"Inter Display", Inter, …`
- mono: `"Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", monospace`

Base font size is **13 px** on `window, dialog, popover`.

| variant | size/line-height | weight | family | letter-spacing |
|---|---|---|---|---|
| h1 / title | 24/30 | 600 | display | -0.4px |
| h2 | 18/24 | 600 | display | -0.2px |
| h3 | 15/20 | 600 | display | -0.2px |
| h4 | 14/20 | 500 | sans | 0 |
| body | 13/20 | 400 | sans | 0 |
| bodyStrong | 13/20 | 500 | sans | 0 |
| bodySmall | 12/18 | 400 | sans | 0 |
| label | 13/18 | 500 | sans | 0 |
| button | 13/18 | 500 | sans | 0 |
| caption | 12/16 | 400 | sans | 0 |
| overline | 12/16 | 500 | sans | 0 (**not** uppercase despite the name) |
| code | 12/18 | 400 | mono | 0 |

Text widgets are single-line and ellipsize at the end by default (`widgets/text.py`). Wrapped text clamps
to N lines with an end ellipsis when `lines` is given, and is unclamped when `lines=None`.

### 0.4 Icons

The icons are Lucide, resolved through `theme/icons.py`. The shell uses these names:

| logical | Lucide |
|---|---|
| overview | `house` |
| agents | `mouse-pointer-2` |
| projects / project / sandbox | `box` |
| files | `files` |
| terminal | `square-terminal` |
| display / host | `monitor` |
| settings | `settings` |
| search | `search` |
| compose | `square-pen` |
| add | `plus` |
| close | `x` |
| fullscreen | `maximize-2` |
| copy | `copy` |
| send | `arrow-up` |
| caret-down | `chevron-down` |
| caret-right | `chevron-right` |
| confidential | `lock` |

The app logo is the `dev.tesseract.Desktop` app icon (`data/icons/hicolor/*/apps`).

### 0.5 Global interaction motion (`theme/extras/motion.py`)

- These elements transition `background, color, border-color, box-shadow, opacity, filter, outline-*,
  transform` over **120 ms cubic-bezier(0.2,0,0,1)**: buttons, menu items, activatable rows, nav rows,
  tabs, entries, `.to-card`, `.to-surface`, sidebar project rows, banners and the composer.
- `button:active` scales to **0.95**.
- Sidebar project main button, run button and status footer button scale to **0.98** when active.
- The live-dot pulse is a 2880 ms infinite opacity animation, 1 → 0.35 → 1, with the standard easing.
- Revealers (section folding, project run lists) and crossfade stacks run for **180 ms**.
- In Electron, honour `prefers-reduced-motion: reduce`: set durations to 0 and drop scale-on-press.

### 0.6 Zoom

- Zoom steps: `0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0`. The value is clamped to that range.
- GTK multiplies every `px` value in the CSS by the zoom (`scale_css`).
- In Electron, use `webContents.setZoomFactor(z)`. It gives the same effect.
- Each change shows a toast `Zoom {percent}%` (rounded) and is saved as `zoom` in settings.

---

## 1. Window chrome

`window.py`, `theme/tokens.py`, `theme/extras/chrome.py`.

- Title: `Tesseract`.
- Default size **1240×800**. Minimum size **360×480**.
- The window is frameless (client-side decorations). There is no system title bar. Both the sidebar
  header and the page header act as drag regions (`-webkit-app-region: drag`, with buttons set to
  `no-drag`).
- The window background is `background` (`#09090A` dark, `#F5F5F6` light). Font size 13 px.
- The GTK window has rounded outer corners and a 1 px edge, which come from libadwaita's CSD. In Electron,
  use `frame:false`, a transparent window with an inner `border-radius: 12px` and
  `1px solid border`. On macOS, prefer the native `titleBarStyle:'hiddenInset'` traffic lights (see §3.4).

### 1.1 Layout

The window is a two-pane split view (`Adw.NavigationSplitView`), wrapped in a toast overlay:

```
┌──────────── window (#09090A) ──────────────────────────────────────────────┐
│ ┌ sidebar pane (width W, bg = window) ┐┌ content frame (bg = window) ──────┐ │
│ │ sidebar header (44px)               ││ ╭ content panel (surface #121213)╮│ │
│ │ scroll body: nav groups + projects  ││ │ page header (44px, divider)    ││ │
│ │                                     ││ │ connection banner (revealer)   ││ │
│ │ footer: composer + status row       ││ │ page body                      ││ │
│ └──────────────────────(resize 6px)───┘│ ╰────────────────────────────────╯│ │
│                                        └───────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

Content panel (`navigation-view.to-panel`):

- margin `8px 8px 8px 0`
- border-radius **8 px**
- border `1px solid border`
- background `surface`
- overflow hidden

When the window is collapsed, the panel also gets `margin-left: 8px`.

### 1.2 Sidebar width and resize

- Default width **244**. Clamp range **200–420**. The width is stored as `sidebarWidth` in settings, in
  unzoomed px.
- Rendered width = `stored × zoom` (min = max = that value, so the sidebar is a fixed width).
- The resize handle is a **6 px** wide invisible strip on the sidebar's right edge, with a `col-resize`
  cursor.
  - While hovered or dragging it shows `inset -1px 0 borderStrong` (a 1 px line on its right edge), with a
    120 ms transition.
  - Dragging gives `width = clamp(start + dx / zoom)`, computed in window coordinates. The width is saved
    when the drag ends.
  - A double click resets the width to 244 and saves it.
- The handle is hidden when the window is collapsed.

### 1.3 Collapse breakpoint

- When the window is ≤ **720 px** wide (`max-width: 720sp`), the split view collapses. It then shows either
  the sidebar or the content page, full width.
- `navigate()` always shows the content. `show_sidebar()` (and the header back button) goes back to the
  sidebar.
- While collapsed, the **sidebar header shows the window controls** and its divider. They are hidden when
  the window is expanded.
- The page header always shows the window controls.
- In GTK, the collapsed content header gets libadwaita's automatic back button (`button.back`,
  `margin:0`, styled like the other 28×28 titlebar buttons). In Electron, render a 28×28 `chevron-left`
  ghost button at the start of the page header when collapsed. It returns to the sidebar.

### 1.4 Toasts

- Toasts sit bottom-centre in the window, using libadwaita's toast overlay.
- Style:
  - radius 8
  - background `surfaceElevated`
  - border `1px solid border`
  - text colour `text`
  - shadow level3
- Default timeout **3 s**. An optional action button (label plus callback) appears on the right.
- Dialogs have their own toast overlay. The Pair dialog toasts `Pairing link copied` inside the dialog.
- Electron: show one at a time, queued, fading and sliding up 8 px over 180 ms.

---

## 2. Titlebar

`widgets/titlebar.py`, `theme/extras/chrome.py`.

The `Titlebar` is used both for the page header and for the sidebar header.

- min-height **44 px**. Background none, no shadow, text colour `text`.
- Inner padding **`8px 8px 8px 12px`** (top right bottom left). The sidebar header overrides
  `padding-left: 8px`.
- Children are packed at the start and at the end. Each side has 2 px spacing. The centre is an empty title
  slot.
- The page header has a bottom hairline: `box-shadow: inset 0 -1px divider`. The sidebar header has none.
- End packing order, right to left: `[window controls] [divider] [end widgets…]`. So visually it reads
  `end widgets … | divider | – □ ×`.
- The divider only exists when there are end widgets. It is `1px` wide, margin `6px 4px`, colour `divider`.
- Titlebar buttons (`button`, `menubutton > button`):
  - **28×28**, padding 0, radius 6
  - no background, border or shadow
  - colour `textSecondary`
  - hover: background `backgroundElement`, colour `text`
  - checked/open: background `backgroundSelected`, colour `text`
- When the window is unfocused (backdrop), the header title and the brand mark drop to `opacity: 0.7`.
  Window control glyphs turn `textTertiary`.

### 2.1 Page header title (`HeaderTitle`)

This is a Linear-style breadcrumb: `[parent] › Title`.

- Horizontal, 6 px gap, vertically centred.
- parent: `label` variant (13/18 500), colour `textSecondary`. Hidden when empty.
- separator: `chevron-right`, 10 px, `textTertiary`. Only visible with a parent.
- title: `label` variant, colour `text`.
- Root pages show only the title, for example "Overview".
- Pushed sub-pages get `subtitle = parent page title`, so they show "Projects › my-app".
- Page-specific header widgets (`page.header_widgets()`) are packed at the end, before the divider.

### 2.2 Window controls (`widgets/window_controls.py`)

- Order: minimize, maximize, close. Spacing **6 px**.
- GTK reads `gtk-decoration-layout` and shows only the requested buttons, but **close is always shown**.
  For Electron, show all three on Linux and Windows, and use native traffic lights on macOS.
- Button: **24×24**, padding 0, radius 6, no background, colour `textSecondary`, `outline-offset: -2px`.
  - hover: background `backgroundElement`, colour `text`
  - active: background `backgroundSelected`, colour `text`
  - **close** hover: background `dangerSolid` (`#EB5757`), colour `#fff`
  - close active: background `danger`, colour `#fff`
  - focus-on-click is off
- Glyphs are hand-drawn, not icons. Draw them as inline SVG:
  - The canvas is 14×14 (glyph 10 + 4). The glyph box is 10×10, centred, snapped to `floor((W-10)/2)+0.5`.
  - Stroke **1.25**, round caps, `currentColor`. `span = 9`.
  - minimize: a horizontal line through the middle, from `(x, y+5)` to `(x+9, y+5)`.
  - maximize: a rounded square `9×9` with corner radius **1.5**.
  - restore (when maximized): offset = 2.
    - a front rounded square at `(x, y+2)` sized `7×7`, radius 1.5
    - plus a back-square L-path: `(x+2, y+1.5) → (x+2, y) → (x+9, y) → (x+9, y+7) → (x+7.5, y+7)`
  - close: two diagonals across the 9×9 box.
- Tooltips and accessible labels are `Minimize`, `Maximize` / `Restore` (they swap with the maximized
  state) and `Close`.
- Close on the main window hides it when a tray is attached (§7). Otherwise it quits.

---

## 3. Sidebar

`window.py _build_sidebar`, `widgets/sidebar_projects.py`, `widgets/sidebar_model.py`,
`widgets/sidebar_composer.py`, `shell.py ConnectionStatusRow`, `theme/extras/sidebar.py`.

The sidebar background is transparent, so it shows the window background. From top to bottom it has a
header (top bar), a scroll body (vertical scroll only) and a footer (bottom bar).

### 3.1 Sidebar header

The left side holds the **workspace switcher**, a menu button showing `BrandMark`:

- Button: min-height 28, padding `0 6px`, radius 6, no background, colour `text`.
  - hover: `backgroundElement`
  - open: `backgroundSelected`
- `BrandMark`, with an 8 px gap:
  - the app logo at **20 px**
  - `Tesseract` in `bodyStrong` (13/20 500)
  - a `chevron-down` caret at 10 px, `textSecondary`
- Tooltip: `Main menu`.
- Clicking opens the **main menu** popover (§3.6).

The right side holds two buttons, then the window controls when collapsed:

- **Search**: `search` icon, tooltip `Search conversations`, 28×28 ghost. It navigates to `agents` with
  `{search: true}`.
- **Compose**: `square-pen` icon, tooltip `New conversation (Ctrl+N)`, 28×28 **circular** (radius 999).
  - background `backgroundElement`, colour `text`
  - hover `backgroundSelected`
  - It navigates to `agents` with `{new: true}`.

### 3.2 Scroll body

- Padding `0 8px 12px`. It contains the nav groups, then the Projects group.

**Section group (`SidebarSection`)**: a Linear "Title ▾" fold.

- Group margin-bottom **12 px**.
- Header row: min-height **28**, margin-bottom **2**.
- Toggle button:
  - min-height 24, padding `0 8px`, radius 6, flat, left-aligned
  - content: an `overline` label (12/16 500, `textSecondary`), a 6 px gap and a `chevron-down` caret
    (10 px, `textSecondary`)
  - on hover, the label and caret turn `text`
- Clicking folds or unfolds the content with a 180 ms slide-down revealer. The caret switches between
  `chevron-down` (open) and `chevron-right` (closed).
- Fold state is in-memory only. It is not persisted.
- Optional trailing action buttons (Projects has `+`) are `opacity: 0` until the section header is hovered
  or the button is focus-visible.

**Nav groups.** The pages are grouped by `section`, in the order `sandbox, host, app`. The titles are:

| section | title |
|---|---|
| sandbox | `Sandbox` |
| host | `Host` |
| app | `App` |

At the moment every page is in `sandbox`, so only one "Sandbox" group renders. Within a section, pages sort
by `(order, title)`:

| order | id | title | icon |
|---|---|---|---|
| 0 | `overview` | `Overview` | house |
| 10 | `agents` | `Agents` | mouse-pointer-2 |
| 20 | `projects` | `Projects` | box |
| 25 | `files` | `Files` | files |
| 30 | `terminals` | `Terminals` | square-terminal |
| 40 | `display` | `Display` | monitor |

Nav row:

- min-height **28**, padding `0 8px`, radius **6**, margin-bottom **1**, colour `text`.
- Content, with an 8 px gap:
  - icon 16 px `textSecondary`
  - label `label` 13/18 500, which expands
  - count badge
- hover `backgroundElement`, active `backgroundSelected`.
- **selected**: background `backgroundSelected` (`#232325` / `#E7E7EA`), icon turns `text`.
- Only one row is selected across all groups. Selection follows the current page.
- Count badge (`CountBadge`):
  - plain text, 12 px, `textSecondary`, no background
  - hidden when the count is 0 or null
  - shows `99+` above 99
- Only **Agents** has a badge: `running runs + inbox.attentionCount`.

**Projects group** (`SidebarProjects`). Title `Projects`. Trailing `+` action:

- 22×22, radius 4, margin-right 2, `textSecondary`
- hover: background `backgroundSelected`, colour `text`
- tooltip and aria-label `New project`
- disabled while offline
- navigates to `projects` with `{create:true}`

The group's content depends on the workspace state, `workspace_state(online, projects, itemCount)`:

| state | when | shows |
|---|---|---|
| `loading` | projects not loaded yet and online | spinner (14 px) and `Loading projects…` |
| `offline` | not loaded and offline, or loaded but empty and offline | `Connect to the sandbox to see your projects.` |
| `empty` | loaded and online with 0 items | `No projects yet.` plus link button `Create a project` |
| `ready` | items > 0 | the project list |

- Status box: margin `4px 8px`, 8 px gap. The message is `caption`, `textTertiary`, wrapped and clamped to
  3 lines.
- The `Create a project` link button:
  - margin `0 4px`, padding `0 4px`, min-height 24
  - colour `accentStrong`, weight 500
  - hover background `backgroundElement`
  - navigates to `projects` with `{create:true}`

**Project list.**

- Vertical, 1 px gap between entries.
- Items come from `project_items(projects, runs, "No project")`:
  - Each project collects its runs, keyed by `run.projectId`.
  - Runs whose project id is null or unknown go into a synthetic **`No project`** item (id `null`). That
    item is only added when such runs exist.
  - `running` = the number of runs with `state=="running"`.
  - Each project keeps its top **5** runs. Runs sort with running first, then by latest activity
    (`max(endedAt, startedAt)`), newest first.
  - `last_activity` = max(the project's last git commit date, its run activities).
  - Item sort: real projects before "No project", then running count descending, then last_activity
    descending, then name, case-insensitive.

Project entry (`ProjectEntry`) row (`.to-side-row`):

- Radius 6. Background is the project tint wash at rest, at alpha **0.05** (dark) or **0.06** (light).
- On hover the wash deepens to **0.09** (dark) or **0.10** (light). With no tint, hover is
  `backgroundElement`.
- The "No project" row has no tint.

Main button (fills the row):

- min-height 28, padding `0 8px`, radius 6, flat, colour `text`. Active: `backgroundSelected` and scale 0.98.
- Content, with an 8 px gap:
  1. Activity indicator, 16×16. It shows a spinner while the project has running runs (tone info).
     Otherwise it shows the `box` icon (`mouse-pointer-2` for "No project") in `textSecondary`.
  2. Name, `label` 13/18 500.
  3. A `lock` icon (16, `textTertiary`, tooltip `Confidential`) when `project.confidential`.
  4. A spacer.
  5. Running count, `caption` at 12 px, `textSecondary`. It shows just the number when > 0, with the
     tooltip `{count} running`.
- Tooltip and aria-label: `Open {name}`. The "No project" row has no tooltip; its aria-label is the name.
- Click: a real project navigates to `projects` with `{projectId}` and also preselects that project in the
  composer. "No project" toggles its runs instead.

Hover-only buttons appear after the main button. They have `opacity:0` and show on row hover or focus:

- `+`: 22×22, radius 4, tooltip `New conversation in {name}`. It navigates to `agents` with
  `{new:true, projectId}` (just `{new:true}` for "No project") and preselects the project in the composer.
- Chevron: 22×22, `chevron-right` when collapsed and `chevron-down` when expanded. Tooltip
  `Show conversations` / `Hide conversations`. It toggles the run list.

Run list:

- Revealer, 180 ms. Vertical, 1 px gap, padding `1px 0 4px`.
- Initial expansion = whether the project is active (has running runs). A user toggle is remembered per
  project id for the session.
- A project that becomes active auto-expands, unless the user has already toggled it.
- Empty run list: `No conversations yet` in `caption` `textTertiary`, margin-left **40**, margin-top 2,
  margin-bottom 4.
- Run button (`RunButton`):
  - margin-left **30** (`SIDEBAR_RUN_INDENT`), min-height **26**, padding `0 8px`, radius 6, flat
  - hover `backgroundElement`
  - Content, with an 8 px gap:
    - indicator 12×12: an 8 px tone dot, or a spinner when running
    - title in `bodySmall` 12/18 `textSecondary`, which expands and ellipsizes. It turns `text` on hover or
      while running.
    - relative start time in `caption` `textTertiary`
  - title = the first non-blank line of the prompt, trimmed to 80 chars with `…`. When that is empty, use
    `Untitled conversation`. The tooltip is the same title.
  - Run tones: running = info (shows a spinner), succeeded = success, failed = danger, cancelled = neutral,
    anything else = neutral.
  - Click navigates to `agents` with `{runId}`.

### 3.3 Sidebar footer

- Padding `4px 8px 8px`.
- It holds the composer, then the connection status row.

**Composer** (`SidebarComposer`; the composer spec covers it in full):

- Container: margin-bottom 4, padding `8px 6px 6px 10px`, radius 8, border `1px solid border`.
  - background `color-mix(in srgb, surface 50%, background)`
  - when focused, the border turns `borderStrong`
- Text input: 13 px, transparent background, insets 4/2, max height 168 px before it scrolls. Placeholder
  `Ask Claude…` in `textTertiary`.
- Footer row, with a 2 px gap:
  - attach button: 24×24, radius 6, `textSecondary`
  - project dropdown: min-height 24, padding `0 6px`, radius 6, flat, label 12 px `textSecondary`. The
    first option is `No project`, then projects by name. Tooltip `Project for the new conversation`.
  - spacer
  - send button: 24×24, circular, background `accent`, `arrow-up` icon 16 in `textOnAccent`. When
    disabled it uses `backgroundSelected` and `textTertiary`. Tooltip `Send (Ctrl+Enter)`.
- Sending navigates to `agents` with `{prompt, send:true, projectId?, attachmentIds?}`.

**Connection status row** (`ConnectionStatusRow`):

- A flat button: min-height **32**, padding `0 8px`, radius 6. Hover `backgroundElement`, active scale 0.98.
- Content, with an 8 px gap:
  1. `ConnectionDot`: a 10 px halo with an 8 px solid tone dot. Tone = the connection tone when offline,
     or the events tone when online.
  2. Title: `label`, `textSecondary`. It is the sandbox name (`health.sandboxId`, otherwise the config
     name), or `Sandbox`.
  3. Detail: `caption`, `textTertiary`, expands and ellipsizes. It is
     `connection_label(without name)`, followed by ` · {events_label}` when online. For example
     `Online · Live`.
  4. A `settings` icon, 16, `textTertiary`.
- Tooltip: the `error_message` when there is one, otherwise `Connection settings`.
- Click opens Preferences.

### 3.4 Platform notes for Electron

- On macOS, use `titleBarStyle: 'hiddenInset'`. Reserve about 72 px on the left of the sidebar header for
  the traffic lights, and do not draw custom controls.
- On Windows and Linux, draw the custom controls above.

### 3.5 Reference geometry, read from the screenshots at 1024 px wide, zoom 1

- The sidebar is 305 px wide. It used the stored `sidebarWidth`; the screenshots did not use the 244 px
  default.
- The panel starts at about x=305, y=8.
- The header row is at y≈22. Nav rows start at y=74 with a 29 px pitch (28 + 1).
- The "Sandbox" section header is at y≈58. The "Projects" header is at y≈274.
- The composer sits at y 653–723, and the status row centre is at y≈744.

### 3.6 Main menu (workspace switcher popover)

Popover style:

- padding 4, radius 8, background `surfaceElevated`, border `1px solid border`, shadow level3
- items: min-height 28, padding `0 8px`, radius 4. Hover/selected background `backgroundSelected`.
- separator: margin `4px 0`, colour `divider`

There are two sections with a separator between them:

1. `New Conversation` (app.new-conversation)
2. `Preferences` (app.preferences)
3. `Pair a device…` (app.pair)
4. `Pair this computer…` (app.pair-host)
5. `Rediscover Sandbox` (app.rediscover)

---

6. `About Tesseract` (app.about)
7. `Quit` (app.quit)

Show the accelerators on the right, in `textTertiary`, as Linear does. GTK shows them automatically for
actions that have accels.

---

## 4. Navigation model

### 4.1 Page ids and params

| page id | params it accepts (from shell callers) |
|---|---|
| `overview` | none |
| `agents` | `{search:true}`, `{new:true, projectId?}`, `{runId}`, `{prompt, send:true, projectId?, attachmentIds?}` |
| `projects` | `{create:true}`, `{projectId}` |
| `files`, `terminals`, `display` | page-specific |

- The **default page** is the first page in sorted order, which is `overview`.
- Pages are built lazily on first navigation and cached for the window's lifetime.
- If a page's build fails, the page is skipped and an error is logged.

### 4.2 `navigate(pageId, params?)`

1. Look up or build the page. If the id is unknown, return false and log a warning.
2. If this is a different page:
   - call `previous.on_hidden()`
   - **replace** the content stack with the page's root (no push animation)
   - set the content title
   - set `store.current_page`
   - select the sidebar row
   - call `page.on_shown()`
3. If it is the same page, pop back to the page's root (`pop_to_tag(pageId)`).
4. Show the content pane (relevant when collapsed).
5. If params are given, call `page.open(params)`.

Electron model: a `currentPage` atom, plus a per-page stack of sub-views
(`push(title, view, headerWidgets, tag)` and `pop()`). Sub-views animate in with libadwaita's push slide.
In Electron, use a 180 ms slide plus fade (x 24 px → 0, opacity 0 → 1). Switching root pages is an
instant replace.

### 4.3 `push`

A pushed view gets its own header, a breadcrumb with `parent title › title`, the banner and its own header
widgets. Popping returns to the previous view.

### 4.4 Connection banner (under every page header)

The banner is a revealer below the page header. It is part of each content page.

Style:

- padding `4px 12px`, radius 0
- background `backgroundElement`, with an inset bottom `1px border`
- by tone, the background becomes `dangerMuted` / `warningMuted` / `infoMuted`
- button: pill (999), padding `0 12px`, background = the tone's solid colour, text `textInverse`

Content, by status (`BANNER`, `services/connection_view.py`):

| status | title | button | action | tone |
|---|---|---|---|---|
| unconfigured | `No sandbox is configured on this machine yet.` | `Set Up` | open Preferences | neutral |
| discovering | `Looking for the sandbox on this machine…` | none | none | info |
| offline | `Can't reach the sandbox: {error}` | `Retry` | `connection.refresh()` | danger |
| unauthorized | `The sandbox rejected the saved token.` | `Fix Connection` | open Preferences | warning |
| incompatible | `{error}` | `Details` | open Preferences | warning |
| connecting, online | hidden | | | |

---

## 5. Command line and process model

`app.py`, `__main__.py`.

- The app is single-instance (GApplication with `HANDLES_COMMAND_LINE`). Running it a second time forwards
  the argv to the primary instance. Electron: `app.requestSingleInstanceLock()` plus `second-instance`.
- On startup, `GTK_THEME` is removed from the environment. Electron does not need this.
- The log level comes from env `TESSERACT_DESKTOP_LOG`, default `INFO`.

| flag | arg | behaviour |
|---|---|---|
| `--hidden` | none | **First invocation only.** Starts in the tray without a window. If a tray watcher is present, it builds the window but does not show it. If a tray item exists but no watcher yet, it holds the app and waits **10 s** (`TRAY_WAIT_S`), then shows the window if no tray appeared. If there is no tray at all, it is ignored and the window is shown. |
| `--page ID` | string | Navigates to that page after showing the window. Also works on second invocations. |
| `--quit` | none | Quits the running instance and destroys its windows. |
| `--debug` | none | Sets logging to DEBUG. |
| `--sync` | none | Copies the cwd to the sandbox, then exits. A local command: no window, no primary-instance forwarding. |
| `--confidential` | none | With `--sync`: sends the project under a pseudonym and keeps its name on this computer. |
| `--pull` | none | Copies sandbox changes back into the cwd, then exits. |
| `--dry-run` | none | With `--pull`: shows what would change and writes nothing. |
| `--force` | none | With `--pull`/`--revert`: overwrites files edited on the host. |
| `--revert` | none | Undoes the last `--pull` in the cwd, then exits. |
| `--sync-status` | none | Shows sandbox changes and sync-back snapshots, then exits. |
| `--get` | none | `Runs inside the sandbox; on this computer use --sync`. On the host it prints that hint and exits. |

These are the help strings as written in the code:

- `Start in the tray without a window`
- `Open a page by id`
- `Quit the running instance`
- `Verbose logging`
- `Copy the current directory to the sandbox and exit`
- `With --sync: send the project under a pseudonym and keep its name on this computer`
- `Copy sandbox changes back into the current directory and exit`
- `With --pull: show what would change, write nothing`
- `With --pull/--revert: overwrite files edited on the host`
- `Undo the last --pull in the current directory and exit`
- `Show sandbox changes and sync-back snapshots and exit`
- `Runs inside the sandbox; on this computer use --sync`

For Electron, `--sync/--pull/--revert/--sync-status/--get` belong in the standalone `tesseract` CLI. The
Electron main process should accept `--hidden`, `--page`, `--quit` and `--debug`.

Without flags, the first activation shows the window.

### 5.1 Startup order (`do_startup`)

1. Register icon paths and set the default window icon.
2. Migrate a config dir left by an earlier product name to `~/.config/tesseract-desktop`.
3. Read settings from `$XDG_CONFIG_HOME/tesseract-desktop/config.json`, or the path in
   `TESSERACT_DESKTOP_CONFIG`. This applies `zoom` and `appearance`.
4. Install the theme.
5. Create the store, the connection service and the `AppContext`.
6. Install the actions and accels.
7. Start the connection, using the saved config, else the environment, else Docker discovery.
8. Start the host shell if it is enabled.
9. Attach the tray. If it attaches, closing the window hides it.

### 5.2 Shutdown

Stop, in order: workspace, syncback, host shell, connection, tray detach, task pool.

### 5.3 Settings keys used by the shell (same JSON file as the connection config)

- `zoom`: number
- `appearance`: `system|light|dark`
- `sidebarWidth`: int, 200–420

---

## 6. Keyboard shortcuts (`app.py ACCELERATORS`)

| action | keys | effect |
|---|---|---|
| app.quit | Ctrl+Q | quit (also hides tray, destroys windows) |
| app.preferences | Ctrl+, | show window, open Preferences |
| app.refresh | Ctrl+R, F5 | `connection.refresh()` (re-poll health/status) |
| app.hide | Ctrl+W | close the window (hides if tray attached, else quits) |
| app.new-conversation | Ctrl+N | show window, navigate `agents {new:true}` |
| app.zoom-in | Ctrl+Plus, Ctrl+=, Ctrl+KP_Add | next zoom step, toast `Zoom N%` |
| app.zoom-out | Ctrl+Minus, Ctrl+KP_Subtract | previous zoom step, toast |
| app.zoom-reset | Ctrl+0, Ctrl+KP_0 | zoom 1.0, toast |

These actions have no accelerator: `show`, `toggle`, `about`, `rediscover`, `pair`, `pair-host` and
`navigate(s)`.

- The composer sends with Ctrl+Enter.
- Dialogs: Enter in an entry submits the form, and Escape closes the dialog (libadwaita default).
- `AccelGuard`: while a terminal has focus, the app strips accelerators that would steal terminal keys. It
  keeps Ctrl+Shift+X and Super combinations. In Electron, the terminal view should stop app shortcuts
  except Ctrl+Shift+*.
- On macOS, map Ctrl to Cmd.

---

## 7. Tray (`tray/__init__.py`, `tray/sni.py`)

- On Linux, the GTK app uses the StatusNotifierItem D-Bus protocol with a dbusmenu menu. Electron's
  `Tray` covers this on all platforms.
- Icon: `dev.tesseract.Desktop` at 256 px, rendered at 22/32/48 px.
- Title `Tesseract`. Tooltip `Tesseract · {status}`, where status is a connection label (§9.5). For example
  `Tesseract · Online`. It updates whenever the connection state changes.
- **Left click (and middle click) toggles the window**: hides it if visible, otherwise shows and focuses it.
- Menu (right click), in order:
  1. `Open Tesseract`: show the window
  2. `Hide Window`: hide it
  3. `Refresh`: app.refresh
  4. `Pair a device…`: app.pair
  5. `Pair this computer…`: app.pair-host
  6. `Preferences`: app.preferences
  7. separator
  8. `Quit Tesseract`: quit
- Hide-on-close: while the tray is shown, closing the window only hides it, and the app keeps running.
- If the tray host disappears while the window is hidden, the window is shown again so the app is never
  unreachable.
- If the tray appears later (it was not there at start), hide-on-close turns on at that point.

---

## 8. Dialogs

All modals are libadwaita dialogs. In Electron they are in-window modals: a portal with a dimming backdrop
over the main window.

### 8.1 Common sheet

- Backdrop: `overlay` colour (dark `rgba(0,0,0,0.55)`, light `rgba(0,0,0,0.28)`).
- Sheet:
  - radius **12**
  - background `surfaceElevated` (`#1A1A1B` / `#FFFFFF`)
  - border `1px solid border`
  - shadow level4 `0 16px 48px rgba(0,0,0,.5)`
  - centred
- Height grows to fit the content (`propagate_natural_height`) and scrolls when it would exceed the window.
- Motion in GTK is libadwaita's fade plus scale. In Electron: backdrop fade 180 ms; sheet opacity 0 → 1
  and scale 0.98 → 1 over 180 ms ease-out, reversed in 120 ms on close.
- Escape and the close button both close the dialog. The code does not handle clicks on the backdrop, so
  GTK's backdrop behaviour is not verified. In Electron, clicking the backdrop does nothing, to protect form
  input.

### 8.2 DialogShell (`widgets/dialog.py`)

- Default width **520**.

Header (`.to-dialog-header`):

- padding `12px 12px 4px 16px`, min-height 24, 4 px gap
- left side: the breadcrumb, which expands
- right side: trailing buttons with a 4 px gap. An optional Expand button (`maximize-2`, `Expand`), then a
  Close button (`x`, `Close`).
- Header icon buttons: 24×24, radius 6, `textSecondary`, hover `text`. They are flat, so hover also gives
  `backgroundElement`.

Breadcrumb, `[chip] › Title`, with a 6 px gap:

- The chip (hidden when there is no context):
  - min-height 24, padding `0 8px`, radius 6, background `backgroundSelected`, 6 px gap
  - icon 16 `textSecondary`
  - context text `bodyStrong` `textSecondary`
- caret `chevron-right` 16, `textTertiary`. Only shown when there is a context.
- title `bodyStrong` (13/20 500) `text`

Body: a vertical scroll area. Padding `8px 16px 16px 16px`, with a **12 px** gap between children.

Footer:

- padding `8px 12px 12px 16px`, 8 px gap
- `footer_start`, left-aligned and expanding, holds the secondary actions
- `footer_end`, right-aligned, holds the primary actions
- Footer buttons have min-height **30**

Button variants (`widgets/buttons.py ActionButton`). Each has an optional 16 px icon, a 6 px gap and a
`label` text:

- **primary** (`to-primary`):
  - min-height 28 (30 in footers), radius **999 (pill)**, padding `0 14px`, weight 500
  - background `accent` `#5E6AD2`, text `textOnAccent` (white)
  - hover `filter: brightness(1.1)`, active `accentPressed`, disabled `opacity 0.5`
  - it is the dialog's default widget, so Enter activates it
- **secondary** (`to-secondary`): pill, padding `0 14px`, background `surfaceElevated`, border
  `1px border`. Hover/active fall back to the flat hover.
- **flat**: no background. hover `backgroundElement`, active `backgroundSelected`. Radius 6, padding
  `0 10px`, min-height 28.
- **destructive**: background `dangerSolid`, text `textOnAccent`, no border, pill.

### 8.3 FormDialog (`widgets/form_dialog.py`)

Body order:

1. subtitle: `caption` `textSecondary`, wrapped
2. error notice (danger), hidden until there is an error
3. field groups
4. optional property chips plus their hint lines

`FieldGroup`:

- vertical, 8 px gap
- optional title (`label`)
- fields, with 10 px between them
- optional description: `caption` `textSecondary`, wrapped
- group errors: `caption`, colour `danger`, joined by newlines

`FormField`:

- vertical, 6 px gap
- title in `overline` (12/16 500) `textSecondary`
- then the entry

Entries:

- min-height 32, radius 6
- background `surface`, border `1px border`
- focus: border `accent` plus `outline 1px focusRing` with offset 1
- error: border `danger`, text `danger`
- Password entries have a peek (eye) icon.
- Editing a field clears that field's error.
- Enter submits.

`TitleEntry` is a large borderless input: min-height 36, 18 px / 600 weight, or 15 px / 400 when
monospace.

Footer:

- left: the Cancel (secondary-label) flat button, which closes the dialog by default
- right: a 16 px spinner (only visible while busy), then the primary pill
- `set_busy(true)`: shows the spinner, disables the primary button and all fields
- `submit()` is ignored while busy, hidden or disabled

Property chips:

- margin-top 4, 6 px gap
- each chip: min-height 28, padding `0 10px`, pill, border `1px border`, `textSecondary`, weight 400
- checked: border `borderStrong`, background `backgroundSelected`, text `text`

### 8.4 ConfirmDialog (`widgets/confirm_dialog.py`)

- Width **420**. Header padding-top 16, no breadcrumb context.
- Body: the message in `body` `textSecondary`, wrapped.
- Footer (end): `Cancel` (flat), then the confirm button. Confirm is **destructive** (red) by default, or
  primary when not destructive.
- Initial focus is on **Cancel** when destructive, and on Confirm otherwise. Confirm is the default widget.
- Confirm closes the dialog, then runs the callback.
- `choose()` variant: the same dialog with a full-width dropdown (min-height 28, padding `0 8px`, radius 6,
  border `1px border`, background `surface`) appended to the body. Confirm is disabled when there are no
  options.

### 8.5 Pair dialog (`widgets/pair_dialog.py`), the app.pair / app.pair-host actions

- Width **440**. Title `Pair a device`.
- The breadcrumb chip follows the selected tab:
  - `Sandbox` with the `box` icon
  - `This computer` with the `monitor` icon
- Body, top to bottom:
  1. A **segmented control**, centred, aria-label `Pair a device`, segments `Sandbox` | `This computer`.
     - track: padding 2, pill, border `1px border`, background `surface` inside dialogs, 2 px gap
     - segment: min-height 24, padding `0 12px`, pill, 12 px / 500, `textSecondary`, hover `text`
     - checked: background `backgroundSelected`, text `text`
  2. The active panel (`PairPanel`). Vertical, 12 px gap:
     - **QR tile**: always a white `#ffffff` tile, padding 12, radius 8. The code itself is **176 px**,
       black on white, so the tile is 200 px. Margin-bottom 4.
     - Instructions: `body` `textSecondary`, centred, wrapped.
     - **CopyField**:
       - min-height 32, padding `0 4px 0 10px`, radius 6, border `1px border`, background `surface`
       - the value is `code` (Geist Mono 12) `textSecondary`, selectable, ellipsized in the **middle**
       - inline copy button (24×24, tooltip `Copy link`)
     - Caption: `caption` `textTertiary`, centred, margin-top −4.
     - Notices: an 8 px gap between them, hidden when empty.
     - The secret warning **Notice** (tone warning), always last.
- Footer (end): `Done` (flat, closes), then `Copy link` (primary). Copy link is disabled when the active
  panel has no link.
- Copying puts the link on the clipboard and toasts `Pairing link copied` inside the dialog.

Notice (`widgets/feedback.py`):

- horizontal, 10 px gap, padding `8px 10px`, radius 8, border `1px border`, transparent background
- content: a tone icon (16, tone colour), a body column (optional `bodyStrong` title, then the message in
  `bodySmall` `textSecondary`, wrapped), and an optional flat action button
- action button: tone colour, min-height 24, padding `0 8px`, 12 px

Sandbox panel logic, based on the connection state:

- no config → no link, plus a warning notice `Connect to a sandbox before pairing a device.` with action
  `Set up`, which opens Preferences
- building the link fails → danger notice `Can't build a pairing link: {error}`
- otherwise: link = `tesseract://pair?...`, caption = `Sandbox {name} · {url}` (or just the url when there
  is no name). If the sandbox is not online, add a warning
  `The sandbox is not answering right now. The phone can pair, but it will connect once the sandbox is back.`

Host panel logic, based on the host shell state (`status`, `pairing`, `error`). The notices are built in
this order:

- status `failed` → danger `The host shell couldn't start: {error}`, action `Retry` (host_shell.refresh)
- status `stopped` → warning `The host shell isn't running. Start it so the phone can reach this computer.`,
  action `Start`
- status `starting` → neutral `Starting the host shell…`
- status `external` → neutral `The host shell is running outside Tesseract.`
- then:
  - no pairing yet and not failed → neutral `Reading the host shell settings…`
  - pairing loaded but no PIN → warning `No PIN is set yet. Phones need it to unlock the shell.`, action
    `Set PIN` (opens the Host PIN dialog stacked on top)
- link = `pairing.link` (`tesseract://host...`), caption `Host {name} · {url}`

Opening the dialog triggers `host_shell.refresh()`.

### 8.6 Host PIN dialog (`widgets/host_pin_dialog.py`)

- A FormDialog, width **400**.
- Breadcrumb: chip `This computer` with the `monitor` icon, then the title `Host shell PIN`.
- Subtitle `6 to 12 digits`.
- One group, described by `Saving a new PIN ends every open phone session.`, with two password fields:
  `New PIN`, `Repeat PIN`.
- Footer: `Cancel` on the left. On the right, a spinner and `Save PIN`.
- Validation:
  - the PIN must match `^\d{6,12}$`, otherwise the field error is `The PIN must be 6 to 12 digits`
  - the two entries must be equal, otherwise the `repeat` field error is `The PINs do not match`
- On success: toast `Host shell PIN saved`. The toast shows in the parent Pair dialog when opened from
  there, otherwise in the main window. Then the dialog closes.
- On failure: the error notice shows `Couldn't save the PIN: {error}`.

### 8.7 Host Unlock dialog (`widgets/host_unlock_dialog.py`)

- A FormDialog, width **400**.
- Breadcrumb: chip `This computer` with the `monitor` icon, then the title `Unlock the host shell`.
- Subtitle `Enter the host shell PIN to start the Android emulator`.
- One password field, `PIN`.
- Footer: `Cancel` on the left and `Unlock` on the right.
- Invalid input gives `The PIN must be 6 to 12 digits`.
- On success it closes, then calls `on_unlocked`. On failure the error notice shows the raw error text.

### 8.8 About dialog

This is libadwaita's AboutDialog with:

- application name `Tesseract`
- the app icon
- version `0.1.0`
- developer `Tesseract`
- comments `Monitor and control the Tesseract sandbox from the host, pair phones and keep an eye on this machine.`

In Electron, build a small 360 px DialogShell:

- 64 px icon
- name in `h2`
- version in `caption` `textSecondary`
- the comments in `body` `textSecondary`, centred

### 8.9 Preferences

`app.preferences` and the status row open the Settings dialog (`open_preferences(ctx, pageId?)`). See the
preferences spec. Its title is `Settings`.

---

## 9. Global state flow

### 9.1 Store (`store.py`)

The store holds `Observable<T>` atoms. `set()` only notifies when the value changed (deep `==`).
`bind(widget, fn)` subscribes immediately and unsubscribes when the widget is destroyed. In React, use
zustand or jotai atoms with the same names.

| atom | type | initial |
|---|---|---|
| `connection` | `ConnectionState {status, config, health, error, error_message, checked_at}` | `{status:'unconfigured'}` |
| `status` | SandboxStatus or null | null |
| `inbox` | `{unreadCount, attentionCount}` | `{0,0}` |
| `events` | `idle\|connecting\|open\|closed\|unavailable\|incompatible` | `idle` |
| `window_visible` | bool | false |
| `current_page` | string or null | null |
| `projects` | Project[] or null (null = not loaded) | null |
| `agent_runs` | AgentRun[] or null | null |
| `terminals` | TerminalInfo[] or null | null |

- Connection `status` is one of
  `unconfigured | discovering | connecting | online | offline | unauthorized | incompatible`.
- `online` is `status == 'online'`.
- `sandbox_name` = `health.sandboxId`, otherwise `config.name`.

### 9.2 Connection lifecycle (`services/connection.py`)

- start: use the saved config (file, then env), otherwise **discover** through Docker.
- `connect(config)`:
  - status becomes `connecting`, `status` is cleared, and the poller starts
  - each poll calls `GET health` and `GET status`
  - success: status `online`, which starts the event stream (WebSocket) and an inbox fetch
  - failure, by error kind: `incompatible` (protocol version), `unauthorized` (auth), `unconfigured`,
    otherwise `offline`
  - unauthorized and incompatible slow the poll to 30 s
- Poll interval: **5 s** while the window is visible, **30 s** while it is hidden. Becoming visible
  triggers an immediate refresh.
- `rediscover()`:
  - status becomes `discovering` and Docker discovery runs
  - on success it connects
  - on failure it reconnects to the previous config, or becomes `unconfigured` with the error
- The workspace service polls projects, runs and terminals every **10 s** while visible and **60 s** while
  hidden. It also applies live events.
- `window_visible` is driven by the window's visible property. In Electron, use the `show`, `hide`,
  `minimize` and `restore` events.

### 9.3 Context API (`context.py`)

This is what pages and dialogs depend on. Expose it as React context or hooks:

- `navigate(pageId, params)`, `push(title, view, headerWidgets, tag)`, `pop()`
- `toast(message, timeout_s=3, action_label?, on_action?)`
- `open_preferences(pageId?)`
- `call(fn(client), on_success, on_error, on_done)`: async controller call off the UI thread
- `poll(fn, interval_s, on_result, on_error, on_loading)`
- `subscribe(eventType, listener)`: controller event stream
- `stream(path, on_message)`: WebSocket session

### 9.4 Connection tones

| connection status | tone |
|---|---|
| unconfigured | neutral |
| discovering, connecting | info |
| online | success |
| offline | danger |
| unauthorized, incompatible | warning |

| events status | tone |
|---|---|
| open | success |
| connecting | info |
| idle, closed, unavailable | neutral |
| incompatible | warning |

### 9.5 Connection and event labels

| connection status | label |
|---|---|
| unconfigured | `Not configured` |
| discovering | `Discovering…` |
| connecting | `Connecting…` |
| online | `Online` |
| offline | `Offline` |
| unauthorized | `Token rejected` |
| incompatible | `Incompatible` |

| events status | label |
|---|---|
| idle | `Live updates off` |
| connecting | `Live updates connecting…` |
| open | `Live` |
| closed | `Live updates closed` |
| unavailable | `Live updates unavailable` |
| incompatible | `Live updates incompatible` |

---

## 10. User-facing strings (`strings.py`), verbatim

The strings already quoted above (MENU, TRAY, BANNER, labels, PAIR, HOST_PIN, HOST_UNLOCK, SIDEBAR,
COMPOSER, STATUS_FOOTER, WINDOW_CONTROLS, ABOUT) are the full shell set. Put them in one
`strings/shell.ts` module, keeping the same group and key names. Other groups in `strings.py` belong to the
other specs (Preferences: `PREFERENCES`, `SOURCE_LABELS`, `CLAUDE`, `APPEARANCE`, `STT`, `HOST_SHELL`;
composer: `ATTACHMENTS`; sync: `SYNC_BACK`). For completeness, here are the shell-owned groups as
key → value:

- `SECTION_TITLES`: sandbox `Sandbox`, host `Host`, app `App`. `SECTION_ORDER`: sandbox, host, app.
- `MENU`:
  - new_conversation `New Conversation`
  - preferences `Preferences`
  - rediscover `Rediscover Sandbox`
  - pair `Pair a device…`
  - pair_host `Pair this computer…`
  - about `About Tesseract`
  - quit `Quit`
- `TRAY`:
  - open `Open Tesseract`
  - hide `Hide Window`
  - refresh `Refresh`
  - pair `Pair a device…`
  - pair_host `Pair this computer…`
  - preferences `Preferences`
  - quit `Quit Tesseract`
  - tooltip `Tesseract · {status}`
- `DIALOG`: close `Close`, expand `Expand`, copy `Copy`.
- `PAIR`:
  - title `Pair a device`
  - instructions `Scan with the Tesseract app, or open this link on the phone.`
  - sandbox `Sandbox {name} · {url}`
  - copy `Copy link`
  - copied `Pairing link copied`
  - done `Done`
  - secret `The link contains the API token: share it only with your own devices.`
  - offline `The sandbox is not answering right now. The phone can pair, but it will connect once the sandbox is back.`
  - unconfigured `Connect to a sandbox before pairing a device.`
  - set_up `Set up`
  - invalid `Can't build a pairing link: {error}`
  - tab_sandbox `Sandbox`
  - tab_host `This computer`
  - host_instructions `Scan with the Tesseract app (Host shell), or open this link on the phone.`
  - host_caption `Host {name} · {url}`
  - host_secret `The link contains the host token: share it only with your own devices. Phones also need the PIN.`
  - host_loading `Reading the host shell settings…`
  - host_stopped `The host shell isn't running. Start it so the phone can reach this computer.`
  - host_starting `Starting the host shell…`
  - host_external `The host shell is running outside Tesseract.`
  - host_failed `The host shell couldn't start: {error}`
  - host_no_pin `No PIN is set yet. Phones need it to unlock the shell.`
  - start `Start`
  - set_pin `Set PIN`
  - retry `Retry`
- `HOST_PIN`:
  - title `Host shell PIN`
  - context `This computer`
  - subtitle `6 to 12 digits`
  - pin `New PIN`
  - repeat `Repeat PIN`
  - save `Save PIN`
  - cancel `Cancel`
  - description `Saving a new PIN ends every open phone session.`
  - invalid `The PIN must be 6 to 12 digits`
  - mismatch `The PINs do not match`
  - saved `Host shell PIN saved`
  - failed `Couldn't save the PIN: {error}`
- `HOST_UNLOCK`:
  - title `Unlock the host shell`
  - context `This computer`
  - subtitle `Enter the host shell PIN to start the Android emulator`
  - pin `PIN`
  - unlock `Unlock`
  - cancel `Cancel`
  - invalid `The PIN must be 6 to 12 digits`
- `MAIN_MENU_TOOLTIP` `Main menu`. `REFRESH_TOOLTIP` `Refresh`. `ZOOM_TOAST` `Zoom {percent}%`.
- `BANNER`, `CONNECTION_LABELS`, `EVENTS_LABELS`: see §4.4 and §9.5.
- `ABOUT`:
  - developer `Tesseract`
  - comments `Monitor and control the Tesseract sandbox from the host, pair phones and keep an eye on this machine.`
- `WINDOW_CONTROLS`: minimize `Minimize`, maximize `Maximize`, restore `Restore`, close `Close`.
- `SIDEBAR`:
  - new_conversation_tooltip `New conversation (Ctrl+N)`
  - search `Search conversations`
  - projects `Projects`
  - new_project `New project`
  - loading `Loading projects…`
  - offline `Connect to the sandbox to see your projects.`
  - empty `No projects yet.`
  - create_project `Create a project`
  - no_project `No project`
  - no_runs `No conversations yet`
  - running `{count} running`
  - open_project `Open {name}`
  - new_in_project `New conversation in {name}`
  - expand `Show conversations`
  - collapse `Hide conversations`
  - untitled_run `Untitled conversation`
  - more_runs `All conversations` (currently unused)
  - confidential `Confidential`
- `COMPOSER`:
  - placeholder `Ask Claude…`
  - send `Send (Ctrl+Enter)`
  - project_tooltip `Project for the new conversation`
  - no_project `No project`
  - offline `Connect to the sandbox to start a conversation`
  - unavailable `Conversations aren't available yet`
- `STATUS_FOOTER`: tooltip `Connection settings`, fallback_title `Sandbox`, separator ` · `.
- Page titles (`pages/*/labels.py`): `Overview`, `Agents`, `Projects`, `Files`, `Terminals`, `Display`.

Keep the typographic characters: the ellipsis `…` (U+2026), the middle dot `·` and the curly apostrophe
where the source uses one. The source uses ASCII `'` in "Can't" and "isn't", so keep ASCII there.

---

## 11. GTK quirks NOT to copy

- **Legacy palettes**: `LIGHT` and `DARK` (periwinkle `#C8BFF7` accent, `#FCFCFB` canvas) are dead code.
  Only graphite and graphiteLight render.
- The `.to-nav-row` padding `4px 8px` is overridden by the more specific `list.to-nav-list > row`
  `padding 0 8px`. Use `0 8px`.
- The `overline` variant is not uppercase, despite its name.
- The `--sidebar-bg-color: surfaceSunken` variable is overridden: the sidebar pane is transparent and
  shows the window colour. They are the same colour in graphite anyway.
- `button.pill` gets radius 6 in `_adwaita` but 999 in `_shape`. The primary pill (`to-primary`) is 999,
  and so are dialog footer primary buttons. Use 999 for pills.
- `dialog-bg-color` is set to `background`, but the sheet rule paints `surfaceElevated`. Use
  `surfaceElevated`.
- Spinners are libadwaita `Adw.Spinner`. Use a simple 1.5 px ring spinner in `textSecondary` at the given
  size, with a 1 s linear rotation.
- In GTK, CSS zoom is done by rewriting px values in the stylesheet. Use Electron's zoom factor instead.
- Broadway snapshots render with animations disabled and clamp the window to 1024×768. The reference PNGs
  therefore come out at 1024×768 even though 1440×900 was requested.
- The `gtk-decoration-layout` parsing exists only for GNOME settings. In Electron, use fixed per-OS controls.
- The D-Bus SNI tray, `GTK_THEME` sanitising, `AccelGuard`'s GTK accel juggling and the `TRAY_WAIT_S` hold
  are all Linux/GTK plumbing. In Electron, use `Tray` and only keep the behaviour: hide on close while the
  tray exists, and `--hidden` falls back to showing the window when no tray is available.
- `Adw.NavigationView.replace` on root page switches has no transition. A short crossfade (120 ms) is fine
  in Electron, as long as it stays subtle.
- GTK styles the `:backdrop` (unfocused window) state. Electron has no `:backdrop`: use the
  `browser-window-blur` and `browser-window-focus` events to toggle a `data-backdrop` attribute on `<html>`.

---

## 12. Reference screenshots (`docs/electron/reference/`)

Captured with `apps/desktop/tools/snapshot.sh … --zoom 1 --width 1440 --height 900` on headless broadway.
Broadway clamps the window to **1024×768**, and animations are off. The data is **live**: the user's
running sandbox `tesseract-sandbox`, with 4 projects.

- `shell-default.png`: dark (graphite), default page **Overview**.
  - Sidebar, about 305 px wide (stored width):
    - header: Tesseract brand with caret, search, circular compose
    - "Sandbox ▾" group: Overview selected (`#232325`), then Agents, Projects, Files, Terminals, Display
      (no badge visible)
    - "Projects ▾" group with tinted rows: streaxfit (lock icon, red wash), tesseract (cyan wash),
      hybrid-pos (yellow wash), sante-production (purple wash), then the untinted "No project" row. All
      collapsed, none running.
    - composer with `Ask Claude...` and a `No project` dropdown
    - status row `● tesseract-sandbox  Online · Live  ⚙`
  - Content panel: page header "Overview" with min/max/close controls. The Overview body shows live
    metrics.
- `shell-default-light.png`: the same in light (graphiteLight). Window `#F5F5F6`, panel `#FFFFFF`,
  selection `#E7E7EA`. The project tint washes are visible at alpha 0.06.
- `shell-collapsed.png`: rendered at 600 px wide with `--collapsed-sidebar`, below the 720 breakpoint. The
  sidebar fills the window, and its header now shows the window controls after a divider. No content panel
  is visible.
- `shell-pair-dialog.png`: dark. The main window with the **Pair a device** dialog (`--action pair`) on the
  Sandbox tab:
  - breadcrumb chip `Sandbox` › `Pair a device`, close ×
  - segmented `Sandbox | This computer`
  - white QR tile
  - instructions
  - monospace link field with the copy icon, middle-ellipsized
  - caption `Sandbox tesseract-sandbox · https://tesseract-sandbox.tail…ts.net`
  - warning notice with the token text
  - footer `Done` / `Copy link` (indigo pill)
  - The backdrop dims the window. The sidebar still shows `Loading projects…`, and the status row reads
    `Online · Live updat…` (events still connecting), because the snapshot was taken early.
- `shell-pair-dialog-light.png`: the same dialog in light. The chip background is `#E7E7EA` and the sheet
  is white.
- `shell-pair-host-dialog.png`: `--action pair-host`, on the This computer tab. The chip is
  `This computer` with the monitor icon. **Rendering artefact:** with animations off, the sheet kept the
  height it measured before the host pairing data loaded, so the body is cut off below the QR. The real app
  grows to fit. Do not copy the clipped height.

There are no screenshots of the main-menu popover, the tray or the PIN dialogs, because broadway snapshots
cannot open popovers or nested dialogs. Build those from §3.6, §7 and §8.6–8.7.
