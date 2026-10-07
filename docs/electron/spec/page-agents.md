# Agents page spec (`agents`)

Source of truth: `apps/desktop/monolith_desktop/pages/agents/` (`page.py`, `sidebar.py`, `rows.py`, `conversation.py`, `new_view.py`, `feed.py`, `timeline.py`, `model.py`, `labels.py`). Styles come from `theme/extras/agents.py`, with shared widgets in `widgets/conversation.py`, `widgets/composer.py`, `widgets/feedback.py` and `widgets/badges.py`.
Related specs: `theme.md` (tokens, fonts, motion), `services-data.md` (store, poller, event stream), `services-sync.md` (the sync buttons in the conversation header), `page-terminals.md` (where "Open terminal" goes).

Page registration: `id = "agents"`, `title = "Agents"`, `icon = "agents"` (Lucide `mouse-pointer-2`), `section = "sandbox"`, `order = 10`. The page is the second item in the nav, after Overview.

---

## 1. Tokens used on this page

Two color schemes are rendered: **dark = "graphite"** (the default) and **light = "graphiteLight"**.

| token | dark | light |
|---|---|---|
| background (window) | `#09090A` | `#F5F5F6` |
| surface | `#121213` | `#FFFFFF` |
| surfaceElevated | `#1A1A1B` | `#FFFFFF` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected | `#232325` | `#E7E7EA` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| border (hairline) | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| accent | `#5E6AD2` | `#5E6AD2` |
| accentPressed | `#4F5BC4` | `#4F5BC4` |
| accentMuted | `#1E2036` | `#EDEEFA` |
| accentStrong | `#9EA6F0` | `#4F5BC4` |
| textOnAccent | `#FFFFFF` | `#FFFFFF` |
| codeBackground | `#09090A` | `#F5F5F6` |
| success / successMuted | `#4CB782` / `#14261C` | `#2E8A5B` / `#E5F4EC` |
| warning / warningMuted | `#F2C94C` / `#2B2410` | `#8F6400` / `#FBF2D9` |
| danger / dangerMuted | `#EB5757` / `#2C1517` | `#C93A3A` / `#FCE9E9` |
| info / infoMuted | `#4EA7FC` / `#122233` | `#1F6FCB` / `#E5F1FE` |

There are 5 tones. Each one maps a foreground and a background: neutral → (textSecondary, backgroundElement), info → (info, infoMuted), success → (success, successMuted), warning → (warning, warningMuted), danger → (danger, dangerMuted).

- **Spacing:** xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 4xl 48.
- **Radius:** xs 4, sm 6, md 8, lg 10, xl 12, full/pill 999.
- **Control heights:** xs 24, sm 28, md 32.
- **Avatar sizes:** xs 16, sm 20.
- **Icon sizes:** `xs` and `sm` both render at 16px; `2xl` renders at 48px.
- **Hairline:** `1px solid border`.

Type variants. Inter is used unless noted; the second number is the line height.

| variant | size / line-height | weight |
|---|---|---|
| body | 13/20 | 400 |
| bodyStrong | 13/20 | 500 |
| bodySmall | 12/18 | 400 |
| bodyLarge | 15/22 | 400 |
| label | 13/18 | 500 |
| caption | 12/16 | 400 |
| overline | 12/16 | 500 (not uppercase) |
| h3 | 15/20 | 600, Inter Display, letter-spacing −0.2 |
| h4 | 14/20 | 500 |
| code | 12/18 | Geist Mono |

Single-line text uses ellipsis at the end (`Text(lines=1)`).

Motion:
- Stacks and revealers use **180ms** (`DURATIONS.normal`).
- Hover, color and border transitions use **120ms `cubic-bezier(0.2,0,0,1)`**.
- `button:active` uses `scale(0.95)`.
- Live dots pulse with opacity 1 → 0.35 → 1 over **2880ms**, repeating forever.

Respect `prefers-reduced-motion`.

Project tints (`PROJECT_TINTS`), indexed 0–8: `#5E6AD2 #26B5CE #4CB782 #F2C94C #F2994A #EB5757 #E255A1 #9B51E0 #4EA7FC`.
- A project's tint is `crc32(projectId) % 9`.
- Projects are sorted by id. When two projects collide on a tint, the later one moves to the next free tint.
- Runs with no project get no tint.

---

## 2. Layout regions

```
┌ app sidebar (shell, not this page) ┐┌──────────────── page (inside the window card) ─────────────────┐
│                                     ││ titlebar: "Agents" ............ [search][filter][more][compose][sidebar] │
│                                     │├───────────────────┬───────────────────────────────────────────┤
│                                     ││ ConversationList  │ detail stack (crossfade 180ms):            │
│                                     ││  (sidebar pane)   │   "empty" | "new" | "conversation"         │
└─────────────────────────────────────┘└───────────────────┴───────────────────────────────────────────┘
```

- **Page header widgets** live in the shell titlebar, to the right of the page title. They are created by the page, in this order:
  1. Search toggle
  2. Filter menu button
  3. "Manage conversations" menu button
  4. Compose button
  5. Sidebar toggle (`panel-left`)
- **The page has two panes** (`Adw.OverlaySplitView`, `.to-agents-split`). Both pane backgrounds are transparent, so the window card color shows through.
  - The list pane has `border-right: hairline`.
  - Sidebar width is `clamp(280px, 36% of page width, 400px)`.
  - GTK quirk: at a 1024px window the list measured about 350px wide because of child minimum widths. Use the clamp instead.
