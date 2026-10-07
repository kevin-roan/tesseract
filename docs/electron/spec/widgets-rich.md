# Rich widgets: implementation spec (GTK to React/Electron)

Source of truth: `apps/desktop/monolith_desktop/widgets/{markdown,code_block,log_panel,log_view,conversation,composer,sidebar_composer,project_card,desktop,resize_handle,accel_guard,lifecycle}.py`, plus the CSS they depend on in `theme/css.py`, `theme/extras/{agents,projects,sidebar,dialogs,motion}.py`, `theme/tokens.py`, `theme/typography.py`, `theme/semantic.py`, and the parser in `util/markdown.py` and `util/text.py`.

You should be able to rebuild every widget from this file without opening the Python. All numbers are CSS px at zoom 1.0. User-facing strings are quoted verbatim. The section "GTK quirks to NOT copy" lists GTK behaviors to leave out.

---

## 0. Shared tokens used below

### 0.1 Colors (rendered schemes)

The app renders only two schemes: `graphite` (dark, default) and `graphiteLight`. Token names match `theme/semantic.py`, so they should become CSS variables such as `--to-text`.

| token | dark (graphite) | light (graphiteLight) |
|---|---|---|
| background | `#09090A` | `#F5F5F6` |
| backgroundElement (hover) | `#1E1E20` | `#EEEEF0` |
| backgroundSelected (pressed/selected) | `#232325` | `#E7E7EA` |
| surface | `#121213` | `#FFFFFF` |
| surfaceElevated | `#1A1A1B` | `#FFFFFF` |
| codeBackground | `#09090A` | `#F5F5F6` |
| text | `#E3E3E4` | `#1B1B1F` |
| textSecondary | `#929294` | `#5C5D66` |
| textTertiary | `#6B6B6F` | `#7E7F88` |
| textOnAccent | `#FFFFFF` | `#FFFFFF` |
| border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| borderStrong | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| divider | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| accent | `#5E6AD2` | `#5E6AD2` |
| accentPressed | `#4F5BC4` | `#4F5BC4` |
| accentMuted | `#1E2036` | `#EDEEFA` |
| accentStrong (links, inline code) | `#9EA6F0` | `#4F5BC4` |
| focusRing | `#5E6AD2` | `#5E6AD2` |
| success / successMuted | `#4CB782` / `#14261C` | `#2E8A5B` / `#E5F4EC` |
| warning / warningMuted | `#F2C94C` / `#2B2410` | `#8F6400` / `#FBF2D9` |
| danger / dangerMuted | `#EB5757` / `#2C1517` | `#C93A3A` / `#FCE9E9` |
| info / infoMuted | `#4EA7FC` / `#122233` | `#1F6FCB` / `#E5F1FE` |

- "ink alpha" means `rgba(255,255,255,a)` on dark and `rgba(0,0,0,a)` on light.
- Text selection uses `rgba(94,106,210,0.35)`.
- Tones (`neutral|info|success|warning|danger`) map foreground to `textSecondary|info|success|warning|danger`.

### 0.2 Typography (`TEXT_VARIANTS`)

The families are Inter (sans), Inter Display ("display" variants), and Geist Mono (mono).

| variant | size/line-height | weight | family | letter-spacing |
|---|---|---|---|---|
| h3 | 15/20 | 600 | Inter Display | -0.2px |
| h4 | 14/20 | 500 | Inter | 0 |
| bodyLarge | 15/22 | 400 | Inter | 0 |
| body | 13/20 | 400 | Inter | 0 |
| bodyStrong | 13/20 | 500 | Inter | 0 |
| bodySmall | 12/18 | 400 | Inter | 0 |
| label | 13/18 | 500 | Inter | 0 |
| caption | 12/16 | 400 | Inter | 0 |
| overline | 12/16 | 500 | Inter | 0 (not uppercase) |
| code | 12/18 | 400 | Geist Mono | 0 |

- A `Text` element defaults to color `text`, renders on one line, and ellipsizes at the end.
- When `wrap` is on, text breaks at words and falls back to characters: `overflow-wrap: anywhere`.

### 0.3 Spacing, radius, sizes, motion

- **Spacing:** xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40, 4xl 48.
- **Radius:** xs 4, sm 6, md 8, lg 10, xl 12, card 10, pill/full 999.
- **Control heights:** xs 24, sm 28, md 32, lg 36.
- **Icon sizes:** xs, sm, and md are all 16. 2xl is 48.
- **Avatar sizes:** xs 16, sm 20.
- **Durations:** fast 120ms, normal 180ms, slowest 720ms.
- **Easing:** "standard" = `cubic-bezier(0.2, 0, 0, 1)`.
- **Default transition:** every button, `.to-surface`, `.to-card`, and `.to-composer` transitions `background, color, border-color, box-shadow, opacity, filter, outline-*, transform` over 120ms standard easing.
- **Press scale:** every `button:active` scales to 0.95. Card presses (`button.to-pressable:active`) scale to 0.98.
- **Shadows:**
  - level2 = `0 4px 12px rgba(0,0,0,0.3)`
  - level3 = `0 8px 24px rgba(0,0,0,0.4)`
- **Live pulse:** `@keyframes pulse { 0% {opacity:1} 50% {opacity:0.35} 100% {opacity:1} }` runs over 2880ms with standard easing, looping forever.

### 0.4 Shared base controls

- **Button (base):**
  - min-height 28, horizontal padding 10, radius 6, weight 500.
  - Focus-visible: `outline: 1px solid focusRing; outline-offset: 1px`.
- **Flat button:**
  - No background at rest.
  - Hover background `backgroundElement`. Active or checked background `backgroundSelected`.
- **IconButton:** a 28x28 button with a 16px Lucide icon, flat by default. The tooltip and aria-label both use the label.
- **Tooltip:**
  - Padding 4/8, radius 6, background `surfaceElevated`, 1px `border`.
  - Text color `text`, 12px, shadow level2.
- **Scrollbar thumb:** 6px wide, ink alpha 0.12, ink alpha 0.22 on hover. Use overlay-style thin scrollbars.
- **Spinner (Adw.Spinner):**
  - An indeterminate arc spinner in `currentColor`.
  - Sizes used here: 12px (tool and thinking rows), 14px (send button), 20px (placeholder).
  - Use one shared `<Spinner size>` component that rotates linearly about once per second.
  - Under `prefers-reduced-motion`, show a static arc.
