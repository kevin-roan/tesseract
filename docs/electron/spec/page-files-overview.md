# Spec: Overview page and Files page

Source of truth (GTK app, read-only): `apps/desktop/monolith_desktop/pages/overview/**` and `pages/files/**`, plus the shared widgets they use (`widgets/stat_card.py`, `widgets/charts/*`, `widgets/list_view.py`, `widgets/record_row.py`, `widgets/feedback.py`, `widgets/section.py`, `widgets/rows.py`, `widgets/buttons.py`, `widgets/choice_dropdown.py`, `widgets/progress.py`, `widgets/badges.py`) and theme files (`theme/tokens.py`, `theme/typography.py`, `theme/semantic.py`, `theme/chart.py`, `theme/css.py`, `theme/extras/{overview,chart,projects,dialogs,motion}.py`), and `services/metrics.py`, `util/format.py`.

This spec only covers the page content area (inside the inset content pane). The window chrome, sidebar, page header bar (title "Overview" / "Files" + header buttons + window controls) are covered by the shell spec. The one thing here that touches the header bar is the Files page's Refresh header button (see 2.1).

All px values below are CSS px at zoom 1. Colors are given for both rendered schemes: **dark** = the `graphite` scheme, **light** = the `graphiteLight` scheme (the app always renders those two; `dark`/`light` "classic" schemes are not used).

---

## 0. Shared tokens used by both pages

### 0.1 Colors (semantic tokens)

| token | dark (graphite) | light (graphiteLight) |
|---|---|---|
| background (window) | `#09090A` | `#F5F5F6` |
| surface (content pane) | `#121213` | `#FFFFFF` |
| surfaceElevated | `#1A1A1B` | `#FFFFFF` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected | `#232325` | `#E7E7EA` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| accent | `#5E6AD2` | `#5E6AD2` |
| success | `#4CB782` | `#2E8A5B` |
| warning (fg) | `#F2C94C` | `#8F6400` |
| warningSolid | `#F2C94C` | `#E2B22E` |
| danger | `#EB5757` | `#C93A3A` |
| info | `#4EA7FC` | `#1F6FCB` |
| focusRing | `#5E6AD2` | `#5E6AD2` |

Tone → colors (used by badges, notices, progress bars, status glyphs): `neutral` fg=textSecondary, `info` fg=info, `success` fg=success, `warning` fg=warning, `danger` fg=danger.

### 0.2 Chart palette

Categorical series colors (index → color):

| idx | name | dark | light |
|---|---|---|---|
| 0 | indigo | `#8A7BEB` | `#5E6AD2` |
| 1 | teal | `#1FA595` | `#16968A` |
| 2 | coral | `#E36D45` | `#DA6038` |
| 3 | blue | `#3F8FE0` | `#3C87F7` |
| 4 | rose | `#D65C8F` | `#D5508A` |
| 5 | amber | `#B98200` | `#B98200` |

Grid line: dark `rgba(255,255,255,0.06)`, light `rgba(0,0,0,0.06)`. Axis (baseline) line: dark `#2B2B2F`, light `#D0D0D2`. Threshold color = status warning solid: dark `#F2C94C`, light `#E2B22E`.

### 0.3 Spacing / radius / sizes

- SPACING: xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40.
- RADIUS: xs 4, sm 6, md 8, card 10, xl 12, pill/full 999.
- CONTROL_HEIGHT: xs 24, sm 28, md 32.
- Icon sizes: xs/sm/md 16, 2xl 48.
- Durations: fast 120ms, normal 180ms. Standard easing `cubic-bezier(0.2, 0, 0, 1)`.
- Every interactive element transitions `background, color, border-color, box-shadow, opacity, transform` over 120ms standard easing. Buttons scale to 0.95 while pressed (`:active`); pressable cards scale to 0.98.

### 0.4 Typography (Inter for text, Inter Display for `display`-flagged variants, Geist Mono for `code`)

| variant | size / line-height | weight | letter-spacing | family |
|---|---|---|---|---|
| h1 | 24 / 30 | 600 | -0.4px | Inter Display |
| metricSmall | 20 / 24 | 600 | -0.2px | Inter Display, tabular-nums |
| h4 | 14 / 20 | 500 | 0 | Inter |
| label | 13 / 18 | 500 | 0 | Inter |
| body | 13 / 20 | 400 | 0 | Inter |
| bodyStrong | 13 / 20 | 500 | 0 | Inter |
| bodySmall | 12 / 18 | 400 | 0 | Inter |
| caption | 12 / 16 | 400 | 0 | Inter |
| code | 12 / 18 | 400 | 0 | Geist Mono |

Base font size: 13px. Tooltips 12px.

### 0.5 Shared widgets (React components to build once)