- **Breakpoints** are measured on the page's own width, not the window's:
  - `max-width: 1180px` is "compact". The text labels of the three sync buttons in the conversation header are hidden, so only their icons show. A 1440px window gives a page width of about 1135px, so compact is usually on.
  - `max-width: 640px` is "collapsed". The list becomes an overlay drawer with `show-sidebar=false`. Choosing a run or "New conversation" closes the drawer. The sidebar toggle in the titlebar opens it, and the toggle state is two-way bound to `show-sidebar`.
- The page root has a minimum size of 320×320.

---

## 3. Conversation list (left pane, `.to-agents-list`)

The list is a vertical stack of the following, from top to bottom.

### 3.1 Search row
- The search row sits inside a revealer that slides down over 180ms. It is hidden by default.
- Row padding is `8px 12px 0 12px`.
- It holds a search entry with placeholder **"Search conversations"** and `min-height: 28px`. Like other entries it has radius 6, the surfaceElevated background, a hairline border, and on focus an accent border plus a 1px focusRing outline at offset 1.
- Turning the titlebar search toggle on reveals the row and focuses the entry.
- Turning it off clears the text.
- Pressing Escape in the entry turns the toggle off.
- Typing filters the list live, with no debounce.

### 3.2 Scrolling content (`.to-agents-list-content`)
Padding is `4px 8px 24px 8px` and vertical spacing is 8. Horizontal scrolling is off. Children, in order:

1. **Filter chip.** Visible only when the filter is not `all`.
   - A pill button: min-height 24, padding `0 8px`, margin `4px 4px 0 4px`, radius 999, hairline border, transparent background, textSecondary, weight 500.
   - Hover gives backgroundElement and text color.
   - Content, spacing 6: `list-filter` icon (16, textSecondary), the filter label (caption), and an `x` icon (16, textTertiary).
   - Tooltip **"Clear filter"**. Clicking it sets the filter back to `all`.
2. **"Needs you" section** (attention box, spacing 2). See 3.4.
3. **Run rows** (`list.to-convo-list`, transparent, single selection). See 3.3.
4. **Placeholder** (margin-top 48). See 3.6.
5. **"Claude in terminals" section** (spacing 2). See 3.5.

Section titles ("Needs you", "Claude in terminals") use overline 12/16/500 in textSecondary, with padding `8px 10px 4px 10px`.