- **StatusBadge:**
  - Inline-flex, gap 4, min-height 20, padding `0 8px 0 7px`, radius 999.
  - Transparent background with a 1px `border` border.
  - Contains a 6px tone dot (radius 999, tone foreground) or a 16px tone icon, then a caption label in the tone foreground.
  - `.live` runs the pulse animation on the dot.
- **Icon map (Lucide):**

  | key | Lucide icon |
  |---|---|
  | copy | `copy` |
  | success | `circle-check` |
  | terminal | `square-terminal` |
  | close | `x` |
  | down | `arrow-down` |
  | empty | `folder-open` |
  | tool | `wrench` |
  | failed | `circle-x` |
  | collapse | `chevron-right` |
  | expand | `chevron-down` |
  | info | `info` |
  | send | `arrow-up` |
  | project | `box` |
  | confidential | `lock` |
  | branch | `git-branch` |
  | sync | `cloud-download` |
  | commit | `git-commit-horizontal` |
  | agents | `mouse-pointer-2` |
  | attach | `paperclip` |
  | status-done | `circle-check` |
  | status-canceled | `circle-x` |
  | inbox | `inbox` |
  | warning | `triangle-alert` |

  Icons render at 16px with stroke widths as in the bundled Lucide SVGs.

---

## 1. MarkdownView (`markdown.py`, parser `util/markdown.py`)

This is a lightweight, safe markdown renderer used for assistant messages and outcome bodies. It is not CommonMark. Reproduce the parser rules below exactly, so that the same text renders identically in both apps.

### 1.1 Props

| prop | default | notes |
|---|---|---|
| `text` | `""` | |
| `variant` | `"body"` | Used for paragraphs, list items, and table cells. |
| `color` | `"text"` | |
| `selectable` | `true` | |
| `copyLabel` | `"Copy"` | Passed to code blocks. Conversations pass `"Copy"`. |
| `copiedLabel` | `"Copied"` | Passed to code blocks. Conversations pass `"Copied to clipboard"`. |

If the text is unchanged, the component does nothing. Re-render on theme change: inline code colors are baked into the markup.

### 1.2 Layout

The root is `.to-markdown`: a vertical flex column with **gap 8** between blocks.

### 1.3 Block parsing (line based, in priority order per line)

Input normalization: `\r\n` and `\r` become `\n`. Then go through the lines:

1. **Fence:** `^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)`.
   - The second group is the language.
   - The body runs until a line whose trimmed text starts with the same fence char repeated the same count. The closing line is consumed.
   - An unterminated fence runs to the end of the input.
   - The result is a **code** block.
2. **Blank line:** ends the current paragraph.
3. **Heading:** `^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$`. The level is the number of `#`.
4. **Rule:** `^\s{0,3}([-*_])(\s*\1){2,}\s*$`.
5. **Table:** a line matching `^\s*\|.*\|\s*$`, followed by a divider line `^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$`.
   - Subsequent rows are consumed while they match the row regex.
   - Cells are split on `|` after stripping the outer pipes, and trimmed.
   - Alignment colons are ignored.
6. **Quote:** consecutive lines matching `^\s{0,3}>\s?(.*)$`, joined with `\n` and trimmed.
7. **List:** `^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$`.
   - A list starts only when there is no open paragraph, or when the item is unindented.
   - Items continue while lines match.
   - An indented, non-empty, non-item line is appended to the previous item's text with a single space (continuation).
   - Each item has:
     - `depth` = number of indent columns (tab = 4 spaces) divided by 2, integer division, max 4.
     - `marker` = `•` for `-*+`; otherwise the number, with `)` replaced by `.` (e.g. `3.`).
     - Task items: `^\[([ xX])\]\s+(.*)$` sets `checked` to true or false.
8. Anything else is a **paragraph** line. Paragraph lines are each trimmed and joined with `\n`. **Single newlines inside a paragraph are kept as hard line breaks.**

### 1.4 Inline markup (applies to paragraph, heading, quote, list item, and table cell text)

Processing order:

