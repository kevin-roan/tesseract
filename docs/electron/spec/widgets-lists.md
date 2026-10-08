# Spec: list, row, section, control, progress and chart widgets

Source of truth: `apps/desktop/tesseract_desktop/widgets/{list_view,rows,record_row,keyed_list,section,page_body,preference_rows,radio_rows,segmented,choice_dropdown,action_menu,progress,stat_card,sparkline,dot_sphere,avatar,qr,charts/*}.py`, plus the CSS that styles them: `theme/css.py` (`_adwaita`, `_components`), `theme/extras/{projects,overview,chart,dialogs,motion,agents}.py`.

All numbers here were read from the code. Where noted as **measured**, they come from rendering the real GTK widgets headless (broadway, Cairo renderer, dark scheme, 1x) and reading their allocations. Reference crops:

- `docs/electron/reference/widgets-lists-toolbar-groups-rows.png`: ListToolbar, PillTabs (with count), ToolbarToggle (off/on), toolbar ChoiceDropdown, ListGroup with RecordRows (code, status badge, progress, labeled action), an empty ListGroup.
- `docs/electron/reference/widgets-lists-chips-section-stats.png`: PropertyChip, SegmentedControl, ProgressBar, ProgressRing, Avatar, DotSphere, Section with subtitle and link action, KeyValueList, StatGrid (neutral and warning tile), SeriesLegend, ListCard.
- `docs/electron/reference/widgets-lists-segmented-loading-chart.png`: SegmentedControl alone, ListGroup loading, Section loading, the Resource history card (legend and TimeSeriesChart with threshold and hover tooltip).
- `docs/electron/reference/widgets-lists-preference-rows.png`: settings-page group with entry_row, destructive button_row, property row, RadioRows, SettingsActions.

GTK `min-height` does not include the border. GTK heights below are the CSS `min-height`, and "box" gives the rendered outer size, border included. In React, use `box-sizing: border-box` with the **box** value.

---

## 0. Tokens used by these widgets

The default rendered scheme is **graphite** (dark). Light mode renders **graphiteLight**. Both must exist as CSS variables.

| token | graphite | graphiteLight |
|---|---|---|
| background (window, `surfaceSunken`, `codeBackground`) | `#09090A` | `#F5F5F6` |
| surface (inset panels, boxed lists) | `#121213` | `#FFFFFF` |
| surfaceElevated (group bands, popovers, tooltips, entries) | `#1A1A1B` | `#FFFFFF` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected (checked/selected/pressed) | `#232325` | `#E7E7EA` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| accent / focusRing | `#5E6AD2` | `#5E6AD2` |
| accentPressed | `#4F5BC4` | `#4F5BC4` |
| accentStrong | `#9EA6F0` | `#4F5BC4` |
| textOnAccent | `#ffffff` | `#ffffff` |
| info / success / warning / danger (tone fg) | `#4EA7FC` / `#4CB782` / `#F2C94C` / `#EB5757` | `#1F6FCB` / `#2E8A5B` / `#8F6400` / `#C93A3A` |
| warningSolid / dangerSolid | `#F2C94C` / `#EB5757` | `#E2B22E` / `#EB5757` |

Tone to foreground color: `neutral` maps to textSecondary (solid textTertiary), and `info|success|warning|danger` map to the colors above.

Spacing: xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40.
Radius: xs 4, sm 6, md 8, lg 10, xl 12, card 10, pill/full 999.
Control heights: xs 24, sm 28, md 32, lg 36, xl 44.
Icon sizes xs/sm/md are all **16px**. lg is 24.
Shadows: level2 `0 4px 12px rgba(0,0,0,0.3)`, level3 `0 8px 24px rgba(0,0,0,0.4)`.

Typography (font size / line-height / weight). Sans is `Inter`, display is `Inter Display`, mono is `Geist Mono`:

| variant | size/lh | weight | family | extra |
|---|---|---|---|---|
| body | 13/20 | 400 | sans | |
| bodyStrong | 13/20 | 500 | sans | |
| bodySmall | 12/18 | 400 | sans | |
| label | 13/18 | 500 | sans | |
| caption | 12/16 | 400 | sans | |
| code | 12/18 | 400 | mono | |
| metricSmall | 20/24 | 600 | display | letter-spacing -0.2px, `font-feature-settings:"tnum"` |

Motion, global (`theme/extras/motion.py`):
- Interactive elements transition `background, color, border-color, box-shadow, opacity, filter, outline-*, transform` over **120ms** with `cubic-bezier(0.2,0,0,1)`. Interactive elements are buttons, menu items, activatable rows, `list.to-record-list > row`, entries, cards and surfaces.
- `button:active` uses `transform: scale(0.95)`. Pressable cards (StatCard or ListCard with `onActivate`) use `scale(0.98)`.
- Crossfade stacks (loading / empty / content swaps) run for **180ms**.
- Live dot pulse: opacity 1, then 0.35, then 1 over **2880ms**, `cubic-bezier(0.2,0,0,1)`, infinite.
- Shimmer for an indeterminate bar: **1440ms** linear, infinite.
- When `prefers-reduced-motion` is set, all of the above become instant or static. GTK uses `gtk-enable-animations`, and DotSphere checks it.

Focus: `outline: 1px solid focusRing; outline-offset: 1px` on `:focus-visible` buttons and entries. Record-list rows use `outline-offset: -2px` so the ring sits inside the row.