### 3.3 Conversation row (`row.to-convo-row`)
- Padding `10px 12px`, radius 8, margin `4px 0`. That gives 56px of content plus 8px of margin, so rows repeat every 64px (confirmed in the screenshot).
- **Hover:** backgroundElement. **Selected:** backgroundSelected with text color.
- **Tinted rows** (the run's project has a tint) get a wash of `rgba(tint, a)`, which overrides the plain hover and selected colors:

  | scheme | rest | hover | selected |
  |---|---|---|---|
  | dark | 0.05 | 0.09 | 0.14 |
  | light | 0.06 | 0.10 | 0.16 |

- Background transitions take 120ms.
- **Row layout** is a horizontal box with spacing 10:
  - **State glyph:** a 16×16 slot aligned to the top, with margin-top 1.
    - `running`: spinner, 14px.
    - `succeeded`: Lucide `check-check` in textSecondary.
    - `failed`: `circle-x` in danger.
    - `cancelled`, or any unknown state: `circle-x` in textTertiary.
  - **Text column** (expands, spacing 2):
    - **Top line** (spacing 8): title in label style (13/18/500, text color), which expands and ellipsizes; then the relative time in caption, textTertiary, right-aligned.
    - **Bottom line** (spacing 6):
      - Project logo icon in textTertiary: the framework brand icon (`logo-<slug>-symbolic`), or Lucide `box` when there is no framework or no project.
      - Meta text in caption, textSecondary, expanding.
      - An unread dot when the run needs attention: 7×7, radius 999, accent color, vertically centered.
    - GTK quirk: CSS asks for a 12px logo, but a more specific rule renders it at 16px. Match the **16px** that actually renders.
- **Title** comes from `run_title(prompt)`:
  1. Take the first line that is not empty after cleanup.
  2. Strip a leading `#…`, `- `, `* `, `> `, `1. ` or `1) `.
  3. Convert markdown to plain text and collapse whitespace.
  4. If the result is longer than 80 characters, keep the first 79, trim trailing whitespace, and add "…".
  5. If nothing is left, use **"Untitled conversation"**.
- **Meta** is the following parts joined with `" · "`, skipping empty ones:
  - The project name, or **"Sandbox root"** when there is no project.
  - The token count as `compact_number(total) + " tokens"`, or "token" when the count is 1. Examples: `396k tokens`, `1.6M tokens`, `0 tokens`.
  - **"follow-up"**, when another run in the same list has the same `sessionId` and an earlier `startedAt`.
- **Relative time:**
  - Under 45s: `just now`.
  - Under 1h: `{round(min)}m ago`, minimum 1.
  - Under 1d: `{h}h ago`.
  - Under 7d: `{d}d ago`.
  - Otherwise: `YYYY-MM-DD` (UTC).
  - All row times refresh every **30s** while the page is visible.
- **Tooltip** is the full title.
- **Order** is `startedAt` descending. Runs are not grouped into project sections; `group_runs` exists but is unused.
- **Click or activate** selects the run and opens the conversation.
- **Context menu** opens on right-click, touch long-press, Shift+F10 or the Menu key. The popover is placed at the pointer and has no arrow.
  - Not archived: `Archive`, then a separator, then `Delete…`.
  - Archive view: `Unarchive`, then a separator, then `Delete…`.
  - Running runs have no menu.

### 3.4 Attention cards ("Needs you")
Cards come from the inbox items that are unread and are either `needs_input`/`permission` items, or `file` items that have an `artifactId`.

The section is hidden when the filter is `running` or `archived`.

Card (`.to-attention-card`):
- Padding `8px 10px`, radius 6. Hover: backgroundElement. Horizontal, spacing 10.
- **Icon** (16px, top-aligned, 16×16 slot with margin-top 1):
  - `triangle-alert` in warning, for attention items.
  - `files` in info, for file items.
- **Column** (spacing 2):
  - Top line (spacing 8): the item `title` in label style, expanding; then the relative time of `updatedAt` in caption, textTertiary.
  - Meta: the project name (only if the item has a `projectId`) and `body`, joined with " · ". Caption, textSecondary, wraps to at most 2 lines with ellipsis. Hidden when empty.
  - Action row (spacing 2, margin-top 4) with flat buttons. Each button: min-height 24, padding `0 8px`, font 12/500, textSecondary, hairline border, radius 6. Hover changes the text color to text.
    - The open action is **"Download"** for file items, **"Open"** when the item has an `agentRunId`, or **"Open terminal"** when it has a `terminalId`. It is omitted otherwise.
    - **"Mark as read"** is always shown.
- **Unread dot** at the top right: 7×7, accent, margin-top 6.

Open behaviour:
- File items are marked read silently, then the app navigates to `files` with `{artifactId, projectId}`.
- Items with a run select that run.
- Items with a terminal navigate to `terminals` with `{terminalId}`.

Mark as read:
1. Remove the item from the list optimistically.
2. Call `POST /v1/inbox/read {ids:[id]}`.
3. On success, set the store inbox counts from the response and show the toast **"Marked as read"**.
4. On error, show the toast **"Couldn't mark as read: {error}"** and refetch.

### 3.5 Terminal sessions ("Claude in terminals")
- Shown only when the filter is `all`.
- Comes from the `/sessions` results that have `source` of `terminal` or `cli`, a `terminalId`, and `active` set.
- Each session is a flat button (`.to-terminal-session`): padding `8px 10px`, radius 6, spacing 10.
  - Icon: `square-terminal`, 16px, textSecondary, top-aligned.
  - Column (spacing 2):
    - Title: `run_title(session.title)` in label style.
    - Meta in caption, textSecondary: `{project or "Sandbox root"} · {relative lastActiveAt} · attached`.
- Tooltip is the title. Click navigates to `terminals` with `{terminalId}`.

### 3.6 List placeholder
`Placeholder` widget:
- Vertical, spacing 16, centered, padding 24.
- Shows either a 20px spinner, or a 48px glyph in textTertiary at opacity 0.8.
- Then a title in body style, textSecondary, centered and wrapping.

In the list it is only used with title text and no glyph:

| condition | title | visible when |
|---|---|---|
| runs not loaded yet (`null`) | **"Loading conversations…"** with spinner | always |
| archive view with 0 archived | **"Archive is empty"** | always |
| 0 runs (non-archive) | **"No conversations yet"** | only if no attention cards and no terminal rows |
| runs exist, but none match the filter or search | **"Nothing matches"** | only if no attention cards |

`labels.py` also defines `empty_message`, `no_match_message` and `archived_empty_message`. These are **not rendered** in GTK. To match pixel for pixel, render only the title.

### 3.7 Filters and search
The filter menu (`list-filter` icon, tooltip "Filter") is a radio menu with these options:
- **"All"**
- **"Running"**: `state == running`
- **"Needs attention"**: the run has an unread attention item, matched by `agentRunId == run.id`, or by the same `sessionId` when the item has no `agentRunId`
- **"Archived"**: the list source switches to the archived runs, loaded from `GET /v1/agent/runs?archived=1` each time the filter is chosen

If loading the archived runs fails, show the toast **"Couldn't load archived conversations: {error}"** and fall back to an empty list.

The search query is lower-cased and trimmed. It matches as a substring against any of these fields: prompt, project name, result, error, run id, sessionId.

### 3.8 Bulk "Manage conversations" menu
The button uses the `ellipsis` icon with tooltip **"Manage conversations"**. It is insensitive (dimmed) when it has no actions.

Its contents depend on the view:
- **Normal view:** **"Archive all finished"**, then a separator, then **"Delete all finished…"**. Shown only if at least one non-running run exists.
- **Archive view:** **"Empty archive…"**. Shown only if the archive has at least one non-running run.

### 3.9 Compose button
The compose button uses the `square-pen` icon with tooltip **"New conversation"**. It opens the new-conversation view.

---

## 4. Detail stack

The detail stack (`.to-agents-detail`, transparent) crossfades between its children over 180ms.

### 4.1 `empty`
`Placeholder` with the title **"No conversation selected"** and the `inbox` glyph (Lucide `inbox`, 48px, textTertiary, opacity 0.8). It is centered in the pane with spacing 16 between glyph and title. Showing this view deselects the list row and pauses the feed.

### 4.2 `new`: New conversation view
The view is a scroller with no horizontal scrolling. Its column is aligned to the top, with padding `48px 24px 24px 24px` and spacing 12. **It has no max width**: the card fills the pane minus 24px on each side.

1. **Card** (`.to-new-convo-card`): radius 12, hairline border, surfaceElevated.
   - **Header** (PaneBar): min-height 44, padding `0 8px 0 12px`, no bottom border.
     - Start group (spacing 6):
       - Breadcrumb chip: min-height 24, padding `0 8px`, radius 6, backgroundSelected, spacing 6. It holds the `mouse-pointer-2` icon (16, textSecondary) and **"Agents"** in caption, textSecondary.
       - `chevron-right` icon (16, textTertiary).
       - **"New conversation"** in label style.
     - End: a flat icon button with the `x` icon, tooltip **"Close"**, that returns to `empty`.
   - **Large composer** (`.to-composer.to-composer-large`):
     - Padding `4px 12px 12px 12px`, no border, transparent, radius 12.
     - **Input:** textarea in bodyLarge 15/22. Its height grows from 72 to 320 px, then scrolls. The input area has an inner margin of `0 4px`.
     - **Placeholder** **"What should Claude do?"**: h3 (15/20/600, Inter Display) in textTertiary, overlaid at the top left. Hidden when there is text.
     - **Properties row:** padding `12px 0 8px 0`, spacing 6. It holds the project picker pill:
       - min-height 28, padding `0 2px 0 10px`, radius 999, hairline border. Hover: backgroundElement.
       - Contents: the `box` icon (16, textSecondary), then the dropdown. The dropdown has no background or border, the 13/500 textSecondary label, padding `0 8px 0 2px`, and **no arrow**.
       - Options: **"No project"** (id `""`) first, then projects sorted by name (case-insensitive). Tooltip **"Project"**.
     - **Bar** (spacing 8):
       - Accessories: the attach button, 32×32 circle, hairline border, backgroundElement, `paperclip` icon in textSecondary.
       - An expanding hint, empty here.
       - The send pill **"Start conversation"**: min-height 32, padding `0 14px`, radius 999, accent background, white label 13/500.
         - Disabled: backgroundSelected background, textTertiary text.
         - Pressed: accentPressed.
         - Busy: the label is replaced by a 14px spinner.
     - **Keys:** Enter (including keypad Enter) submits. Shift+Enter inserts a newline. Clicking anywhere on the input area focuses it.
     - **Send is enabled** when the text has non-space content or attachments exist, and the view is not busy, not locked, and no upload is still running or has failed.
2. **Error notice:** a danger-tone `Notice`, hidden by default. It shows **"Couldn't start Claude: {error}"**.
3. **Suggestions:** a wrap layout with 6px gaps both ways and padding `0 4px`. Each suggestion is a chip:
   - min-height 24, padding `0 10px`, radius 999, hairline border, transparent background.
   - Text in caption, textSecondary. Hover: backgroundElement and text color.
   - The tooltip is the full prompt.
   - Click puts the full prompt in the composer and focuses it. It does **not** send.

| chip | prompt |
|---|---|
| Explain this project | Explain how this project is structured and how to run it. |
| Fix failing tests | Run the test suite, find the failing tests and fix them. |
| Review changes | Review the uncommitted changes and point out bugs or risky edits. |
| Write a README | Write a concise README with setup, scripts and project layout. |
| Build & report | Build the project and report any errors with suggested fixes. |

**Submit flow:**
1. Set busy and clear the error.
2. Call `POST /v1/agent/runs` with body `{prompt, projectId?, attachmentIds?}`. `projectId` is omitted when it is `""`.
3. The prompt includes any attachment text that the attachments controller adds to it.
4. **On success:** upsert the run into the store, clear the composer and attachments, select the new run (switching to the conversation view), and refresh the details poller.
5. **On error:** show the inline error notice and also a toast with the same text.
6. Re-entry is guarded by a single `_starting` flag, which also covers follow-ups.

### 4.3 `conversation`
The conversation view (`.to-conversation`) is a vertical stack.

#### Header (PaneBar `.to-convo-header`)
- min-height 44, padding `0 8px 0 16px`, `border-bottom: hairline`, spacing 8.
- **Start group** (spacing 6, expanding):
  - State glyph, vertically centered (same glyphs as the rows).
  - Project name in label style, textSecondary ("Sandbox root" when there is none).
  - `chevron-right` (16, textTertiary).
  - Title from `run_title`, in label style, expanding and ellipsized.
- **End group** (spacing 2), in this order:
  1. **Stop.** Visible only while the run is `running`. A secondary pill: min-height 28, padding `0 14px`, radius 999, surfaceElevated, hairline border. It has the `square` icon and the label **"Stop"**, with tooltip **"Stop this run"**.
  2. **Terminal.** An icon button with the `square-terminal` icon and tooltip **"Open terminal"**. Visible only when a session in `/sessions` has the run's `sessionId` and a `terminalId`. It navigates to `terminals`.
  3. **Sync buttons.** Visible only when the run has a `projectId`. The group has spacing 6 and margin `0 4px`. All three are secondary pills with icons:
     - **"Sync from host"** (`get`, `cloud-download`)
     - **"Sync to host"** (`pull`, normally the primary button but restyled as secondary here)
     - **"Revert"** (`revert`)

     Labels are hidden at the compact breakpoint. When a button is enabled and its action has work waiting, it gets the attention style: accentMuted background, `1px accent` border, accentStrong text. The screenshots show this. Behaviour, confirmation dialogs and tooltips are covered in `services-sync.md`.
  4. **Archive.** An icon button with the `archive` icon and tooltip **"Archive"**. Visible when the run is not running and not archived.
  5. **Unarchive.** An icon button with the `archive-restore` icon and tooltip **"Unarchive"**. Visible when the run is not running and is archived.
  6. **More.** A menu button with the `ellipsis` icon and tooltip **"More actions"**. Its sections are built when it opens:
     - First section: **"Copy session id"** (if the run has a `sessionId`; copies it and shows the toast **"Session id copied"**), and **"Reload"** (if the run is not running; refetches it).
     - Second section, destructive: **"Discard changes"** (if the run has a project and discard is allowed), and **"Delete…"** (if the run is not running).
- While the run is running, the header re-renders every **1000ms** so the duration counts up.

GTK quirk: in narrow panes the project name and title shrink to almost nothing (screenshots show "m…" and "ye…"), because the action buttons take priority. In Electron, give the title `min-width: 0`, the project name `max-width: ~40%`, and keep the same priority order.

#### Notices strip (`.to-convo-notices`)
- Padding `12px 24px 0 24px`, spacing 8. Hidden when empty.
- Notices appear in this order:
  1. Link state `reconnecting`: warning notice **"Live output dropped. Reconnecting…"**
  2. Link state `polling`: info notice **"Live output unavailable here; refreshing every few seconds."**
  3. Error notice, if any. Danger tone with the action **"Dismiss"**. The text is either a follow-up start error, **"Couldn't start Claude: {error}"**, or a stop error, **"Couldn't stop the run: {error}"**.
  4. Sync report from the sync actions. Its tone comes from the report, with the action **"Dismiss"**.
  5. One notice per unread attention or file item for this run. The title is the item title, the message is its body, and the icon and tone come from `notice_style`. The action is **"Download"** for files (which opens the item) or **"Mark as read"** otherwise.
- **Notice styling:**
  - Container: padding `8px 10px`, radius 8, hairline border, **transparent** background (the tone background is overridden), spacing 10.
  - Icon: 16px in the tone color.
  - Body (spacing 2): an optional title in bodyStrong with the tone color, then the message in bodySmall, textSecondary, wrapping.
  - Action: a flat button with the tone color, min-height 24, padding `0 8px`, 12px text.

#### Body stack (crossfade 180ms)
The body has three states:

- **`loading`**: `EmptyState` with a 24px spinner and the title **"Loading conversation…"**. Shown while the run object is still unknown.
- **`error`**: `EmptyState` with a `triangle-alert` glyph (48, textTertiary, margin-bottom 4), the title **"Couldn't load this conversation"**, the error text as the message, and a primary button **"Try again"** that refetches.
  - EmptyState layout: spacing 8, margins 40 top and bottom and 24 at the sides.
  - Title: h4 14/20/500 in textSecondary.
  - Message: bodySmall in textTertiary, max 56ch, centered.
  - Actions: margin-top 8. The primary button is a pill with min-height 28, padding `0 14px`, accent background, white text. Hover: brightness(1.1).
- **`timeline`**: see 4.4.

#### Footer (`.to-convo-footer`)
- Padding `8px 24px 16px 24px`. The composer is centered and capped at **760px** wide.
- **Follow-up composer:**
  - padding `10px 12px 8px 12px`, radius 10, `1px solid borderStrong`, surfaceElevated.
  - Focus-within changes the border color to `rgba(255,255,255,0.2)` in dark or `rgba(0,0,0,0.2)` in light, over 120ms.
- **Input:** body 13/20. Height grows from a minimum of 24 to a maximum of 200 px.
- **Placeholder:** **"Reply to Claude…"** in body style, textTertiary.
- **Bar** (spacing 8):
  - Attach button: 28×28 circle with the `paperclip` icon in textSecondary.
  - Hint: caption, textTertiary, right-aligned, at most 2 lines.
  - Send button: 28×28 circle, accent background, white `arrow-up` icon, tooltip **"Reply"**. Disabled: backgroundSelected background, textTertiary icon. Busy: 14px spinner.
- **Locked states.** While locked, the input is read-only at opacity 0.6, attachments are disabled, and the hint shows the reason in the **warning** color:
  - Run `running`: **"Claude is still working. You can reply when this run ends."**
  - Run has no `sessionId`: **"This run has no Claude session to continue. Start a new conversation instead."**
- **Follow-up submit:**
  1. Set the composer busy.
  2. Call `POST /v1/agent/runs` with body `{prompt, projectId: run.projectId, resumeSessionId: run.sessionId, attachmentIds}`.
  3. On success: clear the composer and select the new run (it shows "Continues …").
  4. On error: show the error notice, show a toast, and keep the draft.

### 4.4 Timeline
- A scroller with no horizontal scrolling. Content is centered and capped at **760px**.
- Content padding is `20px 24px 48px 24px`, with spacing 12 between header, items and footer, and spacing 12 between items.

**Intro** (header), padding `0 13px 4px 13px`, spacing 8:
- **Meta line** (spacing 8):
  - Status badge:
    - Layout: min-height 20, padding `0 8px 0 7px`, radius 999, transparent background with a hairline border, spacing 4.
    - Dot: 6×6 in the tone foreground color.
    - Label: caption 12 at weight 500, textSecondary.
    - Labels: **"Running"** (info, the dot pulses), **"Done"** (success), **"Failed"** (danger), **"Cancelled"** (neutral).
  - Meta text: caption in textTertiary, wrapping to 2 lines and expanding. It contains these parts joined with " · ":
    - project
    - relative start time
    - duration
    - tokens
    - `claudeAccountId`
    - `Session {first 8 chars of sessionId}`
  - Durations use these formats: `{s}s`, `{m}m {s}s`, `{m}m`, `{h}h {m}m`, `{d}d {h}h`.
- **Previous-turn link.** Shown only when an earlier run with the same `sessionId` exists. It is a flat button: radius 6, padding `2px 8px`, left-aligned, spacing 6.
  - Contents: the `arrow-left` icon (16, textTertiary), then **"Continues “{title}”"** in caption, textSecondary, where the title is cut to 60 characters.
  - Click selects that earlier run.

**Items** are built from the run plus its ordered events. Each item type renders as follows.

- **prompt → UserBubble** (`.to-user-message`): padding 12, radius 8, hairline border, surfaceElevated, spacing 6.
  - **Author line** (min-height 20, spacing 8):
    - Avatar: a 20px circle with initials ("Y"), backgroundSelected background, 10px weight 600.
    - Name: **"You"** in label style.
    - Time: relative start time in caption, textTertiary.
  - Prompt text in body style, selectable, indented `margin-left: 28px` (20 for the avatar plus 8 gap).
  - Attachment chips, if any: wrap layout with 6px gaps and at most 4 per line, indented 28px. Images use a large thumbnail and are fetched from `GET /v1/uploads/{id}/content`.
- **text → AssistantMessage**: padding `0 13px`, margin-top 4, spacing 6.
  - Consecutive text events merge into one item, separated by a blank line.
  - **Only the first** text item has an author line. It shows the agent avatar (a 20px accent circle with a 16px rotating dot-sphere of 20 white dots) and **"Claude"**. The sphere spins with a 7200ms period while the run is running.
  - The body is markdown, indented 28px. Code blocks have the copy button **"Copy"**, which shows the toast **"Copied to clipboard"**. Markdown styling is covered in the shared markdown spec.
- **tool → ToolCallCard**:
  - **Header:** a flat button with min-height 24, padding `2px 13px` and radius 6, holding an ActivityRow (spacing 8):
    - Status slot, 20px wide:
      - pending: 12px spinner
      - ok or unknown: `wrench` icon in textTertiary
      - error: `circle-x` icon in danger
    - Tool name in overline (12/500), textSecondary.
    - Summary: the first line of the summary (or of the result), in caption, textTertiary, expanding and ellipsized.
    - Chevron: `chevron-right` when collapsed or `chevron-down` when expanded, in textTertiary. Opacity is 0 and becomes 1 on header hover.
  - Click toggles a details revealer that slides down over 180ms.
  - **Details:** margin `4px 13px 4px 41px`, padding `8px 12px`, radius 8, hairline border, codeBackground, spacing 6. Contents:
    - **"Input"** in caption, textTertiary, then the summary in code style (Geist Mono 12/18), text color.
    - **"Result"** in caption, textTertiary, then the result in code style, textSecondary (danger on error).
    - Each title and value pair is hidden when it is empty.
- **system → SystemLine**: an ActivityRow with the `info` icon (16, textTertiary, in a 20px slot) and the text in caption, textTertiary, wrapping and selectable. Padding `0 13px`.
- **outcome → OutcomeCard**: added when the run is not running. Padding `0 13px`, margin-top 4, spacing 6.
  - **Row:**
    - Tone icon: `circle-check` (success) for **"Finished"**, `circle-x` (danger) for **"Run failed"**, `circle-x` (neutral) for **"Run cancelled"**.
    - Title in overline, colored with the tone.
    - Meta in caption, textTertiary: `{duration} · {tokens}`.
  - **Failed runs:** the error text in bodySmall, danger, indented 28px.
  - **Extra result:** the result is also shown as markdown, indented 28px, if it is non-empty, not already contained in the last text item, and not equal to the error.

**Footer:** a ThinkingRow made of a 12px spinner and **"Claude is thinking…"** in caption, textSecondary, with padding `0 13px`. Visible only while running.

**Auto-follow:**
- The view sticks to the bottom while the distance from the bottom is 48px or less.
- When the user scrolls away from the bottom, the **jump button** appears:
  - 28×28 circle, surfaceElevated, `1px borderStrong`, shadow `0 4px 12px rgba(0,0,0,0.3)`.
  - `arrow-down` icon, centered at the bottom with margin-bottom 16. Tooltip **"Jump to latest"**.
- When new content arrives while following, the view scrolls to the end.
- Selecting a new run clears the timeline and jumps to the end.

**Incremental rendering:**
- Items are keyed: `prompt`, `text-{seq}`, `tool-{seq}`, `result-{seq}`, `system-{seq}`, `outcome-{state}`.
- If the new key list starts with the old one, existing widgets are updated in place and new ones are appended. Otherwise the timeline is rebuilt.
- Animate appended items with a 160ms fade-and-rise of 4px. This is an Electron addition, and must be disabled under reduced motion.

**Timeline building rules** (`timeline.py`):
- Events are de-duplicated by `seq`.
- Only the kinds `text`, `tool_use`, `tool_result` and `system` are kept, ordered by `seq`.
- `tool_use` opens a pending card.
- `tool_result` closes the oldest open card with the same tool name (or any open card when the name is empty), setting status `error` if `isError` and `ok` otherwise. If there is no open card, it adds a standalone card.
- When the run is not running, any cards still open become `unknown`.
- Empty text and system events are skipped.

### 4.5 Stop run
1. The Stop button opens an alert dialog:
   - Title **"Stop Claude?"**
   - Body **"The run is cancelled. Work already written to the project stays."**
   - Buttons **"Keep running"** (default and close response) and **"Stop run"** (destructive).
2. Confirming disables the Stop button and calls `DELETE /v1/agent/runs/{id}`.
3. On success, merge the returned run.
4. On error, show the notice **"Couldn't stop the run: {error}"**.
5. The button is re-enabled either way.

---

## 5. Data and API

All REST paths are prefixed with `/v1`.

| call | when |
|---|---|
| `GET /agent/runs` | Workspace poller every 10s, or 60s when the window is hidden. This feeds the store's non-archived `agent_runs`. Also called on page show (`workspace.refresh()`). |
| `GET /agent/runs?archived=1` | When the archive filter is chosen, and on reconnect (`hello`) while in the archive view. |
| `GET /inbox?limit=100&unread=1` and `GET /sessions?limit=50` | Details poller every **30s** while the page is mapped. Also refreshed on the `inbox.updated` and `hello` events, and after a start. If sessions fail, the previous sessions are kept. |
| `GET /agent/runs/{id}` | Snapshot of the selected run with its events (`AgentRunDetail`). |
| WS `/agent/runs/{id}/stream` | Opened while the selected run is `running`. Messages are `{type:"event", event}` and `{type:"run", run}`. The stream is final when a `run` message has a final state. |
| `POST /agent/runs` | Start a run or a follow-up: `{prompt, projectId?, resumeSessionId?, attachmentIds?}`. |
| `DELETE /agent/runs/{id}` | Stop a run. |
| `POST /agent/runs/archive` | `{ids:[…], archived:bool}` or `{all:true, archived:true}`. Returns `{count}`. |
| `POST /agent/runs/delete` | `{ids:[…]}` or, for "Empty archive", `{all:true, archived:true}`. Returns `{count}`. |
| `POST /inbox/read` | `{ids:[id]}`. Returns `{unreadCount, attentionCount}`. |
| `GET /uploads/{id}/content` | Attachment thumbnails. |

Events applied from the global event stream:
- `agent.updated` (`{run}`): upsert into the runs, or into the archived list when `archivedAt` is set.
- `agent.deleted` (`{ids}`): remove the runs. If the selected run is one of them, show the `empty` view.
- `inbox.updated`: refresh the details.
- `hello`: refresh the details, and also reload the archive when in the archive view.

**Run feed state machine** (`feed.py`). The link state is one of `idle`, `loading`, `live`, `reconnecting` or `polling`.
- `select(id, run?)`: stop everything and reset the event log.
- On resume (the view is visible):
  - If the run is known and `running`, open the stream.
  - Otherwise fetch it with REST. If the fetched run is `running`, then open the stream.
- On socket state changes:
  - `open` → `live`.
  - `connecting` → `reconnecting` if the socket was open before, otherwise `loading`.
  - Closed with a reconnect pending → `reconnecting`.
  - Closed for good → refetch with REST.
- If no socket can be created, poll `GET /agent/runs/{id}` every **2.5s** (link state `polling`) until the run reaches a final state.
- Every callback is guarded by a generation counter, so results from a run that is no longer selected are ignored.
- The feed pauses when the conversation view is hidden and resumes when it is shown again.
- `update_run` from the list never moves a final run back to `running`.

**Archive and delete actions:**
- **Archive** or **unarchive** (from a row, the header, or "Archive all finished" using `{all:true}`):
  - On success, remove the runs locally and show a toast with an **"Undo"** action. Undo reverses the change and cannot itself be undone.
  - Toast text: **"Archived {n conversation(s)}"** or **"Restored {n conversation(s)}"**, for example "Archived 1 conversation" or "Archived 3 conversations".
  - Archiving the open run closes it. Unarchiving keeps it open and clears `archivedAt`.
- **Delete…**, **Delete all finished…** and **Empty archive…** open a confirm dialog, 420px wide:
  - Title **"Delete {n conversation(s)}?"**
  - Body **"{n conversation(s)} will be removed permanently. This can't be undone."**
  - Buttons **"Cancel"** (focused) and **"Delete"** (destructive).
  - On success, show the toast **"Deleted {n conversation(s)}"**.
- On error, show the toast **"Couldn't update conversations: {error}"**.

**Nav badge (metric):** the number of runs in `running` plus `inbox.attentionCount`. It is hidden when the total is 0, and shows `99+` above 99.

---

## 6. Navigation params (`open(params)`)

| params | effect |
|---|---|
| `{runId}` | Select that run. Searches the store runs and then the archived runs. If it is not found locally, it fetches by id and shows the loading state. |
| `{prompt, send:true, projectId?, attachmentIds?}` | Open the new view and start the run immediately. This is used by the app-sidebar "Ask Claude…" composer. |
| `{new:true}` or `{prompt}` or `{projectId}` | Open the new view, preselect the project, prefill the prompt, and focus the input. |
| `{search:true}` | Show the list and reveal and focus search. |
| `{filter:"all"\|"running"\|"attention"\|"archived"}` | Set the filter and show the list. |

---

## 7. GTK quirks NOT to copy

- **Assistant author line.** The agent avatar box expands, so **"Claude" is pushed to the far right** of the message (visible in the failed screenshot). In Electron, place the name directly after the avatar with an 8px gap, as in the user bubble.
- **Logo size.** The row logo is meant to be 12px but renders at 16px. Match the rendered 16px.
- **List width.** The split view's natural-width behaviour makes the list wider than 36%. Use the clamp from section 2.
- **Header truncation.** The header truncates the project and title to a single character before shrinking the actions. See 4.3 for the Electron sizing.
- **Header buttons.** GTK puts the page's header buttons into the shared titlebar. In Electron, render them in the page titlebar slot in the same order, as 28×28 flat icon buttons (radius 6, hover backgroundElement, active or checked backgroundSelected).
- **Placeholder messages.** The list placeholders drop the defined secondary messages. Keep that behaviour, but the strings are available in labels if design ever wants them.
- **Search entry focus.** The search entry gets a doubled focus ring (an accent border plus a 1px outline), as seen in `page-agents-search.png`. This is acceptable, but use one focus style consistently.
- **Broadway snapshots.** The snapshots disable animations and clamp the window to 1024×768, so the reference PNGs are 1024×768 even though 1440×900 was requested.

---

## 8. Electron component map (suggested)

Shared, reusable components:
- `PaneBar`
- `Placeholder`
- `EmptyState`
- `Notice`
- `StatusBadge`
- `Composer` (with `large` variant)
- `UserBubble`, `AssistantMessage`, `ToolCallCard`, `SystemLine`, `OutcomeCard`, `ThinkingRow`, `TimelineView`
- `ActionMenu` (sectioned)
- `ConfirmDialog`

Page-specific components:
- `AgentsPage`
- `ConversationList`
- `ConversationRow`
- `StateGlyph`
- `AttentionCard`
- `TerminalSessionRow`
- `NewConversationView`
- `ConversationPane`

Hooks:
- `useRunFeed(runId)`: REST, then WS, then polling. Returns `{run, events, link, error, reload}`.
- `useAgentDetails()`: inbox and sessions polled every 30s.
- `useArchivedRuns()`

Put labels and suggestions in `pages/agents/labels.ts`. Put the pure model helpers (`runTitle`, `filterRuns`, `buildTimeline`, `rowMeta`, `headerMeta`, `badgeCount`) in `model.ts` and unit-test them.

---

## 9. Reference screenshots (`docs/electron/reference/`)

All screenshots were captured with live data from the user's running sandbox and the zoom set to 1. Broadway clamps the window to **1024×768**. The app sidebar (about 305px wide) is the shell and is not part of this page.

| file | shows |
|---|---|
| `page-agents-list.png` | Dark theme. The list has about 11 succeeded runs, all with `check-check` glyphs, tinted by project: streaxfit is red-ish, monolith is cyan, hybrid-pos is yellow. Meta reads like `streaxfit · 396k tokens · follow-up`. The detail pane shows the `empty` placeholder "No conversation selected" with the inbox glyph. The manage (`…`) button is enabled and the sidebar toggle is checked. |
| `page-agents-new.png` | Dark theme, captured right after launch. The list is still loading ("Loading conversations…" with a spinner, and the manage button is dimmed). The detail shows the new-conversation card: the "Agents › New conversation" breadcrumb, the close button, the large "What should Claude do?" placeholder, the "No project" picker pill, the 32px attach circle, the disabled "Start conversation" pill, and 5 suggestion chips wrapping onto 3 lines. |
| `page-agents-new-light.png` | The same view in the light theme, with the list loaded and tints at 0.06 alpha. |
| `page-agents-conversation-done.png` | Dark theme. The selected run "yes write this down to artiftecutre" has a stronger row tint. The header shows the glyph, a truncated project and title, the three sync pills in their icon-only attention style (accent border and muted fill; the third is a plain secondary pill), and the archive and more buttons. The timeline is scrolled to the end: assistant markdown (numbered list, bold, inline code in accentStrong), a system line "Run finished in 92.6 s, 6 turns, 327,230 tokens", and the outcome "Finished · 1m 36s · 327k tokens" in green. The follow-up composer "Reply to Claude…" has its send button disabled. |
| `page-agents-conversation-done-light.png` | The same view in the light theme. |
| `page-agents-conversation-failed.png` | A failed run. It shows the end of an image attachment, a system line "Session started (model …, cwd …)", a collapsed tool card "Read  /workspace/.theone/uploads/…", the assistant message whose **"Claude" author is pushed right (a quirk)**, a system line, and the outcome "Run failed · 1m 57s · 35k tokens" with the error text in danger red, indented. |
| `page-agents-conversation-cancelled.png` | A cancelled run, short enough to show the intro: a "● Cancelled" neutral badge plus the meta "monolith · 7h ago · 22s · claude-work · Session e06b331b". It also shows a user bubble with the "Y" avatar, "You · 7h ago", the prompt and a large image thumbnail; system lines; and the neutral outcome "Run cancelled · 22s". |
| `page-agents-filter-archived.png` | The Archived filter. The filter chip "Archived ×" is at the top. Archived runs include failed ones (red `circle-x`), runs with "Sandbox root" and the box logo (no tint), and dates older than 7 days shown as `2026-09-28`. |
| `page-agents-search.png` | The search revealed: the search toggle is checked and the "Search conversations" entry is focused with its accent focus ring, above the full list. |
| `page-agents-list-light.png` | The list view in the light theme, with the empty detail pane. |

States that were not captured because no live data matched them: running (spinner glyph, "Running" badge with a pulsing info dot, the Stop button, the thinking row, and the locked composer hint), the "Needs you" attention cards, "Claude in terminals" rows, the conversation load error, and the collapsed (640px or narrower) layout. Build these from sections 3–4. An e2e fixture should seed a running run and an inbox `needs_input` item to cover them.