- **IconButton** (flat): 28x28 min, radius 6, transparent; hover bg backgroundElement; active bg backgroundSelected; 16px Lucide icon in textSecondary (inherits `color`); native tooltip = label, `aria-label` = label.
- **ActionButton** `primary`: height 28, pill radius 999, bg accent `#5E6AD2`, text white, padding `0 14px`, label variant. `flat`: transparent, hover backgroundElement.
- **StatusBadge**: inline-flex, gap 4, height 20, padding `0 8px 0 7px`, radius 999, 1px solid border, transparent background, caption 12px weight 500, text color = tone fg; leading 6x6 round dot filled with tone fg. A `live` modifier pulses the dot (opacity 1 → 0.35 → 1, 2880ms, standard easing, infinite).
- **Notice**: row with gap 10, padding `8px 10px`, radius 8, 1px border (`border`), background transparent. Leading 16px icon in tone fg (`danger`→`circle-alert`, `warning`→`triangle-alert`, `success`→success icon, else `info`). Body column gap 2: optional title (bodyStrong, tone fg) + message (bodySmall, textSecondary, wraps). Optional trailing flat action button: height 24, padding `0 8px`, font 12px, color tone fg.
- **EmptyState**: centered column, gap 8, margins 40 top/bottom, 24 left/right. Order: spinner 24x24 (loading only) / glyph 48px textTertiary with 4px bottom margin (when not loading and an icon is given) / title (h4, textSecondary, centered, wraps) / message (bodySmall, textTertiary, centered, wraps, max ~56ch) / actions row (gap 8, margin-top 8; primary ActionButton then flat ActionButton).
- **Section**: column gap 8. Header row (min-height 28, gap 8): left column (gap 2) with title (label variant 13/500) + optional subtitle (caption, textSecondary); trailing slot (gap 8, vertically centered). Body crossfades between `content`, `empty` (bodySmall, textSecondary, wraps) and `loading` (16px spinner, left-aligned).
- **Crossfade**: every Gtk.Stack here is a crossfade of 180ms. Implement as opacity fade 180ms ease-out (motion `AnimatePresence mode="wait"` or overlapped absolute layers).

---

## 1. Overview page

Page id `overview`, sidebar section "Sandbox", order 0, icon `house` (Lucide), header-bar title **"Overview"**. No header-bar buttons (the refresh button lives in the page body).

### 1.1 Data sources

No page-owned polling. It renders shared store values:

- `store.connection` (ConnectionState: `status` ∈ unconfigured | discovering | connecting | online | offline | unauthorized | incompatible, `sandbox_name`, `error_message`).
- `store.status` = latest `GET /v1/status` (`SandboxStatus`), refreshed by the connection service every **5s** while the window is visible, **30s** when hidden (together with `GET /v1/health`). `null` when unknown.
- `store.inbox` = `InboxCounts { unreadCount, attentionCount }`.
- `metrics` = MetricsHistory (see 1.6), bumps a `revision` counter on each recorded status.

Refresh button calls `connection.refresh()` (immediate re-poll of health+status).

`SandboxStatus` shape used:

```
sandboxId, hostname, version, startedAt (ISO), uptimeSec,
resources: { cpu: {cores, load1, load5, load15}, memory: {totalBytes, usedBytes}, disk: {path, totalBytes, usedBytes} },
display: { display, available, width|null, height|null, vnc: {available, port, password|null}, webPath },
tools: [{ name, version|null }],
counts: { projects, runningProcesses, activeBuilds, terminals, agentRuns }
```

### 1.2 Top-level states

A crossfade (180ms) between two children:

1. **content** — shown whenever `status != null` (even if the connection is currently offline: stale data stays visible).
2. **empty** — shown when `status == null`. Content comes from the connection status (`EMPTY` table). If the status has no template (i.e. `online` but no status yet), the `connecting` template is used.

| connection status | title | message | icon | spinner | primary button → action | secondary (flat) → action |
|---|---|---|---|---|---|---|
| unconfigured | "Connect to your sandbox" | "Start the stack with \`bun run sandbox up\`, then discover it or enter its URL and token." (backticks are literal text) | `box` | no | "Discover" → rediscover | "Preferences" → open Preferences |
| discovering | "Looking for the sandbox…" | "Asking Docker for the running controller." | none | yes | – | – |
| connecting | "Connecting…" | "Waiting for the controller to answer." | none | yes | – | – |
| offline | "Sandbox unreachable" | `{error}` (connection error message, may be empty) | `cloud-off` | no | "Retry" → connection.refresh() | "Preferences" → open Preferences |
| unauthorized | "Token rejected" | "The controller refused the saved token. Rediscover it or paste a fresh one." | `triangle-alert` | no | "Rediscover" → rediscover | "Preferences" → open Preferences |
| incompatible | "Version mismatch" | `{error}` | `triangle-alert` | no | "Preferences" → open Preferences | – |

### 1.3 Content layout

Scrollable column (vertical scroll only), class `to-page`: padding **24px top, 32px right, 40px bottom, 32px left**, children separated by **24px** (SPACING xl). No max width (fills the pane). Order:

1. Header
2. Attention notice (hidden unless needed)
3. Section "Resources" → stat grid
4. Section "Resource history" → legend + chart card
5. Two equal columns (gap **32px**, `homogeneous`): Section "Activity" | Section "Display"
6. Section "Toolchain"

Within this page, section titles are **13px / 500**, margin-bottom 0.

#### 1.3.1 Header

Column, gap 4.

- Row 1 (gap 12, items centered): title (h1 24/30/600, Inter Display, text color) · StatusBadge · flexible spacer · IconButton `refresh-cw` tooltip **"Refresh"**.
  - Title: `status.sandboxId` if status, else `connection.sandbox_name`, else **"Sandbox"**.
  - Badge label = connection label without name: unconfigured "Not configured", discovering "Discovering…", connecting "Connecting…", online "Online", offline "Offline", unauthorized "Token rejected", incompatible "Incompatible". Tone: unconfigured neutral, discovering/connecting info, online success, offline danger, unauthorized/incompatible warning. (Badge is not marked `live` here.)
- Row 2: meta line, bodySmall (12/18), textSecondary: `"up {uptime} · {hostname} · v{version}"` (joined with `" · "`). Hidden when status is null. Example: `up 7h 46m · theone-sandbox · v0.1.0`.

#### 1.3.2 Attention notice

Visible only when `inbox.attentionCount > 0`. Notice, tone **warning**:
- title: **"Claude needs you"**
- message: `"{count} waiting for input or permission."` where count is `"1 session"` / `"N sessions"`.
- action button **"Open Inbox"** → navigate to page `inbox`.

#### 1.3.3 Resources (stat grid)