Tooltips: padding 4px 8px, radius 6, surfaceElevated background, 1px border, text color, 12px, shadow level2.

Native labels ellipsize with `…` at the end. Use `min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.

---

## 1. ListToolbar (`list_view.ListToolbar`)

**Anatomy**
`[start: hexpand row, gap 8] [end: row, gap 2]`, with an outer gap of 8 between the two rows.

**Metrics**
- Padding is `8px 12px`.
- Measured box height is 46 (30px controls plus 2×8).
- The start box usually holds PillTabs.
- `add_end(widget)` adds the class `to-toolbar-button`, so every end widget gets the toolbar-button look.

**Toolbar button** (end widgets, ToolbarToggle):
- 28 + 1px border, so the box is **30×30**. Padding 0, `border-radius: 999px`, `1px solid border`.
- Color textSecondary. Hover changes color to text and background to backgroundElement (flat hover). Checked (toggle on) uses backgroundSelected and text color.
- Icon 16px.

**ChoiceDropdown inside the toolbar** (`.to-list-toolbar dropdown > button`):
- Box height **30**. Padding `0 8px 0 10px`, pill radius, 1px border, transparent background, textSecondary.
- Hover uses backgroundElement and text color.
- The dropdown arrow is 16px wide and sits after the label (measured gap 0 inside an 86px content box for "All projects").

**ToolbarToggle(icon, label, active, on_toggled)**
- A flat icon toggle with tooltip and aria-label set to `label`.
- Used in Projects: `filter` ("Search projects") and `display-options` (Lucide `sliders-horizontal`, "Group by status").

**Used in:** the Projects list page (tabs "All projects" / "Active" / "Idle", plus the two toggles). The Files page uses tabs "Shared files" / "Project builds" plus ChoiceDropdown filters ("All projects", "Filter by project", "Filter by source").

## 2. PillTabs (`list_view.PillTabs`)

A single-select radio group of pill toggle buttons. `role="tablist"` is a reasonable mapping, with aria-label set to `label`.

**Anatomy:** each tab has its content in a row with gap 6, holding `[title (label variant, inherits button color)] [count (caption, textTertiary, hidden when 0/None)]`. The outer gap between tabs is **4**.

**Metrics (measured):** height **30** (28 + 1px border top and bottom), padding `0 10px`, `border-radius: 999px`, `1px solid border`.
- Measured widths: "All projects" is 92, "Active 3" is 76, "Idle" is 45.

**States**
| state | background | border | text |
|---|---|---|---|
| rest | transparent | border | textSecondary |
| hover | backgroundElement | border | text |
| checked | backgroundSelected | borderStrong | text |
| active | (any) scale 0.95 | | |

**Behavior**
- `on_change(id)` fires only when the selection changes to a different id.
- `select(id)` sets the selection programmatically.
- `set_count(id, n)` shows `n` only when it is truthy, so a count of 0 is hidden.

**Used in:**
- Projects list toolbar.
- Files page toolbar.
- Project detail section tabs (aria-label "Project sections").

## 3. GroupHeader and ListGroup (`list_view.GroupHeader`, `ListGroup`)

Linear's group band sits above flat rows.

**GroupHeader anatomy** (row, gap **8**):
`[icon 16px textSecondary, optional] [title: label 13/18/500 text] [count: body 13/20 textSecondary, hidden when None] [subtitle: caption 12/16 textTertiary, hexpand, hidden when empty] [spacer (hidden when subtitle shown)] [trailing: row gap 4]`.

**GroupHeader metrics**
- `min-height: 36px`, padding `0 4px 0 12px`, radius **6**, background **surfaceElevated** (`#1A1A1B`).
- Measured positions: icon at x+12, title at x+36.
- A count of 0 *is* shown as "0". Only `None` hides it, which differs from PillTabs.

**Trailing action** (when `action_label` and `on_action` are given): an IconButton with icon `add` (Lucide `plus`) by default, tooltip/aria set to `action_label`.
- Class `to-group-action`: **24×24**, padding 0, radius 6, color textSecondary.
- Hover uses text color and backgroundElement.
- Measured position is 4px from the right edge, vertically centered.

**ListGroup anatomy:** a column with gap **2**: `[GroupHeader] [crossfade stack 180ms: loading | empty | content]`.
- **Loading** row: min-height **40**, padding `0 12px`, holding a 16px spinner at the start.
- **Empty** row: the same 40px min-height and `0 12px` padding. The text is body 13/20 textTertiary, wraps, and is vertically centered.
- **Content:** the child, normally a KeyedList of RecordRows.
- `set_loading(false)` only leaves the loading state, then goes to content. `set_empty(true)` shows empty. Default is content.

**Props:** `title, child?, actionLabel?, onAction?, emptyLabel?, subtitle?, icon?, iconColor?, actionIcon='add'`. Methods include `setCount`, `setLoading`, `setEmpty(empty, label?)` and `header.setTitle/setIcon/setSubtitle/addTrailing`.