1. Strip `U+E000` and `U+E001` from the source. They are used internally as placeholder delimiters.
2. **Code spans:** `` (`+)(.+?)\1 `` (dotall). Content is trimmed of spaces.
   - Rendered with the monospace font (Geist Mono), color `accentStrong`, and background `backgroundElement`.
   - GTK draws this as a flat text background with no padding and no radius. See the quirks section.
3. **Links:** `[label](url "optional title")`, `<https://…>` / `<mailto:…>` autolinks, and bare `https?://…` URLs.
   - Trailing `.,;:!?'"` is excluded from bare URLs.
   - Only `http://`, `https://`, and `mailto:` are linked. Any other scheme renders the label as plain text.
   - Link color is `accentStrong`.
   - Clicking a link opens it externally (see §11 `openUri`).
4. On the escaped remainder:
   - **Bold:** `**x**` or `__x__`. Word-bounded for `_`.
   - **Italic:** `*x*` or `_x_`.
   - **Strike:** `~~x~~`.
   - If the resulting tags would be unbalanced, all emphasis is dropped and the escaped plain text is shown instead.
5. Everything else is HTML-escaped. No raw HTML is ever rendered.

### 1.5 Block rendering

| block | rendering |
|---|---|
| heading level 1 | variant `h3` (15/20, 600, Inter Display) |
| heading level 2 | variant `h4` (14/20, 500) |
| heading level 3+ | variant `bodyStrong` (13/20, 500) |
| paragraph | the `variant`/`color` props (default body 13/20, `text`) |
| code | `CodeBlock(text, language, copyLabel, copiedLabel)`, see §2 |
| quote | box `.to-md-quote`: `border-left: 3px solid borderStrong; padding-left: 12px`. Text in `textSecondary`. |
| rule | 1px line in `divider` color, full width |
| list | see below |
| table | see below |

Every text label:

- is full width, left aligned, and wraps with `overflow-wrap: anywhere`;
- is selectable when `selectable` is set, and is not focusable (not a tab stop).

**List** (`.to-md-list`):

- Vertical gap 4 between items.
- Each row is a flex row with gap 8 and `margin-left: depth * 18px`.
  - Marker: the `variant` font in `textSecondary`, **right aligned in a 2ch-wide column**, top aligned.
  - Marker glyphs: `•`, `1.`, `☑` (checked), or `☐` (unchecked).
  - Then the item text, using inline markup.

**Table:**

- Outer scroller `.to-md-table-scroller`:
  - Radius 8, 1px `border` border, `overflow-x: auto`, no vertical scroll.
  - Its height is the table's natural height.
- Inner grid `.to-md-table`:
  - Padding 8/12, column gap 16, row gap 6.
  - Header row (first row) uses `bodyStrong`. Other rows use the `variant` prop.
  - Cells are single line, **not ellipsized**, and never wrap. Wide tables scroll horizontally.
  - Cells are left aligned. Rows with fewer cells simply leave gaps.

---

## 2. CodeBlock and CopyButton (`code_block.py`)

### 2.1 CodeBlock anatomy

```
.to-code-block  (radius 8, 1px border, bg codeBackground, overflow hidden)
 └ overlay
    ├ scroller (overflow-x auto, no vertical scroll, natural height)
    │   └ pre.to-code-block-body  (code 12/18 Geist Mono, color text, padding 10px 12px, white-space: pre, selectable)
    └ .to-code-block-actions  (absolute top-right, margin 4, flex row gap 4, align-items center)
        ├ language  (caption 12/16, textTertiary; hidden when empty)
        └ CopyButton
```

- **Hover reveal:** `.to-code-block-actions` has opacity 0 at rest. It goes to 1 while the pointer is over the block, with a `transition: opacity 120ms cubic-bezier(0.2,0,0,1)`.
  - Also reveal the actions on `:focus-within`, so keyboard users can reach the copy button. GTK does not do this; it is an intended improvement.
- `setCode(code, language?)` replaces the text. When `language` is given, the language label updates and its visibility follows whether the label is empty.
- **The code text is not syntax highlighted.**

### 2.2 CopyButton

- A flat 24x24 button, padding 0, radius 6, background `surfaceElevated`.
  - Hover: `backgroundElement`. Active: `backgroundSelected` plus scale 0.95.
- Icon: `copy`, 16px.
- Tooltip and aria-label: `copyLabel`.
- On click:
  1. Write the raw code string (not the rendered text) to the clipboard.
  2. Swap the icon to `circle-check`.
  3. Change the tooltip to `copiedLabel`.
  4. After **1500ms**, revert the icon and tooltip.
  - A second click restarts the 1500ms timer.
  - Clear the timer on unmount.
- Micro-animation: crossfade or scale the icon swap (120ms, 0.8 to 1 scale, opacity).

---

## 3. LogView (`log_view.py`)

This is a streaming, monospace, colored log with "follow tail" behavior.

### 3.1 Props

| prop | default | notes |
|---|---|---|
| `emptyLabel` | `"No output yet."` | Project pages pass `"Waiting for output…"`. |
| `jumpLabel` | `"Jump to latest output"` | |
| `maxLines` | `5000` | |
| `minHeight` | `240` | |

### 3.2 Anatomy and metrics

- **Container `.to-log-view`:**
  - Relative position, `flex: 1`, overflow hidden, radius 8, 1px `border` border.
  - Background `background` (`#09090A` dark). This is the projects extras override, which wins over the base `codeBackground`; the two are the same color in dark.
- **Scroller:**
  - Fills the container, with `min-height: minHeight` and vertical overflow.
  - Content padding 10px 12px.
  - Text: Geist Mono 12px, line-height 18px.
  - Wrapping: `white-space: pre-wrap; overflow-wrap: anywhere`.
  - Not editable, no caret, selectable.
- **Empty label:**
  - Absolute top-left at 12/12, caption 12/16 `textTertiary`.
  - Visible only while there are zero lines.
- **Jump button (`.to-jump-button`):**
  - Absolute bottom-right with margins 12/12.
  - Size 28x28, radius 999, background `surfaceElevated`, 1px `borderStrong` border.
  - Color `text`, shadow level2 `0 4px 12px rgba(0,0,0,0.3)`.
  - Icon `arrow-down` 16px. Tooltip and aria-label: `jumpLabel`.
  - The button is not flat.

### 3.3 Line model and coloring

Input is a list of `{text, stream?, seq?}` objects, or a bare string with an explicit stream.

**Dedupe:** if `seq` is an integer and is less than or equal to the last seen seq, skip the line. Otherwise remember it. Lines without a seq are always accepted.

**Clean:**

1. Strip ANSI and OSC escape sequences using `\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]`.
2. Strip trailing `[\r\n]+`.
3. Keep only the text after the last `\r`. This collapses carriage-return progress bars.

**Kind:**

- If `stream == "stderr"` and the text matches the following pattern (case-insensitive), the kind becomes `error`:
  ```
  ^\s*(?:error|fatal|panic|uncaught|unhandled|traceback)\b|\b\w*(?:error|exception)(?:\[\w+\])?:|\berror TS\d+
  ```
- Otherwise the kind is the stream.

**Colors:**

| kind | color |
|---|---|
| stdout | `text` |
| stderr | `textSecondary` |
| system | `textTertiary` |
| error | `danger` |

Unknown kinds render as stdout. Recolor all lines live on theme change.

**Trim:** after appending, if `count > maxLines`, drop the oldest `count - maxLines` lines.

### 3.4 API

| method | behavior |
|---|---|
| `clear()` | Empty the view, reset the seq, show the empty label. |
| `setLines(lines)` | `clear()`, then append. |
| `appendLine(line, stream="stdout")` | Append one line. |
| `appendLines(lines)` | Append several lines. |
| `jumpToEnd()` | Set following on, hide the jump button, scroll to the bottom after the next layout. |

### 3.5 Follow behavior

- `following` starts true.
- On scroll: `following = (scrollHeight - clientHeight - scrollTop) <= 24`. The jump button is visible when `!following && lineCount > 0`.
- On content growth: if following, scroll to the bottom after layout (use `requestAnimationFrame`, or a `ResizeObserver` on the content). If not following, leave the scroll position alone.

**Implementation:** use a virtualized list once there are more than about 1000 lines. A plain `<pre>` with spans is fine below that.

**Micro-animation:** the jump button fades and scales in and out over 120ms (opacity 0 to 1, scale 0.9 to 1, translateY 4px to 0). Clicking it scrolls instantly. Smooth scroll is fine when the distance is under 2 viewports.

---

## 4. LogPanel (`log_panel.py`)

This is a header bar plus a LogView. It is used in project Processes and Builds (min height 320) and in the clone step of Create Project (min height 260).

### 4.1 Props

| prop | default | notes |
|---|---|---|
| `closeLabel` | | Callers pass `"Close logs"`. |
| `onClose` | | Optional. |
| `emptyLabel` | | Callers pass `"Waiting for output…"`. |
| `jumpLabel` | | Callers pass `"Jump to latest output"`. |
| `minHeight` | `320` | |

### 4.2 Anatomy

```
.to-log-panel  (flex column, gap 6, margin-top 4)
 ├ header .to-log-panel-header (flex row, gap 8, align center, min-height 28, padding 0 4px 0 12px)
 │   ├ icon square-terminal 16, textTertiary
 │   ├ title (label 13/18 500, text; flex 1, ellipsis)
 │   ├ action button (hidden by default) – secondary ActionButton
 │   ├ StatusBadge (hidden by default)
 │   └ close IconButton (only when onClose) – .to-row-action
 ├ notice (caption 12/16, textTertiary, wraps; hidden when empty)
 └ LogView (min-height = minHeight)
```

**Secondary ActionButton:**

- Min-height 28, radius 999, padding 0 14, weight 500.
- At rest: background `surfaceElevated` and 1px `border` border.
- Hover: base button hover (`backgroundElement`, `borderStrong`).
- Content is a 16px icon plus a label (13/18 500), gap 6, centered.
- The icon is hidden unless one is set.

**Close button (`.to-row-action`):**

- Flat, 24x24, radius 6, color `textSecondary`.
- Hover: color `text` and background `backgroundElement`. Icon `x` 16.

### 4.3 API

| method | behavior |
|---|---|
| `setTitle(s)` | Set the header title. |
| `setStatus(label \| null, tone = "neutral", live = false)` | `null` or `""` hides the badge. `live` pulses the dot. |
| `setAction(label \| null, icon?, onActivate?, sensitive = true)` | `null` hides the button. |
| `setNotice(msg \| null)` | Empty hides the notice. |
| `view` | Exposes the LogView. |

Strings callers use for the status and notice:

- Status: `"Connecting"`, `"Live"` (live: true), `"Ended"`, `"Exited {code}"`, `"Stopped"`.
- Notice: `"Live logs unavailable: showing a snapshot"`.

---

## 5. Conversation timeline (`conversation.py`)

### 5.1 Layout constants

| name | value |
|---|---|
| `MESSAGE_INSET` | 13. Horizontal padding of assistant, outcome, system, and thinking rows, and of tool headers. |
| `BODY_INDENT` | 28 = avatar 20 + gap 8. Left margin of every `.to-message-body`, so bodies align with the author name. |
| `TIMELINE_WIDTH` | 760. |
| `PANE_BAR_HEIGHT` | 44. |
| follow threshold | 48px. |

### 5.2 PaneBar

- `.to-pane-bar` is a flex row with gap 8, min-height 44, padding `0 8px 0 16px`, and border-bottom 1px `border`.
- `start` slot: flex 1, gap 6, vertically centered.
- `end` slot: gap 2, vertically centered.
- Inside the new-conversation card (`.to-new-convo-card .to-pane-bar`): no border, padding `0 8px 0 12px`.
- Toggle menu buttons inside the bar are flat-looking: hover `backgroundElement`, checked `backgroundSelected`.

### 5.3 Placeholder (empty pane)

- Centered column with gap 16, padding 24, `flex: 1`.
- Contents:
  - a 20px spinner, when `loading`;
  - else a 48px glyph in `textTertiary` at **opacity 0.8**, shown only when an icon is given;
  - a title in body 13/20 `textSecondary`, centered, wrapping.
- `setContent(title, icon?, loading?)`.
- Usages: `Placeholder("", …)` for the agents list empty state, and the detail empty state with icon `inbox`.

### 5.4 AgentAvatar

- A 20x20 circle with background `accent`.
- It contains a **DotSphere**:
  - 16px wide, 20 dots, color `textOnAccent`.
  - Each dot is a point of a Fibonacci sphere. Point `i` of `n` sits at:
    - `y = 1 - 2(i+0.5)/n`
    - `r = sqrt(1-y²)`
    - `angle = i * π(3-√5)`
    - `x = cos(angle)·r`, `z = sin(angle)·r`
  - Rotating by angle `a`:
    - screen x = `c + (x·cos a + z·sin a)·R`
    - screen y = `c − y·R`
    - `depth = (z·cos a − x·sin a + 1)/2`
  - Dot radius = `max(1, size/20)·(0.45 + 0.55·depth)`.
  - `R = size/2 − dotRadius`.
  - Opacity comes from 5 depth bands: band `b = min(4, floor(depth·5))`, `opacity = 0.12 + ((b+0.5)/5)·0.88`.
- `setWorking(true)` spins it:
  - One turn every **7200ms**, quantized to 90 steps per turn (one step every 80ms). Use a canvas or SVG with rAF and step the angle.
  - It holds still when idle, when not visible, or under `prefers-reduced-motion`.

### 5.5 AuthorLine

- Flex row with gap 8, align center, min-height 20.
- Contents: avatar, name (label 13/18 500 `text`), time (caption 12/16 `textTertiary`, hidden when empty).
- `setTime(s)`.

### 5.6 ActivityRow (base for one-line events)

- Flex row with gap 8, align center.
- The first child is the glyph slot. It is **20px wide** (matches the avatar column) and holds the glyph centered.
- Then the labels.

### 5.7 UserBubble

```
.to-user-message (flex column gap 6, padding 12, radius 8, 1px border, bg surfaceElevated)
 ├ AuthorLine( Avatar(author, 20), author, time )
 ├ body text (body 13/20, text; wraps; selectable; margin-left 28)
 └ attachments (optional): flex-wrap row, gap 6, max 4 per line, left aligned, margin-left 28
```

**Avatar:**

- A 20px circle with background `backgroundSelected`.
- It shows initials: the first letter of up to two words, uppercased. They render as caption 12/16 in `textSecondary`, centered.
- When an image is set, it covers the circle.

**API:** `setText`, `setTime`. The author is `"You"`.

### 5.8 AssistantMessage

```
.to-assistant-message (flex column gap 6, padding 0 13px, margin-top 4)
 ├ AuthorLine( AgentAvatar, author )   – only when author given (e.g. "Claude")
 └ MarkdownView(text) (margin-left 28, full width)
```

**API:** `setText(markdown)` re-renders; `setWorking(bool)` spins the avatar.

**Streaming:** text updates arrive often. Diff blocks by index and key, and do not rebuild code blocks whose text is unchanged. This keeps the copy-button state and the selection intact.

### 5.9 ToolCallCard

```
.to-tool-card (flex column)
 ├ header button.to-tool-header (flat; min-height 24; padding 2px 13px; radius 6; full width)
 │   └ ActivityRow
 │       ├ status glyph (20px slot):
 │       │    pending → spinner 12px
 │       │    ok / unknown → wrench 16, textTertiary
 │       │    error → circle-x 16, danger
 │       ├ tool name (overline 12/16 500, textSecondary)
 │       ├ summary (caption 12/16, textTertiary; flex 1; single line, ellipsis end)
 │       └ chevron 16, textTertiary, .to-tool-chevron
 └ details (collapsible)
     .to-tool-details (flex column gap 6; margin 4px 13px 4px 41px; padding 8px 12px;
                       radius 8; 1px border; bg codeBackground)
       ├ "Input"  (caption, textTertiary)   – hidden when summary empty
       ├ input    (code 12/18 mono, text; pre-wrap; selectable) – hidden when summary empty
       ├ "Result" (caption, textTertiary)   – hidden when result empty
       └ result   (code 12/18 mono, textSecondary, or danger when status=error; pre-wrap; selectable)
```

**Header:**

- Summary label = the first line of `summary`, or the first line of `result` when `summary` is empty, or `""`.
- The header is a button. Click, Enter, or Space toggles the details.
- Hover background `backgroundElement`; active `backgroundSelected` plus scale 0.95.
  - At this row height that scale looks odd. Prefer scale 0.99 or no press scale for full-width rows.

**Chevron:**

- Opacity 0 at rest, opacity 1 while the header is hovered (120ms).
- Also show it on `:focus-visible`.
- The icon is `chevron-right` when collapsed and `chevron-down` when expanded.
- In Electron, use a single chevron rotated 0° to 90° over 180ms instead of swapping icons.

**Details:**

- Collapsed by default.
- Reveals with a **slide-down over 180ms**: height 0 to auto plus opacity, with the standard easing.

**Status class:** `error` is added to the card when status is error. It has no styling of its own.

**API:**

- `update(tool, summary, result, status)`, where status is `pending|ok|error|other`.
- `setExpanded(bool)`.

**Labels:** `{input: "Input", output: "Result"}`.

### 5.10 SystemLine

- An ActivityRow with padding `0 13px`.
- Glyph: `info` 16 `textTertiary`.
- Text: caption `textTertiary`, flex 1, wrapping, selectable.
- `setText`.

### 5.11 OutcomeCard (end-of-run result)

```
.to-outcome (flex column gap 6, padding 0 13px, margin-top 4)
 ├ ActivityRow: icon 16 (tone fg) · title (overline 12/16 500, tone fg) · meta (caption, textTertiary, flex 1; hidden when empty)
 ├ error (bodySmall 12/18, danger, wraps, selectable, margin-left 28; hidden when empty)
 └ MarkdownView(body) (margin-left 28; hidden when empty)
```

| state | title | tone | icon |
|---|---|---|---|
| succeeded | `"Finished"` | success | `circle-check` |
| failed | `"Run failed"` | danger | `circle-x` |
| cancelled (also the fallback) | `"Run cancelled"` | neutral | `circle-x` |

- Meta is the run duration and total tokens joined by the app's meta separator.
- Error text is shown only for failed runs.
- **API:** `update(title, meta, tone, icon, body?, error?)`.

### 5.12 ThinkingRow

- An ActivityRow with padding `0 13px`.
- Contents: a 12px spinner, then a caption in `textSecondary`: `"Claude is thinking…"`.
- It lives in the timeline footer.

### 5.13 TimelineView

```
.to-timeline (relative, flex 1)
 ├ scroller (overflow-y auto, overflow-x hidden)
 │   └ centered column, width = min(available, 760)   (margin: 0 auto; max-width 760)
 │       └ .to-timeline-content (flex column gap 12; padding 20px 24px 48px 24px)
 │           ├ header slot (flex column)            – setHeader(node|null)
 │           ├ items (flex column gap 12)           – append(node), clear()
 │           └ footer (flex column gap 12)          – setFooter(nodes[])
 └ jump button .to-jump-button: absolute, bottom 16, horizontally centered; 28×28 circle, styles as §3.2;
   tooltip "Jump to latest"
```

**Follow logic:**

- Same as LogView, but with a **48px** threshold.
- The jump button is visible whenever not following. There is no line-count condition.
- On content change while not following, re-evaluate the visibility.

**Methods:**

- `clear()` empties the items and resets following to true (which hides the jump button).
- `jumpToEnd()` is called after switching conversations.

**Micro-animations:**

- New items fade and rise in: opacity 0 to 1 and translateY 4px to 0 over 180ms, ease-out. Apply this only to items appended after the initial render, never to the first batch.
- The jump button animates as in §3.5.

**Hosting context (agents conversation pane), for reference:**

- The composer sits below the timeline, in `.to-convo-footer`: padding `8px 24px 16px 24px`, composer max-width 760, centered.
- Notices: padding `12px 24px 0 24px`, gap 8.
- Intro header: padding `0 13px 4px 13px`.

---

## 6. Composer (`composer.py`)

This is the multi-line prompt box used for follow-up replies (standard) and new conversations (large).

### 6.1 Props

| prop | default | notes |
|---|---|---|
| `placeholder` | | |
| `sendLabel` | | |
| `onSubmit(text)` | | |
| `hint` | `""` | |
| `minHeight` | `24` | |
| `maxHeight` | `240` | |
| `large` | `false` | |

Instances:

| instance | placeholder | sendLabel | size |
|---|---|---|---|
| follow-up | `"Reply to Claude…"` | `"Reply"` | `maxHeight: 200`, standard |
| new conversation | `"What should Claude do?"` | `"Start conversation"` | `minHeight 72, maxHeight 320, large: true` |

### 6.2 Anatomy

```
.to-composer (flex column gap 8)
 ├ [tray]                      – attachment chips; prepended via setTray(); .to-attachment-tray padding-bottom 8
 ├ input area (relative; click anywhere → focus textarea)
 │   ├ textarea .to-composer-input (auto-grow between minHeight and maxHeight, then scrolls; no horizontal scroll;
 │   │                               body 13/20 — large: bodyLarge 15/22; color text; bg none; no border; no resize handle)
 │   └ placeholder (absolute top-left; pointer-events none; textTertiary;
 │                  body 13/20 — large: h3 15/20 600 Inter Display -0.2px) – visible only while the text is exactly ""
 ├ properties .to-composer-properties (flex row gap 6; padding 12px 0 8px 0; hidden until a property is added)
 └ bar .to-composer-bar (flex row gap 8, align center)
     ├ accessories (flex row gap 4, align center)        – addAccessory / prependAccessory (attach button goes first)
     ├ hint (caption 12/16, textTertiary; flex 1; text-align right; wraps, max 2 lines, ellipsis)
     └ SendButton
```

Note that the large placeholder is semibold Inter Display while the typed text is regular 15px. Keep that difference.

### 6.3 Container styles

**Standard (`.to-composer`):**

- Padding `10px 12px 8px 12px`, radius 10, 1px `borderStrong` border, background `surfaceElevated`, no shadow.
- `:focus-within` sets the border to ink alpha 0.2 (`rgba(255,255,255,0.2)` dark, `rgba(0,0,0,0.2)` light), transitioned over 120ms with the standard easing.
- `.drop-target`, while files are dragged over: border `accent`, background `accentMuted`.
- `.locked`: textarea opacity 0.6.

**Large (`.to-composer.to-composer-large`):**

- Padding `4px 12px 12px 12px`, no border, radius 12, no background. The surrounding card provides the chrome.
- The input area has an extra horizontal margin of 4.
- The surrounding new-conversation card: radius 12, 1px `border` border, background `surfaceElevated`.
- In large mode the attach button is 32x32 with a 1px `border` border and background `backgroundElement`.

**Attach button (in both modes):**

- A flat circular button, 28x28 (32 in large), padding 0, radius 999, color `textSecondary`, icon `paperclip` 16.
- Tooltip `"Attach"`. It opens a menu with `"Files…"`, `"Images…"`, and `"Paste image"`.

**Project property (new conversation only), `.to-project-picker`:**

- A pill with min-height 28, padding `0 2px 0 10px`, 1px `border` border.
- Hover background `backgroundElement`.
- Contents:
  - `box` icon 16 `textSecondary`;
  - a dropdown button: min-height 26, padding `0 8px 0 2px`, no background, no border, **arrow hidden**;
  - the label: 13px, weight 500, `textSecondary`.
- Tooltip `"Project"`.

### 6.4 SendButton

**Round (default):**

- 28x28 circle (radius 999), padding 0.
- Background `accent`, color `textOnAccent`, icon `arrow-up` 16.
- Aligned to the bottom of the bar.
- Tooltip and aria-label: `sendLabel`.

**Pill (large):**

- Height 32, padding 0 14, radius 999.
- Label text in `label` 13/18 500, colored `textOnAccent`.

**States:**

- `:active`: background `accentPressed`, plus scale 0.95.
- `:disabled`: background `backgroundSelected`, color `textTertiary`.
- Hover: GTK defines no hover style. Use `filter: brightness(1.1)` to match `.to-primary` hover.

**Busy:** `setBusy(true)` replaces the content with a 14px spinner. The button keeps its width only in pill mode if you fix the width; GTK lets it resize. Crossfade the two contents over 120ms.

### 6.5 Behavior

- `canSubmit = (text.trim() !== "" || hasAttachments) && !busy && !locked && !attachmentsBlocked`. The send button is disabled exactly when `!canSubmit`.
- `submit()`: if `canSubmit`, call `onSubmit(text.trim())`. **The composer does not clear itself.** The host calls `clear()`.
- **Keyboard** (handled before the textarea's default):

  | key | effect |
  |---|---|
  | `Enter`, keypad Enter | Submit. The key is always consumed, even when submit is not allowed. |
  | `Ctrl+Enter` | Also submits, because only Shift is checked. |
  | `Shift+Enter` | Inserts a newline. |
  | `Tab` | Moves focus out (no tab insertion). |

  During IME composition, ignore Enter (`event.isComposing`).
- `setLocked(reason | null)`:
  - Makes the textarea read-only and hides the caret.
  - Replaces the hint with the reason in `warning` color. When cleared, the hint and `textTertiary` are restored.
  - Adds `.locked`.
  - `focusInput()` becomes a no-op.
  - Reasons used:
    - `"Claude is still working. You can reply when this run ends."`
    - `"This run has no Claude session to continue. Start a new conversation instead."`
- `setAttachments(hasItems, blocked)`: with attachments, an empty prompt may be sent. While uploads are pending or one has failed (`blocked`), sending waits.
- Other methods: `setText(s)` (caret goes to the end), `clear()`, `setPlaceholder(s)`, `addProperty(node)`, `setTray(node)`, `input` (ref to the textarea).

---

## 7. SidebarComposer (`sidebar_composer.py`)

This is the compact "Ask Claude…" box at the bottom of the sidebar. It starts a new conversation.

### 7.1 Anatomy

```
.to-composer.to-side-composer (flex column gap 4; margin-bottom 4; padding 8px 6px 6px 10px; radius 8;
                               1px border; bg = color-mix(in srgb, surface 50%, background) ≈ #0E0E0F dark / #FAFAFB light)
 ├ attachment tray
 ├ input area (relative)
 │   ├ textarea (13px Inter, color text, bg none; inner margins top/bottom 4, left/right 2;
 │   │           min-height 20; grows to max 168 then scrolls)
 │   └ placeholder "Ask Claude…" (body 13/20, textTertiary; absolute at top 4, left 2; pointer-events none)
 └ footer (flex row gap 2, align center)
     ├ attach button (24×24, radius 6, textSecondary, flat; paperclip 16)
     ├ ProjectPicker (dropdown)
     ├ spacer (flex 1)
     └ send button (24×24 circle, bg accent, color textOnAccent, arrow-up 16)
```

- `:focus-within` sets the border to `borderStrong`. This composer does **not** use the 0.2 ink border of the standard composer.
- Send `:disabled`: background `backgroundSelected`, color `textTertiary`.

### 7.2 ProjectPicker

**Button:**

- Flat, min-height 24, padding 0 6, radius 6, color `textSecondary`, label 12px.
- Hover background `backgroundElement`.
- It keeps the default small down-arrow (16px chevron-down) after the label.
- Tooltip `"Project for the new conversation"`.

**Options:**

- The first option is `"No project"` (id null).
- Then projects sorted by case-insensitive `name`, falling back to the id.

**Label widths:**

- The collapsed button label is ellipsized at 18 characters (`max-width: 18ch`).
- Popup rows are ellipsized at 32 characters.
- Rows use the `label` text style.

**Selection:**

- When the project list updates, the selection is preserved by id. If the selected project disappears, the picker falls back to "No project".
- `selectProject(id)` sets the selection externally. Clicking a project in the sidebar project list pre-selects it here.

**Popup:** use the app's standard popover menu:

- Padding 4, radius 8, background `surfaceElevated`, 1px border, shadow level3.
- Rows are 28 high with padding 0 8, radius 4.
- Hover row background `backgroundSelected`.

### 7.3 Behavior

**Send button enablement:**

- Enabled when `(text.trim() || hasAttachments) && online && !attachmentsBlocked`.
- Tooltip:
  - online: `"Send (Ctrl+Enter)"` (verbatim string; see the quirks section)
  - offline: `"Connect to the sandbox to start a conversation"`

**Keyboard:** Enter or keypad Enter without Shift sends and is consumed, including Ctrl+Enter. Shift+Enter inserts a newline. Tab moves focus.

**`send()`:**

1. Return false if attachments are blocked.
2. Build the prompt. With attachments, the attachment controller decorates the text (adds references).
3. Trim the prompt. If it is empty, or the app is offline, return false.
4. Navigate to the `agents` page with params `{prompt, send: true, projectId?, attachmentIds?}`.
5. If navigation is refused, show the toast `"Conversations aren't available yet"` and return false.
6. Otherwise clear the text and the attachments.

`focus()` focuses the textarea. The window calls it for "new conversation" from the sidebar.

---

## 8. ProjectCard and ProjectGrid (`project_card.py`)

### 8.1 Card anatomy

```
.to-project-card (relative; min-width 280)
 ├ button.to-pressable (flat, full card; aria-label = title; Enter/Space/click → onOpen(id))
 │   └ .to-surface.to-project-surface (flex column gap 12; padding 16; radius 10; 1px border; bg surface; overflow hidden)
 │       ├ top row (flex row gap 12)
 │       │   ├ icon badge 32×32 (radius 8; bg backgroundElement; 1px border; color textSecondary; box icon 16 centered)
 │       │   ├ titles (flex column gap 2; flex 1; min-width 0; vertically centered)
 │       │   │   ├ title    (h3 15/20 600 Inter Display; ellipsis)
 │       │   │   └ subtitle (caption 12/16 textTertiary; ellipsis; hidden when empty)
 │       │   └ spacer 28px wide (reserves room for the overlaid Ask button)
 │       ├ badges (flex-wrap; gap 6 both axes)
 │       │   confidential (lock icon + tone label; hidden unless set)
 │       │   activity     (tone dot + label)
 │       │   branch       (git-branch icon; neutral; hidden when empty)
 │       │   sync         (cloud-download icon; neutral; hidden when empty)
 │       │   dirty        (tone dot + label; hidden unless set)
 │       ├ flex spacer (flex 1 — pushes the commit row and tags to the bottom in equal-height grid rows)
 │       ├ commit row (flex row gap 8; hidden when no commit)
 │       │   git-commit-horizontal 16 textTertiary · message (body 13/20 textSecondary; flex 1; ellipsis) · when (caption textTertiary)
 │       └ tags (flex-wrap gap 6; hidden when none)
 │           each tag: caption 12/16 textSecondary; padding 0 8; min-height 20; radius 999; 1px border border
 └ Ask button (absolute top-right; margin 12px 12px 0 0; 28×28; padding 0; radius 6; flat; color textSecondary;
               icon mouse-pointer-2 16; tooltip "Ask Claude about {name}"; click → onAsk(id), must not trigger onOpen)
```

**Surface states:**

| state | style |
|---|---|
| rest | background `surface` (`#121213`) |
| hover | background `backgroundElement` |
| active | background `backgroundSelected`, scale **0.98** |
| focus-visible | border `borderStrong` |

All transitions are 120ms standard.

**Ask button hover:** background `backgroundSelected`, color `text`.

The subtitle is built from framework label, package manager, and id, joined by the meta separator.

### 8.2 ProjectCardModel

```
{ id, title, subtitle,
  activity: {label, tone},
  branch?, sync?,
  dirty?: [label, tone],
  commit?, commitWhen?,
  tags: string[],
  confidential?: [label, tone] }
```

### 8.3 ProjectGrid

- A CSS grid with `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, capped at **3 columns** (`maxColumns`), min 1.
- Gap 12. Rows align to the top. Columns are equal width.
- Card instances are keyed by project id. Order follows the input.
- The grid is hidden when empty.
- To cap columns, use `minmax(max(280px, (100% - 2*12px)/3), 1fr)`.
- Micro-animation: cards that mount after the first render fade in (opacity, 180ms). Reorders can use a motion `layout` animation (180ms).

---

## 9. ResizeHandle (`resize_handle.py`), sidebar width

- An invisible strip **6px wide**, full height, pinned to the right edge of the sidebar.
- Cursor `col-resize`. Background none.

**Hover and dragging:** `box-shadow: inset -1px 0 borderStrong`, a 1px line on the right edge, transitioned over 120ms.

**Drag:**

1. Pointer down records the start `clientX` and calls `onBegin()`. The host remembers the start width. Use `setPointerCapture`.
2. Pointer move calls `onDrag(clientX - startX)`. Use window coordinates, not coordinates relative to the moving handle.
3. Pointer up or cancel calls `onEnd()`, which persists the width.

**Width rule:** `width = round(clamp(startWidth + offset / zoom, 200, 420))`. The default is 244. The "zoom" is the app's UI zoom factor.

**Double-click:** resets to 244 and persists.

**Collapsed:** the handle is hidden when the sidebar is collapsed (window narrower than 720px).

**Electron:** while dragging, set `user-select: none` on the body and a global `cursor: col-resize`.

---

## 10. AccelGuard (`accel_guard.py`), shortcut suspension while a terminal or VNC view is focused

**Purpose:** a focused terminal or remote display must receive Ctrl+key combinations, such as Ctrl+R, Ctrl+W, and Ctrl+N.

**Rule:** while any guarded surface has focus, every app accelerator is suspended unless it either:

- includes **Super/Meta**, or
- includes **both Ctrl and Shift**.

Plain function keys such as `F5` are suspended too.

App accelerators affected (all of them today):

| action | keys |
|---|---|
| quit | `Ctrl+Q` |
| preferences | `Ctrl+,` |
| refresh | `Ctrl+R`, `F5` |
| hide window | `Ctrl+W` |
| new conversation | `Ctrl+N` |
| zoom in | `Ctrl+Plus`, `Ctrl+=`, `Ctrl+KP_Add` |
| zoom out | `Ctrl+Minus`, `Ctrl+KP_Subtract` |
| zoom reset | `Ctrl+0`, `Ctrl+KP_0` |

**Reference counting:** each focused surface calls `acquire()` and `release()`. Accelerators are restored when the count returns to 0. Extra `release()` calls are ignored.

**Electron implementation:**

- Do not register these as Menu accelerators that fire unconditionally. Either:
  - handle them in the renderer with a keydown handler that checks `guard.active`, or
  - register them with `registerAccelerator: false` in the menu and dispatch from the renderer.
- Also check `webContents` `before-input-event` so that Ctrl+W, Ctrl+Q, and Ctrl+R do not close or reload the window while the terminal is focused.
- Expose this as a `useAccelGuard(active: boolean)` hook used by the Terminal and VNC views.

---

## 11. Desktop helpers (`desktop.py`)

**`openUri(uri, onError?)`:**

- Opens the URI with the OS handler. In Electron, call `shell.openExternal` through IPC, restricted to `http:`, `https:`, and `mailto:`.
- Report failures through `onError(message)`. Ignore the user cancelling a chooser.
- Used for process URLs and file outputs.

**`copyText(text)`:** writes plain text to the clipboard (`navigator.clipboard.writeText`, or Electron `clipboard.writeText`).

## 12. Lifecycle (`lifecycle.py`)

`whileMapped(widget, attach)`:

- Calls `attach()` when the widget becomes visible, and calls the returned detach function when it is hidden.
- It never attaches twice.
- If the widget is already visible at setup, it attaches immediately.
- It is used to run pollers and store subscriptions only while a page or tab is on screen.

**React equivalent:** `useWhileVisible(attach)`:

- Subscribe in `useEffect` when the component is mounted *and* its page or tab is active (and optionally `document.visibilityState === "visible"`).
- Return the detach function as the cleanup.

---

## 13. Accessibility and keyboard summary

| element | keyboard / a11y |
|---|---|
| Composer / SidebarComposer textarea | Enter sends; Shift+Enter newline; Tab leaves. aria-label = placeholder text. |
| Send buttons | aria-label = send label; disabled state reflected. |
| Tool header | `<button aria-expanded>`; Enter/Space toggle. |
| Copy button | aria-label = copy label; announce the copied label via `aria-live="polite"`. |
| Jump buttons | aria-label = jump label. |
| Project card | Whole card is one button (aria-label = title); the Ask button is a separate tab stop after it. |
| Markdown, log, and message text | Selectable but not tab stops. |
| Resize handle | Add `role="separator" aria-orientation="vertical"`, plus Left/Right arrow keys (±8px) and Enter to reset. GTK has none; this is an intended addition. |

---

## 14. Micro-animations (Electron)

Use the `motion` library. Every animation here has a reduced-motion fallback: under `prefers-reduced-motion: reduce`, durations go to 0 and the sphere and spinners stop.

| where | animation |
|---|---|
| All interactive colors/borders | 120ms `cubic-bezier(0.2,0,0,1)` (the GTK global transition) |
| Button press | scale 0.95 (cards 0.98), 120ms |
| Code block actions | opacity 0 to 1, 120ms on hover/focus-within |
| Copy to Copied icon | crossfade + scale 0.8 to 1, 120ms; revert after 1500ms |
| Tool details | height + opacity, 180ms (GTK SLIDE_DOWN, 180ms) |
| Tool chevron | opacity 0 to 1 on hover, 120ms; rotate 0° to 90° on expand, 180ms |
| Jump buttons | fade + scale 0.9 to 1 + y 4px to 0, 120ms |
| Timeline items appended live | fade + y 4px to 0, 180ms ease-out |
| Composer focus | border-color, 120ms |
| Send busy | crossfade icon/label and spinner, 120ms |
| Status badge `live` | dot opacity pulse 1 to 0.35 to 1, 2880ms infinite |
| AgentAvatar working | sphere turn, 7200ms/turn, 90 steps |
| Resize handle | 1px edge line fade-in, 120ms |

---

## 15. GTK quirks to NOT copy

1. **Placeholder overlays.** GTK places a separate label over the TextView and hides it when the text is non-empty. Use the native `placeholder` attribute, or an absolutely positioned span, with the exact offsets above. Do not reproduce the click-gesture-on-overlay workaround: a plain textarea that fills the area gets focus naturally. Clicking empty padding should still focus it.
2. **Full re-render of markdown on every update.** `MarkdownView` destroys and rebuilds all children on each streamed chunk and on each theme change. Diff by block instead, and use CSS variables so that theme changes need no re-render.
3. **Inline code styling via Pango.** Inline code is a flat background span with no padding or radius, because Pango cannot do better. In Electron, use `padding: 0 3px; border-radius: 4px` with the same colors (`accentStrong` on `backgroundElement`) and Geist Mono at 0.92em. This is a deliberate small visual improvement. If strict pixel parity is required, set the padding and radius to 0.
4. **Invisible but clickable code-block actions.** In GTK, opacity-0 widgets still take clicks, so the copy button can be clicked blind. Keep it clickable, and also reveal it on focus-within.
5. **The `set_max_width_chars(1)` ellipsis trick** (project card titles and commit) and the 28px "ask space" spacer box. Use `min-width: 0; text-overflow: ellipsis` and `padding-right: 28px + 8px` on the top row instead of a spacer element.
6. **ProjectGrid reordering** removes and re-appends every child. Use keyed React children.
7. **Scroll-to-end via `GLib.idle_add`** and adjustment signals. Use a `ResizeObserver` or `MutationObserver` on the content, and the scroll event, with the same 24px and 48px thresholds.
8. **LogView TextBuffer trimming** by line iterators. Use an array ring buffer with a virtualized list.
9. **Resize handle `compute_point` gymnastics.** GTK converts to window coordinates because the handle moves with the edge. With pointer capture and `clientX`, this is not needed.
10. **AccelGuard mutating global accelerators.** Model it as a guard flag checked by the shortcut dispatcher, not by unregistering and re-registering Menu accelerators.
11. **The Avatar `font-size: 10px`** on `.to-avatar` is overridden by the caption class (12px) on the label. The rendered initials are 12px; match 12px.
12. **The duplicate clipboard helpers** (`copy_to_clipboard` in `code_block.py` and `copy_text` in `desktop.py`). Use one `copyText` util.
13. **The `"Send (Ctrl+Enter)"` tooltip** on the sidebar send button is wrong: plain Enter sends. Keep the string verbatim for parity unless product approves `"Send (Enter)"`. Open issue.
14. **Ctrl+Enter submitting by accident**, because only Shift is checked. This is harmless and should be kept, since users expect Ctrl+Enter to send.
15. **Press scale on full-width rows** (tool header): GTK applies the global `button:active` scale of 0.95 to every button, which looks jumpy on wide rows. Use 0.99 or none for row-like buttons.
16. **The `error` CSS class on ToolCallCard** has no rules. Do not add styling for it beyond what is specified.
17. **Unescaped `{name}` in the Ask button's accessible label.** GTK sets the aria-label to the raw template `"Ask Claude about {name}"`, and only the tooltip is formatted. Format both.
18. **libadwaita `Adw.Clamp` tightening.** Here the threshold equals the maximum (760), so it is simply `max-width: 760px; margin: 0 auto`.