Section title **"Resources"**. Grid of 4 tiles: homogeneous columns, gap **8px** both axes, min 2 / max 4 per row (at the screenshot width all 4 fit in one row; switch to 2 columns when a tile would get narrower than its natural width, roughly < 150px each). Implement with CSS grid `repeat(4, 1fr)` and a container-query fallback to `repeat(2, 1fr)`.

Tile (`to-metric-tile`): column, gap 8; padding **12px 14px**; 1px solid `border`; radius **10px**; background transparent; min-height 72px (actual rendered ≈106px with content). Tiles on this page are not clickable (no hover state).

Tile contents:
- Top row (gap 6): 16px icon textTertiary · label (bodySmall 12/18, textSecondary, flex 1) · percent (caption 12/16, textTertiary, right-aligned, tabular-nums) shown only when the tile has a progress value, text `round(clamp(p)*100) + "%"`.
- Values column (gap 2, grows): value row (gap 4, baseline aligned): value (metricSmall 20/24/600 Inter Display tabular, text color) + unit (bodySmall, textSecondary). Below: caption (caption 12/16, textTertiary, single line, ellipsized at end).
- Progress bar (only when progress present), aligned to tile bottom: height **4px**, full width, radius 2 (fully round). Track = bar color at **20% alpha**; fill = bar color; fill width = `max(width*p, 4px)` when p>0. Bar color = accent `#5E6AD2`; when tone is `violet` (usage ≥ 0.85) the color is `warning` (dark `#F2C94C`, light `#8F6400`).

Tiles (ids, icon, label, value/unit, progress, caption):

| id | icon (Lucide) | label | value | unit | progress | caption |
|---|---|---|---|---|---|---|
| cpu | `cpu` | "CPU load" | `load1` formatted `%.2f` | "load avg" | `clamp(load1 / max(1, cores))` | `"{cores} cores · 5m {load5} · 15m {load15}"` (loads `%.2f`) |
| memory | `memory-stick` | "Memory" | `split_bytes(usedBytes).value` | its unit | `used/total` | `"of {format_bytes(totalBytes)}"` |
| disk | `hard-drive` | "Disk" | `split_bytes(usedBytes).value` | its unit | `used/total` | `"of {format_bytes(totalBytes)} · {path}"` |
| uptime | `clock` | "Uptime" | `format_uptime(uptimeSec)` | – | none (no bar, no %) | `"since {relative(startedAt)}"` |

Warning tone threshold: `LOAD_WARNING = 0.85` (≥ 0.85 → warning-colored bar).

#### 1.3.4 Resource history

Section title **"Resource history"**, subtitle **"Share of capacity over time · CPU is load average per core"** (caption, textSecondary). Header trailing: range chips.

Range chips (single-select, always one selected; clicking the selected one keeps it): options in order `5m` **"5 min"**, `15m` **"15 min"** (default), `1h` **"1 h"**. All on one line, gap **6px**. Chip: height 28, padding `0 12px`, pill radius, 1px `border`, transparent bg, textSecondary, label 13/500. Hover: bg backgroundElement, color text. Selected: bg backgroundSelected, border borderStrong, color text.

Card (`to-resource-history`): padding **12px 16px 8px**, 1px solid `border`, radius **10px**, no background. Contents: legend, then chart with **12px** top margin.

**Legend** (`SeriesLegend`): wrapping flex row, gap 6px both axes, left aligned; all 5 items fit a row when space allows (max per row = 5). Each item is a toggle pill:
- height 24, padding `0 10px`, pill radius, 1px `border`, transparent bg; opacity **0.5** when off, **1** when on; hover: bg backgroundElement, opacity 0.8 (when off). Transition opacity/background/border-color 150ms ease.
- content (gap 6): line key 12x8 (a 2px round-capped line across the middle, inset 2px each side, series color, with the series dash) · label (caption, textSecondary) · value (caption 12px, weight 500, tabular-nums, text color).
- tooltip: `"{label} · {caption}"` where caption is `"avg {average} · peak {peak}"` or **"No samples in range"**.
- Value text: current percent (`percent_label`, `"{v*100:.0f}%"`), or **"—"** if no samples in the selected range. avg/peak/current are computed over samples with `t >= now - range`.
- Turning off the last visible series is refused (the toggle snaps back on).

Series (order = legend order; draw order is reversed so CPU is on top):

| key | label | color idx | fill | dash | visible by default |
|---|---|---|---|---|---|
| load1 | "CPU load" | 0 indigo | yes | solid | yes |
| memory | "Memory" | 1 teal | no | solid | yes |
| disk | "Disk" | 2 coral | no | solid | yes |
| load5 | "5m load" | 0 indigo | no | `[6, 5]` | no |
| load15 | "15m load" | 0 indigo | no | `[0.1, 5]` (round-cap dots) | no |

Values are fractions: load series = `loadN / max(1, cores)` (can exceed 1, e.g. 300%), memory = used/total, disk = used/total.

**Chart** (canvas/SVG, height **200px**, full width; redraws at least every 1000ms while mounted so the time axis scrolls, or when ≥1 px of time has passed):