**Used in:** the project detail tabs. Verbatim titles and empties:
- Git: "Working tree" / "Nothing to commit, working tree clean." (icon `branch`), and "Recent commits" / "No commits yet." (icon `commit`).
- Processes: "Listening ports" with subtitle "Servers started from this project" (icon `ports` = `globe`), "Processes" / "Nothing has run in this project yet.", and "Scripts" with subtitle "Package scripts run with {pm}" (icon `terminal`).
- Builds: "Build targets" with subtitle "Detected from the project's package.json and native folders" / "No build targets detected for this project.", and "Builds" / "No builds yet." (icon `sessions` = `history`).
- Chats: "Chats" with action "New chat" / "No chats about this project yet." (icon `agents`, list is `divided`).
- Sync: "Sandbox changes" / "Nothing to sync. The host folder matches the sandbox.", and so on.

## 4. GroupedList (`list_view.GroupedList`)

- A column of ListGroups with gap **8**.
- `sync([(groupKey, title, [(rowKey, data)])])` takes groups in display order. It creates a group per key with KeyedList rows and the shared `icon`, and sets the header title and the count to `len(items)`. Stale groups are dropped, and groups are reordered to match.
- `divided` adds hairline separators between rows (see §6).

**Used in:** Files ("Shared files" grouped by project with icon `project` = `box`, or by `artifacts` = `package`) and Project builds outputs.

## 5. RecordRow (`record_row.RecordRow`) inside HoverRow

This is a single-line Linear list row.

**Anatomy** (row, gap **10**):
`[icon 16px] [code] [body: row gap 10, hexpand → title, subtitle] [progress bar 80×4] [meta] [status badge] [inline actions: row gap 2]`.
Hover actions float over the right edge, outside this row (see HoverRow below).

**Metrics**
- `min-height: 40px`, padding `0 8px 0 12px`, with every child vertically centered.
- Measured positions: icon at x+12, code at x+38, and title at x+66 with code or x+38 without it.

**Parts**
- **Icon:** 16px, default color textSecondary, hidden when `icon` is null. `setIcon(name, color)`.
- **Code** (optional short id or number):
  - Geist Mono 12/18, weight **600**, `min-width:18px`, centered, colored by tone fg (`neutral` gives textSecondary).
  - Hidden when empty.
- **Title:** `label` (13/18/500, text), or `code` (mono 12/18) when `monospaceTitle`.
  - Without a subtitle, the title takes all space and ellipsizes.
  - With a subtitle, the title sizes to content up to about **56 characters**, and the subtitle (hexpand) takes the rest and ellipsizes first.
  - A tooltip with the full text appears when it is longer than 48 characters.
- **Subtitle:** `body` 13/20 textTertiary, or mono `code` when `monospaceSubtitle`. Tooltip when longer than 48 characters.
- **Progress:** ProgressBar (§16) at width **80**, height 4, tone info. Hidden unless `setProgress(p)` is called with p not None. `p=None, visible=true` gives the indeterminate shimmer.
- **Meta:** caption 12/16 textTertiary, right-aligned, max about 48 characters, tooltip when longer than 48.
- **Status**, two modes:
  - `setStatus(label, tone)` shows a **StatusBadge** pill:
    - `min-height:20px`, so the box is 22.
    - Padding `0 8px 0 7px`, radius 999, `1px solid border`, transparent background.
    - Contents: gap 4, a 6×6 tone-colored dot, and a caption 12/16 label in **textSecondary**. The label does not take the tone color.
    - The dot pulses (2880ms) when the badge is `live`. RecordRow never sets live.
  - `setStatus(label, tone, glyph=true)` hides the badge and replaces the leading icon with Linear's status circle, with the label as tooltip:
    - neutral: `circle`, textTertiary
    - info: `circle-dot`, info
    - success: `circle-check`, success
    - warning: `circle-dot`, warning
    - danger: `circle-x`, danger
- **Actions** (`RowAction {id, icon, label, onActivate, sensitive=true, destructive=false, active=false, labeled=false}`):
  - If **any** action is `labeled`, all actions render inline and are always visible. Labeled ones are secondary ActionButtons (icon + label).
  - Otherwise all actions are icon buttons inside the **hover overlay**.
  - Icon action: class `to-row-action`, **24×24**, radius 6, textSecondary, 16px icon, tooltip and aria set to the label. Hover uses text color and backgroundElement.
  - `destructive`: hover color danger.
  - `active`: background backgroundSelected, color text.
  - `sensitive=false`: disabled (GTK dims to about 50%).
  - Labeled action: pill (radius 999), 24px min-height so the box is 26, padding `0 8px`, font 12px, background surfaceElevated, 1px border, icon 16 plus label with gap 6. Measured "▷ Run" is about 65px wide.

**HoverRow overlay** (`.to-hover-actions`):
- Absolutely positioned at the right edge, vertically centered, `margin-right:4px`, padding `0 4px 0 8px`, gap 2, radius 6.
- Background **backgroundElement**, which matches the row-hover background, so it masks the meta and status text beneath.
- Visible only while the row is hovered or contains focus (`:hover, :focus-within`).
- GTK toggles visibility instantly. A 120ms opacity fade is an acceptable micro-animation.

**Rows container (KeyedList, §6)**
- Row radius 6, no background, hover background backgroundElement (120ms).
- Clicking, Enter or Space calls `onActivate` only if one is set. Otherwise the row is not activatable and has no pointer cursor.

**Used in:**
- Project tabs: processes, builds, git, sync, chats.
- Files list and outputs (icon `file`). Action strings live in the pages' labels, for example `copy`, `browser`, `play` (labeled "Run"/"Build"), `stop`, `save`, `external`, `send`, `delete`, and `fix-ai` (`sparkles`).
- Display windows: "close" and "force", the latter destructive with the `failed` icon.

## 6. KeyedList (`keyed_list.KeyedList`)

- A non-selectable list (`list.to-record-list`) with no background, border or padding.
- `sync([(key, data)])` keeps one row per key: it creates rows with `create()`, calls `update(widget, data)` on every row, removes stale keys and reorders to match.
- The list hides itself when empty, because the ListGroup shows the empty placeholder instead.
- **divided** variant: rows get radius 0 and `border-bottom: 1px solid divider`. The last row has no border.
- React: render `items.map(([key,d]) => <Row key={key} …/>)`. Item enter and exit can use a 120–180ms height/opacity motion. GTK has none, so keep it subtle.

## 7. PropertyChip (`list_view.PropertyChip`)

A Linear property pill: icon plus label, read-only.

**Metrics:**
- `min-height:24px`, so the measured box is **26**.
- Padding `0 10px`, radius 999, `1px solid border`, transparent background.
- Gap **6** between icon and label. The icon is 16px textSecondary (the docstring says 14, but the CSS renders 16). The label is caption 12/16 textSecondary.

**Behavior:**
- `maxChars` truncates with ellipsis and shows the full text as a tooltip.
- `update(label, icon?, color?)` hides the chip when the label is empty.

**Used in:** the project detail property strip:
- `status-todo` for activity
- `project` for framework
- `branch` (with a max-chars limit)
- `sync`
- `status-progress` for dirty
- `confidential` = Lucide `lock`, icon colored **warning**
- `agents` for the Claude account

Also used in form and dialog headers.

## 8. Section and SectionHeader (`section.py`)

**Section:** a column with gap **8**: `[SectionHeader] [crossfade stack 180ms: loading | empty | content]`.

**SectionHeader** (row gap 8, `min-height:28px`):
- `[titles: column gap 2, hexpand → title (label 13/18/500 text, margin-bottom 2px), subtitle (caption 12/16 **textSecondary**, hidden when empty)] [trailing: row gap 8, vcenter]`.
- Measured: 28 tall without a subtitle, **38** with one (18+2+16+2).
- Inside the Overview (`.to-overview`) the title is 13px/500 with `margin-bottom:0`.

**Action** (`action_label` + `on_action`):
- Flat link button `to-link-button`: height 28, padding `0 8px`, radius 6, color textSecondary.
- Hover uses text color and backgroundElement.
- Example: "View all", measured 65px wide.

**States:**
- **Loading:** a 16px spinner aligned to the start, so the stack is 16px tall.
- **Empty:** bodySmall 12/18 textSecondary, wrapping, no padding. This differs from the ListGroup placeholder, which is 40px with 12px padding and body textTertiary.

**Used in:** Overview sections:
- "Resources" (StatGrid)
- "Resource history" with subtitle "Share of capacity over time · CPU is load average per core" and trailing range ChipGroup "5 min" / "15 min" / "1 h", column spacing 6 plus Adwaita's 3px `flowboxchild` padding: 12px between chips and a 3px inset (CSS `gap: 12px; padding: 3px`). Other ChipGroups use spacing 8, so `gap: 14px; padding: 3px`
- "Activity", "Display"
- "Toolchain", with empty text "The controller reported no tools."

Also used in the sidebar.

## 9. PageBody (`page_body.PageBody`)

- A vertical-only scroll container (`overflow-x:hidden; overflow-y:auto`) with a column inside (`.to-page`).
- Padding is **24px 32px 40px 32px** (top, right, bottom, left).
- Gap defaults to **32** (`SECTION_GAP`). Overview uses **24**, and project detail uses **0**.
- Optional `maxWidth`: the column is centered with `max-width: maxWidth` and shrinks below that (Adw.Clamp with tightening threshold equal to the max, so it is a hard max-width).
- Scrollbars: overlay slider 6px, `rgba(255,255,255,0.12)`, hover 0.22. Light scheme uses black at the same alphas.

## 10. KeyValueRow and KeyValueList (`rows.py`)

**KeyValueRow** (row gap **12**, padding `4px 0`, measured height 26):
- `[label: bodySmall 12/18 textSecondary, top-aligned] [value: bodySmall 12/18, or code mono 12/18 when monospace; color text or tone fg; right-aligned, hexpand; wraps up to 2 lines then ellipsizes; text-selectable]`.

**KeyValueList:**
- A column of rows keyed by label.
- `setRows([(label, value)])` updates values in place, drops stale labels and appends new ones. Order is not re-sorted after creation (a GTK quirk). In React just render in the given order.

**Flat-list variant** (`.to-flat-list`, Overview "Display"/"Toolchain" FlatList):
- The list has `border-top:1px divider`.
- Each row has padding `9px 2px` and `border-bottom:1px divider`.

**Used in:** Overview FlatList (Display: "X display", "Resolution", "VNC" → "Port {port} · {state}", "Available"/"Unavailable", "—", "not installed"), Toolchain (monospace), and the project Sync summary.

## 11. ListCard (`rows.ListCard`), currently unused by pages

- A Surface card (compact): padding 12, radius 8, background `#121213` (graphite neutral surface; light `#FFFFFF`), `1px solid border`. Contents are a row with gap 12.
- `[IconBadge large: 36 + border = 38, radius 8, backgroundElement, 1px border, 16px textSecondary icon] [body: column gap 2 → title bodyStrong 13/20/500, subtitle caption textTertiary] [value column gap 2, right-aligned → value bodyStrong, valueLabel caption textTertiary] [accessory]`.
- With `onActivate` it becomes a pressable: hover backgroundElement, active backgroundSelected and scale 0.98.
- GTK quirk, do not copy: the badge's icon is `hexpand`, which makes the badge share free width, so the body text is pushed to the middle (see the reference crop). In React the body should start right after the badge.