- Time window: `[now - range, now]`, `now = metrics clock (wall time)`.
- Y ceiling: `nice_ceiling(peak of visible series in window, floor=1.0)`: if `peak*1.04 <= 1` → 1.0 (100%); else smallest of `{1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10} × 10^floor(log10(peak*1.04))` that is ≥ `peak*1.04`.
- Y ticks: step chosen from `{1, 2, 2.5, 5} × 10^k` (k from exponent-2..exponent) such that `ceiling/step` is an integer between 2 and 6, closest to 4 ticks, prefer larger step on ties; ticks `0..ceiling`.
- Labels: 11px Inter, tabular nums, color textTertiary; format `"{v*100:.0f}%"`.
- Plot rect: left = widest y-label width + 8; top = 12; right = width − 14; bottom = height − labelHeight − 8 − 8.
- Grid: 1px horizontal line at each y tick across the plot, pixel-snapped; color = grid, except the 0 line and (when ceiling > 1) the 100% line use the axis color. Y labels right-aligned 8px left of the plot, vertically centred on the line.
- Time axis: labels 8px below the plot. Rightmost label is **"now"**, right-aligned to plot right. Tick step = smallest of `5,10,15,30,60,120,300,600,900,1800,3600,7200` seconds such that `span/step <= floor(plotWidth/92)`; ticks aligned to local clock multiples of step. Format `HH:MM` (or `HH:MM:SS` if step < 60). Each label centred on its tick, clamped inside the plot; skipped if it would come within 10px of the previous label or of the "now" label.
- Threshold: dashed (`[5, 4]`) 1px line at **0.85** (only if ≤ ceiling), warning color at 85% alpha. Label **"85% warning"** (11px, textTertiary) right-aligned at plot right − 4, sitting 4px above the line, on a pill plate (padding 4 horizontally, radius = label height/2) filled with surfaceElevated at 85% alpha.
- Series: clipped to the plot (plus line width at the bottom). Smooth monotone cubic (Fritsch–Carlson; tangent magnitude capped at 3) through points. Line 1.5px, round caps/joins, series dash, series color × series alpha. Fill (CPU only): area to the plot bottom, vertical linear gradient from color at **12% × alpha** (top of plot) to 0% (bottom). Gaps (`null` points) break the line into segments; a segment with a single point is drawn as a 2px-radius dot.
- Latest-value dot: for every drawn series whose final point is non-null and inside the window, a dot at the last point: ring 4.5px radius in `surface` color, then 3px radius dot in series color (y clamped to ceiling).
- Empty: if the densest visible series has < 2 points in the window, draw **"Collecting data…"** (12px, textTertiary) centred in the plot and no hover.
- Hover (pointer over plot): snap to the nearest sample time among visible series. Draw a 1px vertical crosshair (textTertiary at 55% alpha) from plot top to bottom, a dot (as above) on each visible series at that time, and a tooltip box: radius 8, fill surfaceElevated, 1px `border`, padding 10, placed at `x + 14` (flipped to `x − 14 − boxWidth` if it would overflow; min 2px from left), top = plot top + 4. Contents: title = time `HH:MM:SS` (11px, textTertiary); then one row per visible series (row gap 4): 14px-wide key line (2.5px stroke, series dash), 8px gap, value (12px semibold, text color; **"—"** if missing), 8px gap, label (11px, textTertiary). Removed on pointer leave.
- Animations (all ease-out cubic `1-(1-p)^3`, **350ms**): y-ceiling changes, range (duration) changes, and series show/hide (alpha 0↔1). Use requestAnimationFrame; skip when `prefers-reduced-motion`.

#### 1.3.5 Activity / Display (two columns, gap 32, equal width)

**Activity** (section title **"Activity"**): a flat list. Top border 1px `divider`. Each row: padding `8px 4px`, bottom border 1px `divider`, radius 0, no background; hover bg backgroundElement; clickable (navigates). Row content (gap 8): 16px icon textSecondary · label (body 13/20, text, flex 1) · value (body, textSecondary, right-aligned, tabular-nums).

| key | icon | label | navigates to page |
|---|---|---|---|
| projects | `box` | "Projects" | projects |
| runningProcesses | `square-terminal` | "Running processes" | processes |
| activeBuilds | `hammer` | "Active builds" | builds |
| terminals | `square-terminal` | "Terminals" | terminals |
| agentRuns | `mouse-pointer-2` | "Claude runs" | agents |

Value = `String(counts[key] ?? 0)`.

**Display** (section title **"Display"**): key/value list. Top border 1px `divider`. Each row: padding `9px 2px`, bottom border 1px `divider`, gap 12; label bodySmall textSecondary (top aligned); value bodySmall text color, right aligned, wraps up to 2 lines, selectable.

| label | value |
|---|---|
| "X display" | `"{display} · Available"` or `"{display} · Unavailable"` (e.g. `:1 · Available`) |
| "Resolution" | `"{width}×{height}"` (U+00D7) or **"—"** if missing |
| "VNC" | `"Port {port} · Available"` / `"Port {port} · Unavailable"` |

#### 1.3.6 Toolchain

Section title **"Toolchain"**; same key/value list as Display but values in **code** variant (Geist Mono 12/18). One row per `status.tools[]`: label = tool name, value = version or **"not installed"**. If the tools list is empty, the section shows the empty text **"The controller reported no tools."** (bodySmall, textSecondary) instead of the list.

### 1.4 Formatting helpers (port exactly)

- `format_uptime(s)`: `<60` → `"{s}s"`; `<3600` → `"{m}m"`; `<86400` → `"{h}h {m}m"` (or `"{h}h"` if m=0); else `"{d}d {h}h"` (or `"{d}d"`).
- `split_bytes(n)`: n ≤ 0/invalid → `("0","B")`; divide by 1024 while ≥ 1024 over `B, KB, MB, GB, TB, PB`; bytes → integer; otherwise ≥100 → 0 decimals, else 1 decimal, JS-style rounding (`floor(v*f+0.5)/f`), trailing `.0` dropped. `format_bytes` = `"{value} {unit}"`.
- `format_relative_time(iso)`: `<45s` "just now"; `<1h` `"{max(1, round(s/60))}m ago"`; `<1d` `"{floor(s/3600)}h ago"`; `<7d` `"{floor(s/86400)}d ago"`; else UTC `YYYY-MM-DD`. Empty string if unparsable.
- `format_load(x)` = `x.toFixed(2)`.
- `pluralize(n, word)` = `"{n} {word}"` if n==1 else `"{n} {word}s"`.
- `join_meta(...)` = non-empty parts joined by `" · "`.