## 12. Preference rows (`preference_rows.py`, `radio_rows.py`)

These live in settings pages (`.to-settings-page`). The metrics below apply in that context.

**Group:**
- Heading 13px/500 text, then description 12px textSecondary, then a gap of 8, then the boxed list.
- Boxed list: background **surface**, `1px solid border`, radius **8**. Rows are separated by `1px solid divider`, with none after the last row.
- Between groups on the page the gap is 24. The page margin is `20px 24px 32px 24px`.

**Row (Adw.ActionRow):**
- The header is inset `0 14px`, with `min-height: 44px` and title block margin `8px 0`.
- Title 13px text, subtitle 12px textSecondary, gap 2.
- Measured: 44px tall for title only, about 49px for title plus subtitle.
- Suffix widgets are vertically centered at the right.

**PreferenceRows** (read-only property rows, class `property`):
- Inverted typography: title **12px textSecondary**, subtitle **13px text**. The subtitle (value) is selectable when `selectable`.
- Kept in sync by index.
- Can live inside an expander row: nested rows have no background and `min-height:36px`, and the arrow is textSecondary.

**entry_row(title, subtitle?, password?, onActivate?):**
- Suffix input: `min-width:320px`, so the box is **322×34** (32 + border), radius 6, background surfaceElevated, `1px border`.
- Focus: border accent plus `outline 1px focusRing, offset 1px`.
- `password` adds a show/hide (peek) icon.
- Enter calls `onActivate` (Save).
- Placeholder color textTertiary.

**button_row(title, subtitle, label, onActivate, variant='secondary'):**
- Suffix ActionButton: pill, `min-height:28px` (box 30), padding `0 14px`, label 13/18/500.
- **secondary**: surfaceElevated with a 1px border.
- **destructive**: renders exactly like secondary at rest. On hover/active it turns `dangerSolid` with white text, because the secondary rest rule overrides the red background only when not hovered. Keep this: Linear-style danger shows only on hover.

**SettingsActions:**
- A right-aligned row with gap 8, below a group.
- Buttons: secondary box 30 tall; primary (accent `#5E6AD2`, white, pill, padding `0 14px`) box 28 tall with no border.
- Quirk: the 2px height mismatch between primary and secondary is a GTK artifact. Give primary a transparent 1px border so both are 30.

**RadioRows (single choice):**
- Each row is an activatable ActionRow with a radio prefix. Clicking anywhere on the row selects it.
- Rows are disabled when `!available || busy`. Selection changes made while syncing do not call `onSelect`.
- Checked: accent fill.
- GTK quirk, do not copy: GTK renders the radio as an **18px square** (the global `check, radio` override drops the circle radius) with **no gap** before the title. Use a 16px circle: `1px solid borderStrong`, transparent; checked is an accent fill with a 6px white center dot. Put 12px between the radio and the title.
- Used in Appearance (theme choice) and Claude (default account).

**Strings:**
- Connection: "Forget" button row, with destructive variant.
- Host shell: rotate token, pair.
- STT: Gemini key password row.
Exact strings are in `preferences/*` (`S[...]`) and belong to the settings spec.

## 13. SegmentedControl (`segmented.py`)

**Anatomy:** a pill track with padding **2**, `1px solid border`, radius 999, and segment gap **2**.
- Track background is **background** (`#09090A`). Inside dialogs (`.to-dialog`) it is **surface** (`#121213`).

**Segment** (`to-segment`): `min-height 24` (measured 24), padding `0 12px`, radius 999, no border, transparent, 12px/500, textSecondary.
- Hover: text color.
- Checked: backgroundSelected and text color.
- Measured track 141×30 for "Phone"/"Desktop" (segments 61 and 72 wide).

**Behavior:**
- `onChange(id)` fires only on a change.
- `select(id)` sets the selection programmatically.
- Micro-animation (new): slide the selected pill between segments (`layoutId`, 180ms ease-out). GTK just swaps the background.

**Used in:** the Pair dialog, centered, with segments "Sandbox" / "This computer" and aria-label "Pair a device".

## 14. ChoiceDropdown (`choice_dropdown.py`)

A select built on `(id, label)[]` options.

**Trigger:**
- `min-height 28px`, so the box is 30 with a 1px border. Padding `0 8px`, radius 6.
- Background surfaceElevated, `1px border`.
- Label 13px, followed by a 16px down-arrow.
- The flat class does not remove the border or background, because the app stylesheet outranks Adwaita's flat rule. The toolbar context overrides this (§1).
- The project picker in agents also overrides it (no arrow; owned by the agents spec).

**Popover:**
- Contents padding 4, radius 8, background surfaceElevated, `1px border`, shadow level3.
- Rows `min-height 28`, padding `0 8px`, radius 4. Hover/selected background is backgroundSelected.
- The selected row shows a check mark.

**Behavior:**
- `setOptions(options, selected?)` keeps the current selection if it still exists, otherwise selects the first.
- Programmatic changes never call `onChange`. User picks call `onChange(id)`.
- Tooltip from `tooltip`.
- Micro-animation: popover fades and scales from 0.98 over 120ms ease-out.

**Used in:**
- Files filters ("All projects" / project names, "Filter by project"; sources, "Filter by source").
- Project detail Claude account picker.
- New agent project picker.
- Confirm dialog picker.

## 15. ActionMenu and attach_context_menu (`action_menu.py`)

**ActionMenu:**
- A popover menu with no arrow, anchored at a 1×1 rect at the pointer position and opening downward to the right (halign start).
- `setEntries([[label, cb], …][])` takes sections. Empty sections are skipped, and sections are separated by a divider line (`margin 4px 0`, divider color).
- It returns false when there are no entries, and the caller then does not open the menu.
- Items: height 28, padding `0 8px`, radius 4, 13px text. Hover background backgroundSelected.
- Popover chrome is the same as ChoiceDropdown.

**attach_context_menu(widget, onRequest(x, y)):**
- Opens on secondary click (`contextmenu`, preventDefault), on touch long-press, and on **Shift+F10** or the **Menu** key.
- For keyboard triggers it opens at the widget center.

**Used in:** the agents sidebar (row menu and bulk "more" menu) and the agent conversation menu.

## 16. ProgressBar and ProgressRing (`progress.py`)

**ProgressBar(progress | null, tone='info', label):**
- Height **4**, full width by default, radius 2 (height/2).
- Track: the tone color at **20% alpha**.
- Fill width is `width × clamp(p,0,1)`, but never less than 4px once p > 0, so tiny progress shows as a dot.
- Color comes from the tone fg (`info` `#4EA7FC`). In stat tiles it is overridden (§17).
- aria-label is `label`. Use `role=progressbar` with `aria-valuenow`.
- **Indeterminate** (`null`): track only, plus a soft gradient `linear-gradient(to right, transparent, currentColor, transparent)` sized `40% 100%` with no repeat. It animates `background-position` from `-100% 0` to `200% 0` over **1440ms** linear, infinite, inside a 999px radius.
- Micro-animation (new): animate fill width changes over 180ms ease-out.

**ProgressRing(progress, size=40, thickness=3, color='accentStrong', showLabel=true, labelColor='textSecondary'):**
- Ring radius is `(size−thickness)/2`, with track at 20% alpha.
- The arc starts at 12 o'clock and runs clockwise, with round caps.
- Center label is caption 12/16, `"{round(p*100)}%"`.
- Exported but unused by pages.

## 17. StatCard and StatGrid (`stat_card.py`)

**StatGrid:**
- Homogeneous columns with **8** gap on both axes, min 2 and max 4 columns.
- GTK FlowBox puts as many equal columns as fit, up to 4. At 968px, columns are `(W−3·8)/4 = 236`.
- React: `grid-template-columns: repeat(N, 1fr)` with `N = clamp(2, floor((W+8)/(minTile+8)), 4)`, where minTile ≈ 160.
- Items are keyed by `id` and update in place.

**StatCard tile** (`.to-metric-tile`), measured 236×106:
- Padding `12px 14px`, `1px solid border`, radius 10, transparent background, `min-height:72px`.
- A column with gap **8**:
  1. **Top row**, gap 6: icon 16px textTertiary; label bodySmall 12/18 textSecondary (flex 1); percent caption 12/16 textTertiary, tabular, right-aligned, `"{round(p*100)}%"`, shown only when progress is set.
  2. **Values**, column gap 2, flex 1:
     - A row with gap 4 aligned on baseline: value **metricSmall** (Inter Display 20/24/600, −0.2px, tnum), then unit bodySmall textSecondary (optional).
     - Then the caption: caption 12/16 textTertiary, natural width about 10 characters, ellipsized.
  3. **ProgressBar** 4px, bottom-aligned, shown only when progress is set. The color is **accent `#5E6AD2`**, or **warning `#F2C94C`** when tile tone is `violet`.
- Overview sets tone `violet` when the fraction is ≥ **0.85**.
- With `onActivate`: hover background backgroundElement, active backgroundSelected and scale 0.98, tooltip set to the label.
- Overview strings:
  - "CPU load" with unit "load avg" and caption "{cores} cores · 5m {load5} · 15m {load15}"
  - "Memory" with caption "of {total}"
  - "Disk" with caption "of {total} · {path}"
  - "Uptime" with caption "since {started}"

## 18. Sparkline (`sparkline.py`), exported but unused

- Height 36 (CSS min 32), full width, bottom-aligned.
- Holds up to `maxPoints=60` values, right-aligned: x step is `width/(maxPoints−1)`, so a partly filled buffer grows from the right edge.
- Y range is `[min=0, max=auto]`. Values are clamped and inset by 1.75px top and bottom.
- Stroke 1.75px with round joins in the color (`accentStrong`, or chart index `to-chart-N`).
- Optional fill under the line to the bottom at **16%** alpha.

## 19. DotSphere (`dot_sphere.py`)

A slowly turning globe of dots that marks work in progress. It is the agent avatar when an agent is working.

**Geometry:**
- `dots` points on a Fibonacci sphere: `y = 1 − 2(i+0.5)/n`, ring `= √(1−y²)`, angle `= i·π(3−√5)`.
- Rotation about the vertical axis by `angle`.
- Projected position: `x = c + (px·cos + pz·sin)·R`, `y = c − py·R`.
- Depth `d = (pz·cos − px·sin + 1)/2`.
- dotRadius `= max(1, size/20)`, R `= size/2 − dotRadius`. Each dot's radius is `dotRadius·(0.45 + 0.55·d)`.