### 1.5 Live updates

Everything re-renders in place from the store (keyed reconciliation, no remount → no flicker). Stat tiles, activity rows and key/value rows are keyed by id/label and updated, not recreated.

### 1.6 Metrics history (client-side)

The chart is fed by a client-side ring buffer, not an API. Port `services/metrics.py`:

- On every new `SandboxStatus` (connection poll every 5s), record a sample `{t: now (wall seconds), cores, load1, load5, load15, mem_used, mem_total, disk_used, disk_total, gap_before}`. Invalid/negative values → skip.
- Keep at most **1500** samples and drop samples older than `3600 + 95` s.
- `gap_before` is set on the first sample after: app start, a connection going non-online, status becoming null, a sandbox switch, or a non-monotonic clock. Additionally any two samples > **95s** apart get a `null` point inserted between them (line break).
- Series points: for each sample emit `(t, value)` with a `(t, null)` before it on a gap.
- Persist per sandbox to a cache file (GTK: `$XDG_CACHE_HOME/monolith-desktop/metrics.json`, `{version: 1, sandboxes: {id: [[t,cores,l1,l5,l15,mu,mt,du,dt,gap(0|1)], ...]}}`, values rounded to 4 decimals), saving at most every **30s** and on exit; keep the **4** most recently updated sandboxes; on load drop samples outside `[now-3600, now+60]`. In Electron, store this in `app.getPath('userData')` (main process) or localStorage; format may be reused.
- Switching sandbox (different `sandboxId`) swaps to that sandbox's stored samples.

### 1.7 Reference screenshots

All captured with `tools/snapshot.sh … --zoom 1 --width 1440 --height 900` — note broadway clamps the window to **1024x768**, so the images are 1024x768, not 1440x900. Data is **live** from the user's running sandbox (`theone-sandbox`, 4 cores, heavily loaded at capture time).

- `docs/electron/reference/page-files-overview-overview.png` (dark): header "theone-sandbox" + green "Online" badge + refresh icon; meta `up 7h 46m · theone-sandbox · v0.1.0`; 4 resource tiles (CPU load 11.99 load avg 100% with **yellow** warning bar because load/core ≥ 0.85; Memory 6.3 GB 79% indigo bar; Disk 81.8 GB 82% indigo bar; Uptime 7h 46m, no bar); Resource history with "15 min" chip selected, legend with CPU 300% / Memory 79% / Disk 82% on, 5m load and 15m load dimmed (off); chart with 0–300% y axis, CPU line with soft fill, flat teal memory and coral disk lines, dashed "85% warning" threshold, latest-value dots; Activity/Display headings at the bottom (rest below the fold).
- `page-files-overview-overview-light.png`: same in light scheme (indigo CPU line `#5E6AD2`; CPU bar in light `warning` `#8F6400`, which reads brownish). A gap in the CPU line is visible near the right edge (a re-connect gap from the snapshot run).
- `page-files-overview-overview-full.png`: dark, **zoom 0.67**, to show the whole page: Activity list (Projects 4, Running processes 1, Active builds 0, Terminals 2, Claude runs 0), Display (X display `:1 · Available`, Resolution `1600×900`, VNC `Port 5901 · Available`) and the Toolchain heading. Note the chart labels do not scale with zoom (see quirks).

### 1.8 GTK quirks — do NOT copy

- Chart text uses absolute pixel sizes, so at non-1.0 zoom the chart labels stay 11/12px while the rest scales. In Electron, chart text must scale with the UI zoom (use CSS px inside an SVG/canvas sized in CSS px × devicePixelRatio).
- The threshold plate is drawn before the series, so lines run through the "85% warning" label. Draw the label plate after (on top of) the series.
- The CPU tile caption is ellipsized after ~10 chars of natural width (`4 cores · 5m 6.85 · 1…`). Let it use the full tile width and ellipsize only when it truly overflows; show the full text as a tooltip.
- Tone name `violet` for the ≥85% state is a legacy name; it maps to the warning color. Name it `warning` in React.
- The light-scheme warning foreground `#8F6400` makes the CPU bar brownish; keep it (that is the token), but don't invent a different color.
- Hidden series still get latest-value dots computed but with alpha 0; just skip hidden series.
- FlowBox column count is GTK-heuristic; use a deterministic CSS grid (4 columns, 2 below a container width of ~640px).

---

## 2. Files page

Page id `files`, sidebar section "Sandbox", order 25, icon `files` (Lucide), header-bar title **"Files"**.

### 2.1 Header-bar widgets

One IconButton `refresh-cw`, tooltip **"Refresh"** → `refresh()`: if artifacts never loaded, reset the loading state text to "Loading files…"; re-poll artifacts now; if the current view is Project builds, re-poll outputs too.

### 2.2 API