**Shading:** 5 depth bands, `band = min(4, floor(d·5))`. Band opacity is `0.12 + ((band+0.5)/5)·0.88`, which gives 0.208, 0.384, 0.56, 0.736, 0.912. The color is a theme color, `text` by default.

**Animation:**
- One turn per `period = 7200ms`, quantized to **90 frames per turn** (an 80ms step), with angle `= floor(t/period·90) mod 90 / 90 · 2π`. This gives a deliberately stepped feel; reproduce it with `requestAnimationFrame` and the same quantization.
- Spins only while `spinning`, mapped, and motion is allowed. Otherwise it holds still at the last angle (0 initially).

**Used in:** `AgentAvatar`: a 20×20 circle with accent background (`#5E6AD2`) holding a **16px** sphere of **20** dots in `textOnAccent` (white), spinning while the run is working.

## 20. Avatar (`avatar.py`)

- A circle, default size 28 (the conversation author line uses 20), with background backgroundSelected (`#232325`) and overflow hidden.
- Initials: the first letter of up to the first two words, uppercased ("Kevin Roan" gives "KR"). Shown as caption 12/16 textSecondary, centered.
- `.to-avatar` declares 10px/600, but the label's own caption class wins in GTK, so it renders 12px/400.
- An optional image covers the circle (`object-fit: cover`) and hides the initials.

## 21. QrCode (`qr.py`)

- A white tile (`#ffffff`) with padding **12** and radius **8**, centered.
- The code image is `size` px square (default 200; the Pair dialog uses **176**, so the tile is 200).
- Modules are `#000000` on `#ffffff`, with border 0. The tile padding is the quiet zone.
- Render crisp (`image-rendering: pixelated` or SVG).
- Stays white in both themes.

## 22. Charts (`charts/*.py`): Resource history

### 22.1 Card (`.to-resource-history`, overview)

- A column: `[SeriesLegend] [TimeSeriesChart, margin-top 12]`.
- Padding `12px 16px 8px`, `1px solid border`, radius 10, transparent background.
- Lives in the Section "Resource history" (§8).

### 22.2 SeriesLegend and SeriesToggle (`legend.py`)

- A wrapping row with column and row gap **6**, left-aligned.
- Each item is a toggle button (`to-series-toggle`):
  - `min-height 24` (box 26), padding `0 10px`, radius 999, `1px solid border`, transparent background.
  - **opacity 0.5** when off. Hover gives opacity 0.8 with backgroundElement. On (checked) gives opacity 1.
  - Transition `opacity, background, border-color 150ms ease`.
- Content is a row with gap 6:
  - LineKey 12×8: a 2px line with round caps, inset 2px at both ends, vertically centered, in the series color, with the series dash.
  - Label caption 12/16 textSecondary.
  - Value caption 12/16, weight 500, tnum, text color.
- Tooltip `"{label} · {caption}"`, where the caption is `"avg {average} · peak {peak}"` or `"No samples in range"`. With no caption the tooltip is just the label. The missing value is "—".
- The last visible series cannot be hidden: toggling it off snaps back on.
- `onChange(hiddenKeys)`.
- The `compact` flag adds a class with no styling, so there is no visual difference.

**Series (overview):**
| key | label | color idx | fill | dash | default |
|---|---|---|---|---|---|
| load1 | "CPU load" | 0 | yes | — | shown |
| memory | "Memory" | 1 | no | — | shown |
| disk | "Disk" | 2 | no | — | shown |
| load5 | "5m load" | 0 | no | `[6,5]` | hidden |
| load15 | "15m load" | 0 | no | `[0.1,5]` (dots) | hidden |

**Categorical palette** (index mod 6):
- graphite: `#8A7BEB` indigo, `#1FA595` teal, `#E36D45` coral, `#3F8FE0` blue, `#D65C8F` rose, `#B98200` amber.
- graphiteLight: `#5E6AD2`, `#16968A`, `#DA6038`, `#3C87F7`, `#D5508A`, `#B98200`.

**Chart lines:**
- grid: graphite `rgba(255,255,255,0.06)`, light `rgba(0,0,0,0.06)`.
- axis/baseline: graphite `#2B2B2F`, light `#D0D0D2`.

### 22.3 TimeSeriesChart (`timeseries.py`)

This is a canvas, which should be drawn at devicePixelRatio. Props: `durationS, height=240 (overview 200), floor=1.0, valueFormat=percent (0 decimals), emptyLabel, nowLabel, missingLabel, clock`. Overview uses `emptyLabel` "Collecting data…", `nowLabel` "now" and `missingLabel` "—". Ranges are 5m=300s, 15m=900s (default) and 1h=3600s.

**Fonts:**
- Inter 11px, tabular numerals (`tnum`), in textTertiary. Label height is the font's logical line height (about 13–14px at 11px).
- Tooltip title 11px, values **12px semibold**, series labels 11px.

**Layout:**
- `x0 = maxYLabelWidth + 8`
- `y0 = 12`
- `x1 = width − 14`
- `y1 = height − labelH − 8 − 8`
- Time window `[end−duration, end]`, where `end = clock()`.

**Y scale:**
- `ceiling = niceCeiling(peak·1.04, floor)`, with steps `{1,1.25,1.5,2,3,4,5,6,8,10}×10^k`, never below `floor` (1.0 = 100%).
- Ticks: pick a step from `{1,2,2.5,5}×10^p` that divides the ceiling into 2–6 parts, closest to 4, preferring the larger step. For 100% this gives 0/25/50/75/100%.
- Only ticks ≤ the animated ceiling are drawn.
- Grid lines are 1px, pixel-snapped (+0.5 for odd device widths). Value 0 (and 1 when ceiling > 1) uses the **axis** color; others use **grid**.
- Y labels are right-aligned to `x0−8` and vertically centered on their line.

**X axis:**
- `maxTicks = max(1, floor(plotW/92))`.
- Step is the first of `5,10,15,30,60,120,300,600,900,1800,3600,7200` seconds with `span/step ≤ maxTicks`.
- Ticks are aligned to local wall-clock multiples of the step.
- Labels use `HH:MM:SS` when the step is under 60s, otherwise `HH:MM`, drawn at `y1+8` and centered on the tick (clamped inside the plot).
- The "now" label is right-aligned at `x1`. Tick labels that would come within 10px of the previous label or of the now label are skipped.

**Threshold** (overview: 0.85, label "{value} warning" → "85% warning"):
- Dashed `[5,4]` 1px line in warningSolid at **85%** alpha across the plot.
- Label 11px textTertiary at `x = x1 − w − 4`, `y = lineY − h − 4`, on a pill plate (radius h/2, 4px horizontal padding) of surfaceElevated at **85%** alpha.
- Drawn only if the threshold is ≤ the ceiling.

**Series:**
- Points are `(t, value|null)`. Null or non-finite values split the series into segments.
- Each segment is drawn as a **monotone cubic (Fritsch–Carlson)** curve: tangents are the averaged secants, zeroed at flat secants and sign changes, and scaled when `a²+b²>9`.
- Controls are at ±1/3 dx.
- Stroke 1.5px with round caps and joins, the series dash, and the series color times its alpha.
- A single-point segment is a 2px-radius dot.
- Fill (CPU load only): a vertical gradient from y0 to y1, color at 12%·alpha down to 0.
- Series are drawn in **reverse order**, so the first series ends up on top. They are clipped to `[x0, x1]` horizontally and to `y1+1.5` at the bottom.

**Latest dot:**
- For each series whose last point is non-null and in range: a circle of radius 4.5 in **surface** (`#121213`), which acts as a ring, then a radius 3 dot in the series color.
- Values above the ceiling are clamped.

**Hover** (pointer inside `[x0, x1]`):
- Snaps to the nearest timestamp of the visible series.
- Draws a 1px vertical crosshair in textTertiary at 55% alpha from y0 to y1, plus ringed dots on every visible series at that time.

**Tooltip:**
- Box: padding 10, radius 8, background surfaceElevated, 1px border.
- Title is the time `HH:MM:SS` in 11px textTertiary.
- Each row, with 4px between rows: a 14px key line (2.5px stroke, round caps, series dash), gap 8, the value (12px semibold, text, or "—"), gap 8, then the series label (11px textTertiary).
- Placed at `x+14` from the crosshair. It flips to the left side if it would pass `width−2`, and is clamped to ≥2. Its top is `y0+4`.

**Empty:** when the densest visible series has fewer than 2 in-range points, draw `emptyLabel` (12px textTertiary) centered in the plot. Hover is not drawn in that case.

**Animations:** a 350ms tween with ease-out cubic `1−(1−p)³` runs for:
- the window duration (range switch)
- the y ceiling (rescale)
- per-series alpha (legend toggle fades a series in and out; series with alpha < 0.01 are skipped)

Retargets start from the current animated value. When the chart is not mounted, or motion is reduced, it jumps.

**Redraw:** a 1s timer that redraws only when the time advanced at least one pixel (`duration/width` seconds). Hover and data changes redraw immediately.

---

## 23. GTK quirks that should NOT be copied

1. **Radio rows:**
   - The radio renders as an 18px square with no gap to the title.
   - Use a 16px circle with a 12px gap (§12).
2. **ListCard:** the icon badge expands and pushes the body text to the middle (§11).
3. **Primary vs secondary heights:** primary buttons are 28px and secondary are 30px. Unify at 30px using a transparent border (§12).
4. **Text widths and truncation:**
   - `set_max_width_chars(1)` and `max_width_chars=56/48` are Pango width hints.
   - Use flex `min-width:0` with ellipsis, and show the tooltip only when the text is actually truncated rather than "length > 48".
5. **Hover actions:** the overlay appears with no transition in GTK. Fading over 120ms is fine.
6. **Reordering:** KeyedList, GroupedList and KeyValueList reorder by remove/re-append, and KeyValueList never reorders after creation. Use keyed React rendering in the given order.
7. **Avatar:** `.to-avatar`'s 10px/600 font never applies. Match the rendered 12px/400 textSecondary initials.
8. **Inherited sizes:** Pango logical label heights make some rows 1px taller than the CSS line-height. Use the CSS line-heights listed here.
9. **Spinner placement:** in the Section loading state, the spinner sits flush with no row padding, while ListGroup's sits in a 40px row. Keep both as specified, because the difference is visible.
10. **Unused flags:** `compact` legend items and the `metric-indigo` / `metric-yellow` tile tones have no distinct styling. Do not invent any.