All requests to the controller with the saved bearer token (`Authorization` header) and `User-Agent: monolith-desktop/0.1` in GTK (use the Electron app's own UA).

| purpose | request | response |
|---|---|---|
| list shared files | `GET /v1/artifacts` (optional `?projectId=`) | `Artifact[]` |
| list build outputs | `GET /v1/outputs` (optional `?projectId=`) | `BuildOutput[]` |
| delete shared file | `DELETE /v1/artifacts/{id}` | `Artifact` |
| Taildrop targets | `GET /v1/taildrop/targets` | `{available, targets: [{id, hostName, dnsName, os, online}]}` |
| send via Taildrop | `POST /v1/artifacts/{id}/taildrop` body `{targetId}`, timeout **120s** | `Artifact` |
| download shared file | `GET /v1/artifacts/{id}/download` (auth header) | file bytes; may carry `Content-Length`, `X-Content-SHA256` |
| download build output | `GET /v1/projects/{projectId}/outputs/download?path={path}` | file bytes |
| one-time ticket for browser links | `POST /v1/auth/ticket` | `{ticket, expiresAt}` |
| open link (artifact) | `{baseUrl}/v1/artifacts/{id}/download?ticket={ticket}` opened in the system browser | – |
| open link (output) | `{baseUrl}/v1/projects/{projectId}/outputs/download?path={path}&ticket={ticket}` | – |

Path segments are URI-component encoded. Types:

```
Artifact { id, projectId, buildId|null, fileName, path, sizeBytes, sha256, platform, source: "build"|"agent", agentRunId|null, note|null, createdAt }
BuildOutput { projectId, path, fileName, sizeBytes, platform, modifiedAt }
```

Polling: artifacts and outputs each poll every **30s**, only while visible (immediate fetch on show, stop on hide). In GTK the outputs poller is bound to the Project builds list, so it only runs while that tab is shown (see quirks).

Live events (event socket, while page visible): `artifact.created` `{artifact}` → upsert and re-sort; `artifact.deleted` `{id}` → remove. Project list changes (store.projects) → re-render group titles / filter options.

Project names come from `store.projects` (`id → name || id`).

### 2.3 Top-level states

Crossfade (180ms) between:

- **state** — EmptyState, initially loading: spinner + title **"Loading files…"**. If the first artifacts fetch fails: title **"Couldn't load files"**, message = error description, icon `triangle-alert`, primary button **"Try again"** → refresh().
- **content** — shown as soon as the first artifacts response arrives.

Later fetch failures (after data exists) do not replace content; they show the inline error notice (2.5).

### 2.4 Content layout

Column:

1. **Toolbar** (`to-list-toolbar`): padding **8px 12px**; row gap 8. Left (flex 1, gap 8): pill tabs. Right (gap 2): filter dropdowns.
2. **Error notice** (hidden by default).
3. **Scroll area** (vertical only, fills remaining height) containing a body with padding **0 8px 16px 8px**, which holds a crossfade (180ms, non-homogeneous) between the two views: `shared` and `builds`.

#### 2.4.1 Pill tabs (aria-label "Files view")

Options: `shared` **"Shared files"** (default), `builds` **"Project builds"**. Gap 4 between tabs. Tab: height 28, padding `0 10px`, pill radius, 1px `border`, transparent, color textSecondary; content gap 6: label (label 13/500) + count (caption 12/16, textTertiary; hidden when 0/null). Hover: bg backgroundElement, color text. Selected: bg backgroundSelected, border borderStrong, color text. Counts: Shared = total artifacts (unfiltered), Builds = total outputs (unfiltered).

Navigation params: `open({view: "shared"|"builds"})` selects that tab.

#### 2.4.2 Filter dropdowns

Toolbar dropdown button: height 28, padding `0 8px 0 10px`, pill radius, 1px `border`, transparent, color textSecondary, label 13px + trailing caret (`pan-down` triangle in GTK; use Lucide `chevron-down` 16px or match the filled triangle in the screenshot). Hover: bg backgroundElement, color text. Popover list: rows height 28, padding `0 8px`, radius 4; popover padding 4, radius 8, bg surfaceElevated, 1px border, shadow `0 8px 24px rgba(0,0,0,0.4)`.

- Shared view shows: **project filter** (tooltip "Filter by project") and **source filter** (tooltip "Filter by source").
- Builds view shows: **output project filter** (tooltip "Filter by project") only.

Project options: first **"All projects"** (id `""`), then the union of projectIds present in the data and all known projects, sorted case-insensitively by display name (`name` or id). If the selected project disappears, selection falls back to the first option (All projects).

Source options: **"All sources"** (`""`), **"Build"** (`build`), **"Shared by Claude"** (`agent`).

Filter state is per view and persists while the page lives.

#### 2.4.3 Error notice

Notice, tone **danger**, margin **0 12px 8px 12px**, message = error text, no title, action **"Dismiss"** → hide. Used for: refresh failures after first load, and every action error (download/delete/send/open link). Multiple errors overwrite the text.

### 2.5 Shared files view

Rows = `filter_artifacts(artifacts, project, source)`: newest first by `createdAt` (unparsable → oldest), then project/source filters (`source` not in {build, agent} counts as `build`).

States:
- No artifacts at all → EmptyState title **"No files yet"**, message **"Build outputs and files Claude shares with theone-controller share show up here."**, icon `files`.
- Artifacts exist but none match → EmptyState title **"No files match these filters."**, no message, icon `files`.
- (Inner loading state, spinner, exists but the outer page state covers first load.)

Grouping (GroupedList): artifacts grouped by `projectId`, group order = first appearance in the sorted list (so the group with the newest file is first); row order = sorted order. Group title = project name, else the id, else **"No project"** (empty projectId). Groups separated by **8px**.

**Group band** (`to-group-header`): height **36px**, padding `0 4px 0 12px`, radius **6px**, bg **surfaceElevated** (`#1A1A1B` dark); row gap 8: 16px Lucide `box` icon textSecondary · title (label 13/500, text) · count (body 13/20, textSecondary). Rows follow the band with a 2px gap.

**Row** (RecordRow, 40px min height, padding `0 8px 0 12px`, radius 6; hover bg backgroundElement; the row itself is not clickable): horizontal gap 10:
1. File icon 16px textSecondary, by extension (lowercased text after the last dot):
   - `apk aab ipa` → `smartphone`
   - `appimage exe msi dmg deb rpm` → `app-window`
   - `zip tar gz tgz xz 7z` → `file-archive`
   - `pdf md txt` → `file-text`
   - `png jpg jpeg gif webp svg` → `image`
   - `mp3 wav ogg m4a` → `audio-waveform`
   - `html js ts json css py` → `file-code`
   - else → `file`
2. Body (flex 1, gap 10, single line): title = fileName (label 13/500, text; when a subtitle exists the title takes natural width up to 56ch then ellipsizes; tooltip if > 48 chars) + subtitle = trimmed `note` (body 13/20, textTertiary, ellipsized, fills the rest; tooltip if > 48 chars). No subtitle if note is empty.
3. Progress bar (only while downloading): width **80px**, height 4, tone info (`#4EA7FC` dark / `#1F6FCB` light), 20% alpha track. Indeterminate (no Content-Length yet / before first progress): a shimmering gradient band 40% wide sweeping left → right, 1440ms linear infinite.
4. Meta (caption 12/16, textTertiary, right aligned, max 48ch, tooltip if > 48): `join_meta(format_bytes(sizeBytes), platform || "—", relative(createdAt))`, e.g. `10.4 KB · file · 47m ago`.
5. Source badge: StatusBadge shown only for non-neutral tone — i.e. only `agent` → **"Shared by Claude"**, tone info (blue dot). `build` shows no badge.
6. Hover actions (see 2.7).

### 2.6 Project builds view

Rows = `filter_outputs(outputs, project)`: newest first by `modifiedAt`, then project filter. Key = `"{projectId}/{path}"`.

States:
- Before first response: EmptyState loading **"Looking for builds…"** (spinner).
- First fetch fails: EmptyState title **"Couldn't look for builds"**, message = error description, icon `hammer`. Later failures → error notice.
- No outputs → title **"No builds found"**, message **"APKs, AABs, installers and AppImages in your projects' build, dist, release and out folders show up here."**, icon `hammer`.
- Outputs exist but none match → title **"No builds match this project."**, no message.

Grouping identical to 2.5 (band icon `box`).

Row differences vs shared files:
- Subtitle = folder: `path` minus `"/" + fileName` at the end, or `"."` if empty — rendered in **code** variant (Geist Mono 12/18, textTertiary). E.g. `apps/mobile/android/app/build/outputs/apk/release`.
- Meta = `join_meta(format_bytes(sizeBytes), platform unless empty or "file", relative(modifiedAt))`, e.g. `98.3 MB · android · 1d ago`, `13.3 MB · 1d ago`.
- No badge. Actions: Save…, Open download link only.

### 2.7 Row actions

Actions are icon-only and appear **only while the row is hovered or keyboard-focused**, floating over the right edge of the row (overlay, vertically centred): container margin-right 4, padding `0 4px 0 8px`, radius 6, bg backgroundElement (covers the meta/badge underneath), gap 2. Each button 24x24, radius 6, color textSecondary, hover color text; destructive button hover color danger. Tooltips = labels. Fade them in/out (120ms opacity) in Electron.

Shared file actions (in order):
1. `download` icon, **"Save…"** — disabled while that file is downloading.
2. `external-link` icon, **"Open download link"**.
3. `arrow-up` icon, **"Send to device"** — only when Taildrop is available (`targets.available == true`).
4. `trash-2` icon, **"Delete"** (destructive).

Build output actions: **"Save…"**, **"Open download link"**.

#### Save… (download)

1. Native save dialog, title **"Save file"**, default name = sanitized fileName (take the part after the last `/` or `\`, replace runs of control chars `\x00-\x1f` with `_`, trim, strip leading dots; fallback **"artifact"**). Cancel → nothing.
2. Mark downloading (row shows indeterminate bar, Save disabled), toast **"Downloading {fileName}"**.
3. Stream the authenticated download (GTK chunk 256 KiB) into `{dest}.part`, hashing SHA-256. Progress fraction reported when `Content-Length` known, throttled to steps of ≥ **0.02** (and on completion).
4. Verify checksum: expected = `artifact.sha256` (shared files) or the `X-Content-SHA256` response header; build outputs only use the header. Comparison case-insensitive, trimmed; skipped if no expectation. Mismatch → delete `.part`, error **"The downloaded file does not match the artifact checksum, so it was discarded."**
5. Success → rename `.part` to destination, toast **"Saved {basename}"**. Failure → delete `.part` (on network/timeout/IO errors), error notice **"Download failed: {error}"**, where error is `"{fileName} is no longer available in the sandbox."` on HTTP 404 for shared files, `"{fileName} is no longer in the project. Rebuild it or refresh the list."` on 404 for build outputs, else the described error.
6. Always clear downloading state at the end.

In Electron run this in the main process (or a utility process) with `dialog.showSaveDialog` and stream to disk; report progress over IPC.

#### Open download link

Mint a ticket (`POST /v1/auth/ticket`), build the ticketed URL (table above), open with `shell.openExternal`. Errors → notice (outputs: 404 → the "no longer in the project" message).

#### Delete

Confirm dialog: heading **"Delete {fileName}?"**, body **"The file is removed from the sandbox. This can't be undone."**, buttons **"Cancel"** / **"Delete"** (destructive, red). On confirm `DELETE /v1/artifacts/{id}`. Success → remove the row, toast **"Deleted {fileName}"**. 404 → just remove the row silently. Other errors → notice **"Couldn't delete {fileName}: {error}"**.

#### Send to device (Taildrop)

Taildrop targets are fetched once when the list first mounts (and again when the user hits "no targets"); the Send action appears only if `available`.
- If no **online** targets: notice **"No Taildrop devices are online."** and refetch targets.
- Otherwise a choose dialog: heading **"Send {fileName}"**, body **"Taildrop sends the file to a device on your tailnet."**, a full-width (non-flat, bordered) dropdown of online targets sorted by hostName (case-insensitive), labels `join_meta(hostName || id, os)` (e.g. `pixel-8 · android`), buttons **"Cancel"** / **"Send"** (non-destructive; disabled if no options).
- On Send: toast **"Sending {fileName} to {device}"**, `POST …/taildrop`. Success toast **"Sent {fileName} to {device}"**; failure notice **"Couldn't send {fileName}: {error}"** (404 → "{fileName} is no longer available in the sandbox.").

#### Deep link from Inbox

`navigate("files", {artifactId, projectId})` (from the Agents/Inbox "file" items) immediately starts **Save…** for that artifact: looks it up in the loaded list; if not loaded, fetches `GET /v1/artifacts?projectId=…` and searches; not found → notice **"That file is no longer available in the sandbox."**

### 2.8 Reference screenshots

Captured at 1024x768 (broadway clamp), live data from the user's sandbox.

- `docs/electron/reference/page-files-overview-files-shared.png` (dark): header bar "Files" with refresh button; toolbar with "Shared files 2" (selected) / "Project builds" tabs on the left and "All projects ▾" / "All sources ▾" dropdowns on the right; two group bands (`hybrid-pos 1`, `best-html 1`) with `#1A1A1B` background; rows `SHIFT_MANAGER_SESSION_REPORT_PRINT.md` (note truncated to "Shift …", meta `10.4 KB · file · 47m ago`) and `index.html` (note "Basic HTML site (best-html): index page, open …", `3.5 KB · file · 6d ago`), both with the blue-dot "Shared by Claude" badge. No hover state captured.
- `page-files-overview-files-shared-light.png`: same, light scheme. Note the group bands are invisible because surfaceElevated = surface = `#FFFFFF` in light.
- `page-files-overview-files-builds.png` (dark): "Project builds 3" selected, only "All projects ▾"; groups `monolith 2` (app-release.apk with smartphone icon, folder in mono `apps/mobile/android/app/build/outputs/apk/release`, `98.3 MB · android · 1d ago`; native-debug-symbols.zip with archive icon, `13.3 MB · 1d ago`) and `hybrid-pos 1` (`KenzErp POS Setup 1.1.111.exe`, app-window icon, `release/build`, `93.9 MB · windows · 1d ago`).

Not captured (needs state the snapshot tool can't produce without mutating the sandbox): loading, error, empty, hover actions, download progress, dialogs. Build them from this spec.

### 2.9 GTK quirks — do NOT copy

- In light scheme the group band background equals the page surface (`#FFFFFF`), so bands disappear. Use backgroundElement-ish `#F5F5F6`/`#EEEEF0`-level contrast in light, or confirm with the design owner; dark `#1A1A1B` is correct.
- The empty-state copy "…files Claude shares with theone-controller share show up here." contains a doubled "share" — this is a copy bug. Quote it verbatim for parity tests only if required; preferred fix: "Build outputs and files Claude shares show up here." (flag to the product owner).
- Hover actions are toggled with `visible` (no fade) — add the 120ms fade.
- Row progress fraction updates repaint immediately; in Electron animate the bar width (120ms ease-out) and throttle IPC to the same 2% steps.
- Errors from the background refresh and from actions share one notice and overwrite each other; acceptable, but keep exactly one notice.
- The outputs poller only runs while the Builds list is mapped, so the "Project builds" tab shows no count until the user opens that tab once (visible in the shared-files screenshot: "Project builds" has no count). In Electron fetch outputs on page show so both counts are there immediately.
- `Gtk.FileDialog` is used for the save path; use Electron `dialog.showSaveDialog` with the sanitized default name, never a renderer `<a download>`.

---

## 3. Micro-animations (Electron additions, consistent with Linear)

- Page state crossfades (loading ↔ content ↔ empty, shared ↔ builds): 180ms opacity, ease-out.
- Pill tab / chip / legend toggle selection: background + border-color 120–150ms.
- List rows entering: fade + 4px rise, 160ms ease-out, staggered 15ms, capped at first 20 rows; exiting rows (delete) collapse height + fade 160ms.
- Stat tile values: progress bar width animates 220ms ease-out on change; numbers change without tweening (tabular nums prevent jitter).
- Chart: 350ms ease-out cubic for ceiling/range/visibility tweens (as in GTK).
- Hover actions: 120ms opacity.
- Live dot pulse on badges (2880ms) only where `live` is set (not on this page's header badge).
- All of the above disabled under `prefers-reduced-motion: reduce` (instant changes; the indeterminate progress shimmer becomes a static 40% band).

## 4. Constants / labels modules (per CODING.md)

Put all user-facing strings from this spec in `labels.ts` modules next to each page (`overview/labels.ts`, `files/labels.ts`), numeric constants (`LOAD_WARNING = 0.85`, `HISTORY_RANGE_S = {5m: 300, 15m: 900, 1h: 3600}`, `DEFAULT_RANGE = "15m"`, `CHART_HEIGHT = 200`, `REFRESH_INTERVAL_MS = 30000`, `PROGRESS_STEP = 0.02`, `ROW_HEIGHT = 40`, `GROUP_HEIGHT = 36`, `PROGRESS_WIDTH = 80`, chart layout constants from 1.3.4, metrics constants from 1.6) in `constants.ts`, and the pure model functions (`resourceItems`, `countItems`, `displayRows`, `toolRows`, `emptyModel`, `attentionNotice`, `seriesSummaries`, `filterArtifacts`, `filterOutputs`, `byProject`, `fileIcon`, `artifactMeta`, `outputMeta`, `outputFolder`, `safeFileName`, `projectOptions`, `onlineTargets`, `targetLabel`) in `model.ts` with unit tests mirroring `apps/desktop/tests`.
