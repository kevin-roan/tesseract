# Theme spec (design tokens, base components, motion, icons)

Source of truth surveyed (read-only): `apps/desktop/tesseract_desktop/theme/**`,
`apps/desktop/tesseract_desktop/widgets/{surface,text,tone,motion,feedback,badges,buttons,icon,drawing,progress,window_controls,dot_sphere}.py`,
`apps/desktop/data/fonts`, `apps/desktop/tools/{lucide_icons,brand_icons}.py`, `widgets/terminal/palette.py`.

The GTK app generates one stylesheet at runtime (`theme/css.py::generate_css(scheme)`), in this order:
`:root` vars → typography classes → color utility classes → chart classes → surfaces → tones → Adwaita overrides →
shared components → `@keyframes` → per-area extras (`theme/extras/*.py`, alphabetical: agents, chart, chrome,
dialogs, display, motion, overview, projects, sidebar, terminal). Later rules win at equal specificity; the values
below are the **effective** (post-cascade) values unless noted.

All class names in the GTK app use the prefix `to-` (e.g. `.to-card`); CSS variables use `--to-<kebab-name>`
(`backgroundElement` → `--to-background-element`, `accentStrong` → `--to-accent-strong`). Keeping the same names in
the Electron renderer makes cross-referencing the Python trivial.

---

## 1. Schemes and appearance

| Concept | Value |
|---|---|
| Appearance options | `"system"`, `"light"`, `"dark"` |
| Default appearance | `"dark"` |
| Rendered scheme for dark | `graphite` |
| Rendered scheme for light | `graphiteLight` |
| `system` | follows the OS (`prefers-color-scheme` / `nativeTheme.shouldUseDarkColors`) and maps dark→`graphite`, light→`graphiteLight` |
| Look | both rendered schemes have look `"graphite"` (Linear look) |

Only `graphite` and `graphiteLight` are ever rendered. The schemes named `light` and `dark` ("classic" look,
periwinkle accent) still exist in `semantic.py` but are dead code; they are listed in Appendix A for completeness and
**should not be implemented**.

Implementation: set `data-scheme="graphite" | "graphiteLight"` on `<html>` and define the variables below per
attribute. Re-render canvas-drawn things (charts, progress ring, dot sphere, window-control glyphs) on scheme change
(GTK does this via `ThemeManager.subscribe`).

### Zoom

`ZOOM_STEPS = 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0`; clamp to [0.67, 2.0]. Step up = next step
greater than current, step down = previous step smaller; direction 0 resets to 1.0. GTK implements this by
regex-multiplying every `px` in the stylesheet — in Electron use `webContents.setZoomFactor(step)` instead.

---

## 2. Color tokens

### 2.1 Semantic colors (the ones to implement)

| token | CSS var | graphite (dark, default) | graphiteLight (light) |
|---|---|---|---|
| `background` | `--to-background` | `#09090A` | `#F5F5F6` |
| `backgroundPattern` | `--to-background-pattern` | `rgba(255, 255, 255, 0)` | `rgba(0, 0, 0, 0)` |
| `backgroundElement` (hover fill) | `--to-background-element` | `#1E1E20` | `#EEEEF0` |
| `backgroundSelected` (selected / pressed fill) | `--to-background-selected` | `#232325` | `#E7E7EA` |
| `surface` (inset panel) | `--to-surface` | `#121213` | `#FFFFFF` |
| `surfaceElevated` (dialogs, popovers, inputs) | `--to-surface-elevated` | `#1A1A1B` | `#FFFFFF` |
| `surfaceSunken` | `--to-surface-sunken` | `#09090A` | `#F5F5F6` |
| `overlay` (modal scrim) | `--to-overlay` | `rgba(0, 0, 0, 0.55)` | `rgba(0, 0, 0, 0.28)` |
| `shimmer` | `--to-shimmer` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.05)` |
| `text` | `--to-text` | `#E3E3E4` | `#1B1B1F` |
| `textSecondary` | `--to-text-secondary` | `#929294` | `#5C5D66` |
| `textTertiary` | `--to-text-tertiary` | `#6B6B6F` | `#7E7F88` |
| `textInverse` | `--to-text-inverse` | `#09090A` | `#FFFFFF` |
| `textOnAccent` | `--to-text-on-accent` | `#ffffff` | `#ffffff` |
| `border` | `--to-border` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.09)` |
| `borderStrong` | `--to-border-strong` | `rgba(255, 255, 255, 0.13)` | `rgba(0, 0, 0, 0.15)` |
| `divider` | `--to-divider` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.06)` |
| `accent` | `--to-accent` | `#5E6AD2` | `#5E6AD2` |
| `accentInk` | `--to-accent-ink` | `#ffffff` | `#ffffff` |
| `accentPressed` | `--to-accent-pressed` | `#4F5BC4` | `#4F5BC4` |
| `accentMuted` | `--to-accent-muted` | `#1E2036` | `#EDEEFA` |
| `accentStrong` (accent-colored text/links) | `--to-accent-strong` | `#9EA6F0` | `#4F5BC4` |
| `focusRing` | `--to-focus-ring` | `#5E6AD2` | `#5E6AD2` |
| `highlight` | `--to-highlight` | `#9EA6F0` | `#4F5BC4` |
| `brand` | `--to-brand` | `#5E6AD2` | `#5E6AD2` |
| `brandMuted` | `--to-brand-muted` | `#1E2036` | `#EDEEFA` |
| `selection` | `--to-selection` | `#5E6AD2` | `#5E6AD2` |
| `badge` | `--to-badge` | `#232325` | `#E7E7EA` |
| `badgeText` | `--to-badge-text` | `#D0D0D2` | `#5C5D66` |
| `success` | `--to-success` | `#4CB782` | `#2E8A5B` |
| `successMuted` | `--to-success-muted` | `#14261C` | `#E5F4EC` |
| `successSolid` | `--to-success-solid` | `#4CB782` | `#4CB782` |
| `warning` | `--to-warning` | `#F2C94C` | `#8F6400` |
| `warningMuted` | `--to-warning-muted` | `#2B2410` | `#FBF2D9` |
| `warningSolid` | `--to-warning-solid` | `#F2C94C` | `#E2B22E` |
| `danger` | `--to-danger` | `#EB5757` | `#C93A3A` |
| `dangerMuted` | `--to-danger-muted` | `#2C1517` | `#FCE9E9` |
| `dangerSolid` | `--to-danger-solid` | `#EB5757` | `#EB5757` |
| `info` | `--to-info` | `#4EA7FC` | `#1F6FCB` |
| `infoMuted` | `--to-info-muted` | `#122233` | `#E5F1FE` |
| `infoSolid` | `--to-info-solid` | `#4EA7FC` | `#4EA7FC` |
| `notification` | `--to-notification` | `#5E6AD2` | `#5E6AD2` |
| `textOnNotification` | `--to-text-on-notification` | `#ffffff` | `#ffffff` |
| `bubbleUser` | `--to-bubble-user` | `#1A1A1B` | `#EEEEF0` |
| `bubbleUserText` | `--to-bubble-user-text` | `#E3E3E4` | `#1B1B1F` |
| `bubbleAssistant` | `--to-bubble-assistant` | `#121213` | `#FFFFFF` |
| `bubbleAssistantText` | `--to-bubble-assistant-text` | `#E3E3E4` | `#1B1B1F` |
| `codeBackground` | `--to-code-background` | `#09090A` | `#F5F5F6` |
| `streamingCursor` | `--to-streaming-cursor` | `#5E6AD2` | `#5E6AD2` |
| `voiceActive` | `--to-voice-active` | `#5E6AD2` | `#5E6AD2` |
| `auraWarm` | `--to-aura-warm` | `#4A4A4E` | `#B4B4B7` |
| `auraCool` | `--to-aura-cool` | `#1E1E20` | `#E3E3E4` |

Other fixed colors used directly in rules (not tokens):
- Primary-button (`.suggested-action`) hover: `#6C78E6` (Linear `indigoHover`) in both graphite schemes.
- Text selection highlight (`::selection`): `rgba(94, 106, 210, 0.35)` in both schemes.
- Destructive button text: `#ffffff`. Window close-button hover text: `#ffffff`. Switch knob and check glyph: `#ffffff`.
- QR code quiet zone: `#ffffff` background in both schemes.
- "Ink alpha" (`ink_alpha(scheme, a)`): `rgba(255, 255, 255, a)` on graphite, `rgba(0, 0, 0, a)` on graphiteLight.
  Used for scrollbar thumbs (0.12 / hover 0.22) and focused composer border (0.2).
- Fullscreen display stage: `#000000`.

### 2.2 Raw palettes (for reference / building the tables above)

```
WHITE #ffffff  BLACK #000000
GRAPHITE 50 #F7F8F8 100 #E3E3E4 200 #D0D0D2 300 #B4B4B7 400 #929294 500 #6B6B6F 600 #4A4A4E
         700 #2B2B2F 750 #232325 800 #1E1E20 850 #1A1A1B 900 #121213 950 #09090A
LINEAR   indigo #5E6AD2 indigoHover #6C78E6 indigoPressed #4F5BC4 indigoMuted #1E2036 indigoInk #9EA6F0
         green #4CB782 greenMuted #14261C yellow #F2C94C yellowMuted #2B2410 orange #F2994A
         red #EB5757 redMuted #2C1517 blue #4EA7FC blueMuted #122233 purple #BB87FC
LINEAR_LIGHT window #F5F5F6 panel #FFFFFF hover #EEEEF0 selected #E7E7EA text #1B1B1F
         textSecondary #5C5D66 textTertiary #7E7F88 indigoInk #4F5BC4 indigoMuted #EDEEFA
         green #2E8A5B greenSolid #4CB782 greenMuted #E5F4EC yellow #8F6400 yellowSolid #E2B22E yellowMuted #FBF2D9
         red #C93A3A redSolid #EB5757 redMuted #FCE9E9 blue #1F6FCB blueSolid #4EA7FC blueMuted #E5F1FE purple #8A4FD8
```
Other palettes in `palette.py` (STONE, CLAY, PERIWINKLE, GRAY, BLUE, GREEN, AMBER, RED, VIOLET, INDIGO, TEAL, CORAL,
PLUM, NAVY, ORCHID, YELLOW, ROSE, TINT) only feed the legacy schemes, the chart palette (2.5) and the decorative
surfaces (2.4).

### 2.3 Tones (status coloring)

Tones: `neutral | info | success | warning | danger`. Each maps to three semantic tokens:

| tone | foreground (`.to-tone-fg`, dots, progress fill) | background (`.to-tone-bg`) | solid |
|---|---|---|---|
| neutral | `textSecondary` | `backgroundElement` | `textTertiary` |
| info | `info` | `infoMuted` | `infoSolid` |
| success | `success` | `successMuted` | `successSolid` |
| warning | `warning` | `warningMuted` | `warningSolid` |
| danger | `danger` | `dangerMuted` | `dangerSolid` |

Default tone → icon mapping (`feedback.tone_icon`): danger → `error` (CircleAlert), warning → `warning`
(TriangleAlert), success → `success` (CircleCheck), everything else → `info` (Info).

### 2.4 Surface tones (`.to-surface.surface-<tone>`)

Tones: `neutral | violet | indigo | yellow`. In both rendered schemes every surface tone is **flat** (the GTK code
emits a radial gradient whose inner and outer stops are the same color, i.e. a solid fill):

| scheme | fill | border | ink overrides scoped inside the surface |
|---|---|---|---|
| graphite | `#121213` | `rgba(255, 255, 255, 0.08)` | `surfaceElevated` & `backgroundElement` = `rgba(255,255,255,0.06)`, `backgroundSelected` = `rgba(255,255,255,0.12)`, `highlight` = neutral `#E3E3E4` / violet `#BB87FC` / indigo `#9EA6F0` / yellow `#F2C94C` |
| graphiteLight | `#FFFFFF` | `rgba(0, 0, 0, 0.09)` | `surfaceElevated` = `rgba(0,0,0,0.03)`, `backgroundElement` = `rgba(0,0,0,0.04)`, `backgroundSelected` = `rgba(0,0,0,0.08)`, `highlight` = neutral `#1B1B1F` / violet `#8A4FD8` / indigo `#4F5BC4` / yellow `#8F6400` |

Base `.to-surface`: `border-radius: 10px; border: 1px solid transparent` (then colored by the tone). Text color =
`text`. Implement as a solid background; do not emit the degenerate radial gradient.

### 2.5 Gradients

| name | graphite | graphiteLight |
|---|---|---|
| brand | `linear-gradient(to right, #5E6AD2 0%, #5E6AD2 100%)` (solid) | same |
| scrim | `linear-gradient(to bottom, rgba(9, 9, 10, 0) 0%, rgba(9, 9, 10, 0.85) 60%, #09090A 100%)` | `linear-gradient(to bottom, rgba(245, 245, 246, 0) 0%, rgba(245, 245, 246, 0.85) 60%, #F5F5F6 100%)` |
| wash | `#09090A` solid (3 equal stops 0/45/100%) | `#F5F5F6` solid |

### 2.6 Chart palette

| field | graphite | graphiteLight |
|---|---|---|
| categorical (`--to-chart-0..5`, order indigo, teal, coral, blue, rose, amber) | `#8A7BEB #1FA595 #E36D45 #3F8FE0 #D65C8F #B98200` | `#5E6AD2 #16968A #DA6038 #3C87F7 #D5508A #B98200` |
| sequential (5) | `#1E1E20 #2B2B2F #6B6B6F #B4B4B7 #E3E3E4` | `#E3E3E4 #D0D0D2 #929294 #6B6B6F #2B2B2F` |
| diverging negative / neutral / positive | `#FF6369 / #2B2B2F / #3DD68C` | `#EB5757 / #D0D0D2 / #4CB782` |
| status success / warning / danger / info | `#4CB782 / #F2C94C / #EB5757 / #4EA7FC` | `#4CB782 / #E2B22E / #EB5757 / #4EA7FC` |
| grid (`--to-chart-grid`) | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.06)` |
| axis | `#2B2B2F` | `#D0D0D2` |
| label | `#929294` | `#5C5D66` |
| bar | `#5E6AD2` | `#5E6AD2` |
| bar empty fill / stroke | `rgba(255,255,255,0.06)` / `rgba(255,255,255,0.16)` | `rgba(0,0,0,0.04)` / `rgba(0,0,0,0.14)` |

### 2.7 Project tints (Linear label hues)

`PROJECT_TINTS = #5E6AD2, #26B5CE, #4CB782, #F2C94C, #F2994A, #EB5757, #E255A1, #9B51E0, #4EA7FC` (index 0–8).

Assignment (`project_tints.py`): `tint = crc32(utf8(project.id)) % 9`. Projects are processed sorted by `id`; if the
hashed tint is already taken, use the next free index (`(tint + step) % 9`). A project not in the known list uses its
raw hash. No project → no tint. In JS use a standard CRC-32 (IEEE, same as zlib) so indices match the GTK app.

Row washes (`.to-tint-<i>` on agent conversation rows and sidebar rows), color = tint hex at alpha:

| state | dark (graphite) | light (graphiteLight) |
|---|---|---|
| rest | 0.05 | 0.06 |
| hover | 0.09 | 0.10 |
| selected (conversation rows only) | 0.14 | 0.16 |

### 2.8 Terminal palettes

| scheme | fg | bg | cursor | cursor text | selection |
|---|---|---|---|---|---|
| graphite | `#E3E3E4` | `#09090A` | `#E3E3E4` | `#09090A` | `#2A2C45` |
| graphiteLight | `#1B1B1F` | `#FFFFFF` | `#5E6AD2` | `#FFFFFF` | `#D9DCF5` |

ANSI 0–15, graphite: `#222222 #FF6369 #3DD68C #F2C55C #7FB8FA #C47BEA #7FD6C8 #D4D4D4 #7A7A7A #FF6E6E #c3e88d #ffe08a #a6c8ff #E7AEF8 #a3f7ea #ffffff`
ANSI 0–15, graphiteLight: `#1B1B1F #C93A3A #2E8A5B #8F6400 #1F6FCB #8A4FD8 #1B7C83 #6B6B6F #5C5D66 #A40E26 #1A7F37 #7D5800 #0969DA #A475F9 #3192AA #929294`
Indices 16–231: xterm 6×6×6 cube with levels `0, 95, 135, 175, 215, 255`; 232–255: grey `8 + (i − 232) × 10`.
(Maps directly onto an xterm.js `ITheme`.)

---

## 3. Typography

### 3.1 Fonts (bundle these files from `apps/desktop/data/fonts`)

| family | files (weight) | used for |
|---|---|---|
| Inter | `Inter_Regular.ttf` 400, `Inter_Medium.ttf` 500, `Inter_SemiBold.ttf` 600, `Inter_Bold.ttf` 700 | all UI text |
| Inter Display | `InterDisplay_Medium.ttf` 500, `InterDisplay_SemiBold.ttf` 600, `InterDisplay_Bold.ttf` 700 (no 400) | display/title variants |
| Geist Mono | `GeistMono_400Regular.ttf`, `_500Medium`, `_600SemiBold`, `_700Bold` | code, logs, terminal |

Licenses: `LICENSE-inter`, `LICENSE-geistmono` (ship them). Declare with `@font-face` (`font-display: block` to avoid
a flash of fallback in screenshots).

Stacks:
- sans `--to-font-sans`: `Inter, "Inter Variable", "Adwaita Sans", Cantarell, sans-serif`
- display `--to-font-display`: `"Inter Display", Inter, "Inter Variable", "Adwaita Sans", Cantarell, sans-serif`
- mono `--to-font-mono`: `"Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", monospace`

(GTK reorders the stack to put installed families first; with bundled fonts this is a no-op. In Electron, just use
the stacks; `Adwaita Sans`/`Cantarell` can be dropped.)

Base: `window, dialog, popover { font-family: sans; font-size: 13px }`. `DESKTOP_FONT_SCALE = 1.0`.
Headerbar titles, `.title-1..4`, `.large-title`, `.numeric` use the display family.

### 3.2 Text variants (`.to-text-<kebab>`)

| variant | family | size px | line-height px | weight | letter-spacing px | extra |
|---|---|---|---|---|---|---|
| `display` | display | 32 | 38 | 600 | -0.8 | |
| `title` | display | 24 | 30 | 600 | -0.4 | |
| `greeting` | display | 20 | 28 | 500 | -0.4 | |
| `h1` | display | 24 | 30 | 600 | -0.4 | |
| `h2` | display | 18 | 24 | 600 | -0.2 | |
| `h3` | display | 15 | 20 | 600 | -0.2 | |
| `h4` | sans | 14 | 20 | 500 | 0 | |
| `metric` | display | 28 | 32 | 600 | -0.4 | `font-feature-settings: "tnum"` |
| `metricSmall` | display | 20 | 24 | 600 | -0.2 | `"tnum"` |
| `bodyLarge` | sans | 15 | 22 | 400 | 0 | |
| `body` | sans | 13 | 20 | 400 | 0 | default |
| `bodyStrong` | sans | 13 | 20 | 500 | 0 | |
| `bodySmall` | sans | 12 | 18 | 400 | 0 | |
| `label` | sans | 13 | 18 | 500 | 0 | buttons/chips |
| `button` | sans | 13 | 18 | 500 | 0 | |
| `caption` | sans | 12 | 16 | 400 | 0 | |
| `overline` | sans | 12 | 16 | 500 | 0 | NOT uppercase (sidebar section titles) |
| `code` | mono | 12 | 18 | 400 | 0 | |

Letter-spacing scale: tightest -1.2, tighter -0.8, tight -0.4, snug -0.2, normal 0, wide 0.4, wider 1.0.
Weights: regular 400, medium 500, semibold 600, bold 700, extrabold 800.

`.to-tabular` / `.to-series-value`: `font-feature-settings: "tnum"` (series value also weight 500).

### 3.3 Text component (`widgets/text.py`)

`<Text variant="body" color="text" wrap={false} lines={1} center={false} selectable={false}>`
- Applies `.to-text-<variant>` and `.to-fg-<color>` (color is any semantic token).
- `lines=1` (default, no wrap): single line, ellipsis at end (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`).
- `wrap=true` + `lines=n`: wrap on word or char (`overflow-wrap: anywhere`), clamp to n lines with end ellipsis (`-webkit-line-clamp`). `wrap=true, lines=null`: unlimited wrapping.
- `center`: centered + justify center. Default `xalign` 0 (left).
- `setTextValue(null|"")` hides the element entirely.

Color utility classes exist for every token: `.to-fg-<token> { color }`, `.to-bg-<token> { background-color }`.

---

## 4. Spacing, sizing, radii, borders, shadows

### 4.1 Spacing scale (px)
`none 0, xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40, 4xl 48, 5xl 64, 6xl 80`.
Off-scale values that appear in rules: 1, 3, 5, 6, 7, 9, 10, 13, 14 (always computed as scale ± 1/2 — reproduce the
literal numbers given in component recipes).

### 4.2 Layout constants
| name | value |
|---|---|
| screen gutter / section gap | 32 / 32 |
| max content width | 1120 |
| sidebar width default | 244 (fraction 0.24, clamp 200–420, user-resizable, persisted as `sidebarWidth`) |
| default window size | 1240 × 800 |
| min window size | 360 × 480 |
| collapse breakpoint | `max-width: 720sp` (≈ 720 CSS px; sidebar collapses to overlay below this) |
| composer max height | 168 |
| base font size | 13 |
| sidebar run indent | 30 |
| empty state max width | 460 |

### 4.3 Control / icon / avatar sizes
- Control heights: `xs 24, sm 28, md 32, lg 36, xl 44`.
- Icon sizes: `xs 16, sm 16, md 16, lg 24, xl 32, 2xl 48, 3xl 64` (default UI icon = 16).
- Avatar sizes: `xs 16, sm 20, md 28, lg 40, xl 64`.

### 4.4 Radii
`none 0, xs 4, sm 6, md 8, lg 10, xl 12, 2xl 16, 3xl 20, card 10, sheet 12, pill 999, full 999`.
(`SQUARE_CORNERS` for the graphite look overrides card/sheet/pill with the same values 10/12/999 — a no-op.)

### 4.5 Borders
Widths: `none 0, hairline 0.5, thin 1, thick 2, focus 3`. Every border in the app is `1px solid var(--to-border)`
(hairline name in code, but 1px) unless stated. `thick` (2px) is only used on `.to-empty-badge`; `focus` (3px) only on
markdown blockquote left border.

### 4.6 Shadows (`0 <y>px <blur>px rgba(0,0,0,<a>)`)
| level | value | used by |
|---|---|---|
| level1 | `0 1px 2px rgba(0, 0, 0, 0.2)` | (unused) |
| level2 | `0 4px 12px rgba(0, 0, 0, 0.3)` | tooltip, jump button, terminal banner |
| level3 | `0 8px 24px rgba(0, 0, 0, 0.4)` | popovers/menus, toasts, display overlay |
| level4 | `0 16px 48px rgba(0, 0, 0, 0.5)` | dialogs / floating sheets |

Cards, buttons, inputs, list rows: **no shadow** (Linear look relies on borders).

### 4.7 Focus ring
- `button:focus-visible`, `entry:focus-within` (inputs), `textarea:focus-visible`: `outline: 1px solid var(--to-focus-ring); outline-offset: 1px`.
- Inputs additionally switch `border-color` to `var(--to-accent)` when focused.
- Window controls: `outline-offset: -2px`. Record-list rows: `outline-offset: -2px`.
- Display stage (VNC) focus: `box-shadow: inset 0 0 0 1px var(--to-focus-ring)`; the VNC canvas itself has no outline.
- Title entry (dialog big title input): no outline, no border.
- Only on keyboard focus (`:focus-visible`), never on mouse click.

---

## 5. Interaction states (generic)

| element | rest | hover | active / pressed | selected / checked | disabled |
|---|---|---|---|---|---|
| flat button / icon button | transparent | `backgroundElement` | `backgroundSelected` + scale 0.95 | `backgroundSelected` | — |
| default (bordered) label-only/icon-only button | `surfaceElevated`, 1px `border`, color `text` | `backgroundElement`, border `borderStrong` | scale 0.95 | — | — |
| primary (`.to-primary`) | `accent`, text `textOnAccent` | `filter: brightness(1.1)` | `accentPressed` + scale 0.95 | — | opacity 0.5 |
| suggested-action (dialog primary) | `accent` | `#6C78E6` | `accentPressed` | — | — |
| nav / list row | transparent | `backgroundElement` | `backgroundSelected` | `backgroundSelected`, text `text` | — |
| chip | transparent, 1px `border`, `textSecondary` | `backgroundElement`, `text` | scale 0.95 | `backgroundSelected`, border `borderStrong`, `text` | opacity 0.45 |
| pressable card | surface fill | `backgroundElement` | `backgroundSelected` + scale 0.98 | — | — |
| boxed-list activatable row (Adwaita lists) | transparent | `color-mix(currentColor 3%)` | `color-mix(currentColor 8%)` | — | — |

All of these transition per §7.2.

---

## 6. Component recipes (effective CSS, graphite & graphiteLight share geometry)

### 6.1 Buttons (`widgets/buttons.py`)

`ActionButton(label, onActivate, variant = "primary" | "secondary" | "flat" | "destructive", icon?, tooltip?)`
- Content: row, gap 6, centered; optional 16px icon (hidden when none) + `label` text variant (13/18, 500); label
  inherits button color.
- Variant classes: primary → `.to-primary`; secondary → `.to-secondary`; flat → `.flat`; destructive →
  `.destructive-action.to-secondary`.

Base `button`: `min-height 28px; padding 0 10px; border-radius 6px; font-weight 500`.

| class | geometry | colors |
|---|---|---|
| `.to-primary` | min-height 28, padding 0 14, radius 999 (pill), no border | bg `accent`, fg `textOnAccent`; hover `brightness(1.1)`; active `accentPressed`; disabled opacity 0.5 |
| `.to-secondary` | min-height 28, padding 0 14, radius 999 | rest: bg `surfaceElevated`, 1px `border`. Hover/active fall back to libadwaita's default button fill: hover `color-mix(in srgb, currentColor 15%, transparent)`, active `color-mix(in srgb, currentColor 30%, transparent)` (ActionButton has a box child, so the `.text-button` hover rule does not apply). GTK also drops the border on hover (1px layout jump) — keep the 1px border (`borderStrong`) on hover instead |
| `.to-secondary.to-attention` | same | rest: bg `accentMuted`, 1px `accent` border, text `accentStrong`; text stays `accentStrong` on hover |
| `.destructive-action` | radius 999 | bg `dangerSolid`, text `#ffffff`, no shadow. In dialog footers: bg `dangerSolid`, text `textOnAccent`, no border (also on hover) |
| `.suggested-action` | radius 999 | bg `accent`, text `textOnAccent`; hover `#6C78E6`; active `accentPressed` |
| `.flat` | | transparent; hover `backgroundElement`; active/checked `backgroundSelected` |
| `.pill` | radius 999, padding 0 16, min-height 32 | |
| `.circular` | radius 999 | |
| icon-only (`.image-button`) | min-width 28, padding 0 (28×28 square) | |
| `.to-link-button` | padding 0 8 | `textSecondary`, hover `text` |

`IconButton(icon, label, onActivate, flat = true)`: 28×28, 16px icon, tooltip = label, `aria-label` = label, flat by
default.

### 6.2 Chips & segmented controls
- `Chip` (toggle): min-height 28, padding 0 12, radius 999, 1px `border`, transparent, `textSecondary`, weight 500;
  content row gap 6 with optional 16px icon + `label` text. States per §5.
- `ChipGroup`: wrap layout, column gap 8, row gap 8, max 12 per line; single selection; clicking the selected chip
  keeps it selected (cannot deselect); `onChange(id)` fires only on a new selection.
- Property chips in dialogs (`.to-property-chips button.to-chip`): margin-top 4 on container, min-height 28,
  padding 0 10, weight 400.
- Filter chip (agents): min-height 24, padding 0 8, margin 4 4 0 4. Suggestion chip: min-height 24, padding 0 10.
- `.to-segmented`: padding 2, radius 999, 1px `border`, bg `background` (inside dialogs: `surface`).
- `.to-segment`: min-height 24, padding 0 12, radius 999, no border, transparent, `textSecondary`, 12px/500;
  hover `text`; checked bg `backgroundSelected`, `text`.

### 6.3 Inputs
- Text input / spin / dropdown trigger: min-height 32, radius 6, bg `surfaceElevated`, 1px `border`, no shadow;
  focus: border `accent` + 1px focus outline offset 1; placeholder `textTertiary`.
- `.to-form-entry`: bg `surface`; error: border `danger`, text `danger`.
- `.to-row-entry` (settings): min-width 320, bg `surfaceElevated`, min-height 32, radius 6.
- `.to-title-entry`: min-height 36, padding 0, no bg/border/outline, 18px/600 (monospace variant 15px/400).
- `.to-copy-field`: min-height 32, padding 0 4 0 10, radius 6, 1px `border`, bg `surface`.
- Choice dropdown trigger: min-height 28, padding 0 8, radius 6, 1px `border`, bg `surface` (unless flat).
  Dropdown list rows: min-height 28, padding 0 8, radius 4.
- Switch: track 28×16, radius 999, bg `backgroundSelected`, no border; checked bg `accent`; knob 12×12, margin 2,
  `#ffffff`, no shadow.
- Checkbox / radio: 14×14, 1px `borderStrong`, transparent; checkbox radius 4 (radio round); checked bg+border
  `accent`, glyph `#ffffff`.

### 6.4 Popovers, menus, tooltips, toasts, dialogs
- Popover contents: padding 4, radius 10, bg `surfaceElevated`, 1px `border`, shadow level3.
- Menu item: min-height 28, padding 0 8, radius 6; hover/selected `backgroundSelected`. Separator: margin 4 0,
  color `divider`, 1px.
- Tooltip: padding 4 8, radius 6, bg `surfaceElevated`, 1px `border`, text `text`, 12px, shadow level2.
- Toast: radius 8, bg `surfaceElevated`, 1px `border`, text `text`, shadow level3.
- Dialog / floating sheet: radius 12, bg `surfaceElevated`, 1px `border`, shadow level4; scrim `overlay`. Alert
  dialog response buttons: radius 999. Dialog title weight 500.
- Dialog layout: header padding 12 12 4 16, min-height 24 (confirm dialogs: padding-top 16); body padding 8 16 16 16;
  footer padding 8 12 12 16, footer buttons min-height 30. Header icon buttons 24×24, radius 6, `textSecondary` →
  hover `text`. Breadcrumb chip: min-height 24, padding 0 8, radius 6, bg `backgroundSelected`.
- Settings window: root bg `background`, radius 12. Nav column min-width 200, padding 12 8; nav heading label padding
  4 8; nav rows min-height 28, padding 0 8, margin-bottom 1, radius 6, `textSecondary`; hover `backgroundElement`;
  selected `backgroundSelected` + `text`. Content panel: margin 8 8 8 0, radius 10, 1px `border`, bg `surface`;
  content header padding 8 8 8 16 with bottom 1px `divider`. Page margin 20 24 32 24, section gap 24; group inner
  gap 8; group heading 13/500 `text`; description 12 `textSecondary`. Boxed lists: bg `surface`, 1px `border`,
  radius 8, row separators 1px `divider` (none after last). Row: header margin 0 14, min-height 44; title 13px;
  subtitle 12px `textSecondary`; property rows invert (title 12 `textSecondary`, value 13 `text`); expander nested
  rows min-height 36; buttons in rows min-height 28; check/radio 14.

### 6.5 Lists & rows
- Generic boxed list / `.card`: radius 10, bg `surface`, 1px `border`, no shadow; row separators `divider`.
- `.to-list-row`: padding 8 12, radius 6.
- Sidebar nav rows: see §6.9.
- `.to-key-value`: padding 4 0. In `.to-flat-list`: padding 9 2, bottom 1px `divider`; list has top 1px `divider`.
- Flat rows (`list.to-flat-rows`): top 1px `divider`; rows padding 8 4, bottom 1px `divider`, radius 0, hover
  `backgroundElement`.

### 6.6 Badges & indicators (`widgets/badges.py`)
- **StatusBadge(label, tone, icon?)**: row gap 4, min-height 20, padding 0 8 0 7, radius 999, **transparent** bg with
  1px `border`, font 12/500 (label uses `caption` 12/16 in `textSecondary` — label does not take the tone color).
  Leading element is either a 6×6 round dot in the tone foreground color, or (if `icon`) a 16px icon in the tone
  foreground. `live=true` → dot pulses (§7.3).
- **ConnectionDot(tone, label?)**: row gap 6; 10×10 round halo (transparent) containing an 8×8 dot in tone
  foreground; optional `caption` label `textSecondary`. `.live` pulses the dot.
- **CountBadge(count, max=99)**: hidden when 0/null; shows `"99+"` above max. Pill min 16×16, padding 0 4, radius 999,
  bg `backgroundSelected`, `textSecondary`, 11px/500. Inside a sidebar nav row it collapses to plain text: no bg, no
  padding, 12px `textSecondary`.
- Tone dot `.to-tone-dot`: 8×8 round (6×6 inside status badges and terminal rows).
- Unread dot: 7×7 round, `accent`.
- `.to-avatar`: round, bg `backgroundSelected`, `text`, 10px/600. Agent avatar: 20×20 round, bg `accent`, fg
  `textOnAccent`.

### 6.7 Icon badge, empty badge (`widgets/icon.py`)
- `Icon(name, size = "md", color?)`: 16px default; color via `.to-fg-<token>`, otherwise inherits `currentColor`.
- `IconBadge`: 28×28, radius 6, bg `backgroundElement`, 1px `border`, icon `textSecondary` centered. `large`: 36×36,
  radius 8. Inside project cards: 32×32.
- `.to-empty-badge`: 56×56, radius 12, transparent, 2px `borderStrong`, `textSecondary`.

### 6.8 Feedback (`widgets/feedback.py`)
- **EmptyState(title, message?, icon?, loading?, actionLabel?, onAction?, secondaryLabel?, onSecondary?)**: column,
  gap 8, centered both axes, margin 40 24. Children in order: 24×24 spinner (only when `loading`), 48px icon in
  `textTertiary` (only when not loading and `icon` given; default icon name `empty` = FolderOpen; margin-bottom 4),
  title `h4` `textSecondary` centered wrapping, message `bodySmall` `textTertiary` centered wrapping, max ≈56 chars
  wide (hidden when empty), actions row gap 8 centered margin-top 8: primary `ActionButton` then `flat` secondary
  (row hidden if no actions).
- **Notice(message, title?, tone="neutral", icon?, actionLabel?, onAction?)**: row gap 10, padding 8 10, radius 8,
  1px `border`, transparent bg. 16px icon in tone foreground (default from tone, §2.3), vertically centered; body column
  gap 2: optional title `bodyStrong` in tone foreground, message `bodySmall` `textSecondary` wrapping; optional flat
  action button in tone foreground: min-height 24, padding 0 8, 12px. When it floats over the terminal: bg
  `surfaceElevated`, shadow level2, margin 12.

### 6.9 App chrome (window frame)
- Window bg `background` (`#09090A`). Sidebar pane bg `background` (sidebar sits directly on the window canvas).
- Content panel (`navigation-view.to-panel`): margin 8 8 8 0 (8 on the left too when the sidebar is collapsed),
  radius 8, 1px `border`, bg `surface` (`#121213`). This is the "inset" look.
- Titlebar (`headerbar.to-titlebar`): min-height 44, transparent; inner padding 8 8 8 12; start/end groups gap 2.
  Titlebar buttons 28×28, padding 0, radius 6, transparent, no border, `textSecondary`; hover `backgroundElement` +
  `text`; checked `backgroundSelected` + `text`. Page header variant: bottom inset 1px `divider`. Window unfocused
  (backdrop): title and brand opacity 0.7, window-control glyphs `textTertiary`. Caret icons 10px `textSecondary`;
  breadcrumb separators `textTertiary`. Titlebar divider: 1px wide, margin 6 4, `divider`.
- Window controls (custom drawn, order minimize, maximize, close; minimize/maximize only shown if the OS layout asks
  for them, close always): button 24×24, radius 6, gap 6, transparent, `textSecondary`; hover `backgroundElement` +
  `text`; active `backgroundSelected`; **close hover bg `dangerSolid`, glyph `#ffffff`; close active bg `danger`**.
  Glyph box 14×14, glyph 10×10, stroke 1.25 round caps: minimize = horizontal line through the middle; maximize =
  9×9 rounded rect (corner 1.5); restore = two offset (2px) rounded rects; close = X. Tooltips/labels: "Minimize",
  "Maximize", "Restore", "Close". In Electron: frameless window (`titleBarStyle: 'hidden'` on mac keeps native
  traffic lights; draw these controls on Linux/Windows), drag region = titlebar.
- Banner (`.to-banner`): no margin/radius, padding 4 12, bg `backgroundElement`, `text`, bottom inset 1px `border`;
  button radius 999 padding 0 12. Tone variants danger/warning/info: bg `<tone>Muted`, button bg `<tone>` with
  `textInverse` text.
- Resize handle between sidebar and content: 6px wide, transparent; hover/dragging shows inset right 1px
  `borderStrong` (box-shadow transitions 120ms).
- Scrollbars: overlay style, thumb 5px thick, margin 2, radius full, `ink_alpha 0.12`, hover `0.22`; no track.
  Terminal scrollbar: thumb 6px, `borderStrong`, margin 4 2.
- Separator: 1px `divider`.
- `.to-page`: padding 24 32 40 32. `.to-card`: padding 16, radius 10, no shadow; `.compact`: padding 12, radius 8.
- `.to-qr`: padding 12, radius 8, bg `#ffffff`.

### 6.10 Sidebar (`theme/extras/sidebar.py`)
Row height 28, row action size 22, resize handle 6.
- Body padding 0 8 12; group margin-bottom 12; section header min-height 28, margin-bottom 2; section toggle
  min-height 24, padding 0 8, radius 6, flat; on hover its overline text and caret become `text`.
- Nav rows: min-height 28, padding 0 8, radius 6, margin-bottom 1, `text`; hover `backgroundElement`; active and
  selected `backgroundSelected`; selected icons `text`.
- Side rows (projects): radius 6; hover `backgroundElement`. Main button = nav-row geometry, flat; pressed
  `backgroundSelected` + scale 0.98. Row action buttons: 22×22, margin-right 2, radius 4, `textSecondary`, hover
  `backgroundSelected` + `text`. Hover-only actions (`.to-side-hover`, `.to-side-section-action`): opacity 0, opacity 1
  on row/section hover or focus-visible (fades with the 120ms transition).
- Runs: list padding 1 0 4; run button min-height 26, padding 0 8, radius 6, hover `backgroundElement`; run label
  (`bodySmall`) turns `text` on hover or `.running`. Empty-runs margin 2/4. Count text 12px. Indicator icons
  `textSecondary`. Status line margin 4 8. Link button: margin 0 4, padding 0 4, min-height 24, `accentStrong`, 500,
  hover `backgroundElement`.
- Header: workspace switcher button min-height 28, padding 0 6, radius 6, flat, `text`; hover `backgroundElement`;
  open `backgroundSelected`. Brand logo 20px. Compose button: round, bg `backgroundElement`, `text`; hover
  `backgroundSelected`. Header left padding 8.
- Bottom: padding 4 8 8. Side composer: margin-bottom 4, padding 8 6 6 10, radius 8, 1px `border`, bg
  `color-mix(in srgb, var(--to-surface) 50%, var(--to-background))`; focus-within border `borderStrong`; text 13px;
  min text height 20; send button 24×24 round `accent`/`textOnAccent` (disabled `backgroundSelected`/`textTertiary`);
  attach 24×24 radius 6 `textSecondary`; project dropdown min-height 24, padding 0 6, radius 6, flat,
  `textSecondary`, label 12px, hover `backgroundElement`. Sidebar status button: min-height 32, padding 0 8,
  radius 6, flat, hover `backgroundElement`, press scale 0.98.

### 6.11 Progress (`widgets/progress.py`)
- **ProgressBar(progress | null, tone="info")**: height 4, full width; track = tone foreground at 20% alpha, fully
  rounded (radius = height/2); fill = tone foreground, width `max(width × progress, 4)` (skipped at 0). `null` →
  indeterminate (§7.3). In metric tiles the bar color is `accent` (`metric-violet` tiles: `warning`).
- CSS track/fill classes also exist: `.to-progress-track` 4px tall, radius full, bg `backgroundSelected`;
  `.to-progress-fill.tone-x` bg tone foreground.
- **ProgressRing(progress, size=40, thickness=3, color="accentStrong", showLabel=true, labelColor="textSecondary")**:
  track circle at 20% alpha; arc from 12 o'clock clockwise, round cap; centered `caption` label `"{round(p*100)}%"`.
- Spinners: GNOME `Adw.Spinner` (thin rotating arc, currentColor) at 24 (empty state), 16 (lists, forms), 14
  (composer busy, sidebar). Rebuild as a 1.5–2px stroked ~270° arc rotating linearly (~1 turn/s).

### 6.12 Surface & Pressable (`widgets/surface.py`)
- `Surface(tone="neutral", direction="column", gap=0, card=true, compact=false)`: `.to-surface.surface-<tone>` (+
  `.to-card`, `.compact`), `overflow: hidden`.
- `Pressable(child, onActivate, label?)`: unstyled button wrapper (padding 0, no bg/border, radius 10); tooltip =
  label; child surface gets hover `backgroundElement` / active `backgroundSelected` (background-image none) and the
  whole thing scales to 0.98 on press. Metric tiles and project cards use it.

### 6.13 Misc shared classes
- `.to-log-view`: radius 8, 1px `border`, bg `codeBackground` (project detail overrides to `background`), text padding
  12 (detail: 10 12, 12px), mono font.
- `.to-jump-button` ("scroll to bottom"): 28×28 round, bg `surfaceElevated`, 1px `borderStrong`, `text`, shadow level2.
- `.to-sparkline`: min-height 32. `.to-brand-mark`: radius 6. `.to-section-title`: margin-bottom 2;
  `.to-section-header`: min-height 28. `.to-sidebar-footer`: padding 8.
- `.to-metric-tile`: padding 12 14, 1px `border`, radius 10, transparent, min-height 72.
- Series toggle (chart legend): min-height 24, padding 0 10, radius 999, 1px `border`, transparent, opacity 0.5;
  hover bg `backgroundElement` + opacity 0.8; checked opacity 1. Transition `opacity 150ms ease, background 150ms ease,
  border-color 150ms ease`.
- `.to-resource-history`: padding 12 16 8, 1px `border`, radius 10; `.to-timeseries` margin-top 12.

Area-specific recipes (agents conversation/composer, projects list/cards/detail/sync review, terminal, display/VNC)
live in `theme/extras/{agents,projects,terminal,display}.py`; their numbers are summarized in Appendix B so page specs
can reference them.

---

## 7. Motion

### 7.1 Tokens
Durations (ms): `instant 0, fastest 60, fast 120, normal 180, slow 260, slower 400, slowest 720`.

Easings (cubic-bezier):
| name | value |
|---|---|
| standard | `cubic-bezier(0.2, 0, 0, 1)` |
| decelerate | `cubic-bezier(0, 0, 0, 1)` |
| accelerate | `cubic-bezier(0.3, 0, 1, 1)` |
| emphasized | `cubic-bezier(0.2, 0, 0, 1)` |
| overshoot | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| linear | `cubic-bezier(0, 0, 1, 1)` |

Press scales: control `0.95`, card `0.98`.
Derived: chart reveal 1440ms, live pulse 2880ms, chart stream 14400ms, pulse opacity floor 0.35, shimmer cycle 1440ms,
dot-sphere turn period 7200ms.

### 7.2 State transitions (what animates)
Applied to: buttons, menu items, activatable rows, nav/conversation/record list rows, tabs, inputs, `.to-card`,
`.to-surface`, `.to-side-row`, banners, `.to-composer`:
`transition: background, color, border-color, box-shadow, opacity, filter, outline-color, outline-width,
outline-offset, transform — each 120ms cubic-bezier(0.2, 0, 0, 1)`.
- Press: every `button:active` → `transform: scale(0.95)`; card-like presses (pressable cards, sidebar row main
  button, sidebar run, sidebar status) → `scale(0.98)`. Scale returns over the same 120ms.
- Hover-revealed actions (sidebar row/section actions, terminal row delete, code-block copy actions, tool-call
  chevron) fade opacity 0→1 via the same 120ms transition.
- Composer border-color 120ms standard; resize-handle box-shadow 120ms standard.
- VNC view dimming: `opacity 200ms ease-out` (0.3 when dimmed).
- Chart series toggle: 150ms `ease` on opacity/background/border-color.

### 7.3 Continuous animations (keyframes)
- `to-pulse` (live status dots: `.to-status-badge.live .to-tone-dot`, `.to-connection-halo.live .to-tone-dot`,
  `.to-tone-dot.live`): opacity `1 → 0.35 (50%) → 1`, 2880ms, `cubic-bezier(0.2, 0, 0, 1)`, infinite.
- `to-shimmer` (indeterminate progress bar): element gets
  `background-image: linear-gradient(to right, transparent, currentColor, transparent); background-size: 40% 100%;
  background-repeat: no-repeat; border-radius: 999px`, animating `background-position` from `-100% 0` to `200% 0`,
  1440ms linear infinite (the 20%-alpha track is still drawn underneath).
- Dot sphere ("work in progress" globe, `widgets/dot_sphere.py`): 24 dots on a Fibonacci sphere (golden angle),
  rotated about the vertical axis; one turn per 7200ms, quantized to 90 frames per turn (steps, not smooth); dot radius
  `max(1, size/20)` scaled by `0.45 + depth × 0.55`; dots grouped into 5 depth bands with opacity
  `0.12 + ((band + 0.5)/5) × 0.88`; color = `text` token by default. Only spins while visible and animations enabled;
  otherwise holds still. Draw on `<canvas>`.
- Unused keyframes defined but never applied (do not port unless needed): `to-rise` (opacity 0 + translateY(12px) →
  none), `to-float` (translateY 0 → -5px → 0), `to-twinkle` (icon scale 1 → 1.18 + rotate 12° + opacity 0.7 → back).

### 7.4 View transitions
- Crossfade stacks (page content swaps, preferences pages): crossfade 180ms.
- Revealers (sidebar search row, conversation tool-call details): slide-down 180ms. Fullscreen display toolbar
  revealer: crossfade 180ms.
- View stacks (main navigation): enabled transitions, 180ms crossfade.
- Implementation suggestion (motion library): `AnimatePresence` with opacity 0↔1, 180ms, ease `[0.2, 0, 0, 1]`;
  slide-down = height auto + opacity, 180ms. The brief allows 120–220ms ease-out micro-animations; the tokens above
  already fall in that band — use them rather than inventing new values. Optional polish allowed by the brief (not
  in GTK): popover/menu/tooltip enter = opacity 0→1 + scale 0.98→1, 120ms standard; dialog enter = opacity +
  scale 0.98→1 + scrim fade, 180ms.

### 7.5 Reduced motion
GTK honors `gtk-enable-animations` (dot sphere checks it explicitly; GTK disables CSS transitions globally). In
Electron: under `@media (prefers-reduced-motion: reduce)` set transitions/animations to ~0ms, disable press scale,
stop the dot sphere and pulse (keep dots fully opaque), and replace the indeterminate shimmer with a static 40%
segment; in motion use `useReducedMotion()` / `MotionConfig reducedMotion="user"`.

---

## 8. Icons

### 8.1 Rendering spec
- Lucide **1.52.0** (`lucide-static`) glyphs, rendered at **16×16** from the 24×24 viewBox with `stroke-width 2`,
  round caps/joins, `fill none`, colored by `currentColor` (GTK "symbolic" recoloring). In `lucide-react`:
  `<Icon size={16} strokeWidth={2} />` (do not set `absoluteStrokeWidth`; the GTK files keep stroke 2 in the 24-unit
  space → ≈1.33px on screen). Other sizes per §4.3 (24/32/48/64) scale the same way.
- Default icon color = inherited text color; most chrome icons are `textSecondary`, turning `text` on hover/selected.
- Pin the `lucide-react` version so glyphs match 1.52.0 shapes (e.g. a `lucide-react` release with the same icon
  set; verify `CircleAlert`, `ChartColumn`, `SquarePen`, `GitCommitHorizontal` exist under those names).

### 8.2 Semantic name → GTK icon → lucide-react component

| app name | GTK icon | lucide-react |
|---|---|---|
| overview | `lc-house-symbolic` | `House` |
| sandbox | `lc-box-symbolic` | `Box` |
| host | `lc-monitor-symbolic` | `Monitor` |
| projects, project | `lc-box-symbolic` | `Box` |
| processes, terminal | `lc-square-terminal-symbolic` | `SquareTerminal` |
| builds | `lc-hammer-symbolic` | `Hammer` |
| artifacts | `lc-package-symbolic` | `Package` |
| files | `lc-files-symbolic` | `Files` |
| save | `lc-download-symbolic` | `Download` |
| agents | `lc-mouse-pointer-2-symbolic` | `MousePointer2` |
| inbox | `lc-inbox-symbolic` | `Inbox` |
| display | `lc-monitor-symbolic` | `Monitor` |
| ports, browser | `lc-globe-symbolic` | `Globe` |
| usage | `lc-chart-column-symbolic` | `ChartColumn` |
| sessions | `lc-history-symbolic` | `History` |
| context, file-pdf | `lc-file-text-symbolic` | `FileText` |
| pair | `lc-qr-code-symbolic` | `QrCode` |
| appearance | `lc-sun-moon-symbolic` | `SunMoon` |
| settings | `lc-settings-symbolic` | `Settings` |
| connection | `lc-plug-symbolic` | `Plug` |
| microphone | `lc-mic-symbolic` | `Mic` |
| cpu | `lc-cpu-symbolic` | `Cpu` |
| memory | `lc-memory-stick-symbolic` | `MemoryStick` |
| disk | `lc-hard-drive-symbolic` | `HardDrive` |
| network | `lc-network-symbolic` | `Network` |
| uptime | `lc-clock-symbolic` | `Clock` |
| version, info | `lc-info-symbolic` | `Info` |
| offline | `lc-cloud-off-symbolic` | `CloudOff` |
| error | `lc-circle-alert-symbolic` | `CircleAlert` |
| warning | `lc-triangle-alert-symbolic` | `TriangleAlert` |
| success, status-done | `lc-circle-check-symbolic` | `CircleCheck` |
| failed, status-canceled | `lc-circle-x-symbolic` | `CircleX` |
| refresh | `lc-refresh-cw-symbolic` | `RefreshCw` |
| menu | `lc-menu-symbolic` | `Menu` |
| more | `lc-ellipsis-symbolic` | `Ellipsis` |
| archive | `lc-archive-symbolic` | `Archive` |
| unarchive | `lc-archive-restore-symbolic` | `ArchiveRestore` |
| add | `lc-plus-symbolic` | `Plus` |
| stop | `lc-square-symbolic` | `Square` |
| play | `lc-play-symbolic` | `Play` |
| down | `lc-arrow-down-symbolic` | `ArrowDown` |
| sync, sync-from-host | `lc-cloud-download-symbolic` | `CloudDownload` |
| sync-to-host | `lc-cloud-upload-symbolic` | `CloudUpload` |
| revert | `lc-undo-2-symbolic` | `Undo2` |
| copy, issues | `lc-copy-symbolic` | `Copy` |
| rename | `lc-pencil-symbolic` | `Pencil` |
| external | `lc-external-link-symbolic` | `ExternalLink` |
| search | `lc-search-symbolic` | `Search` |
| docker | `lc-container-symbolic` | `Container` |
| empty | `lc-folder-open-symbolic` | `FolderOpen` |
| send | `lc-arrow-up-symbolic` | `ArrowUp` |
| compose | `lc-square-pen-symbolic` | `SquarePen` |
| chat | `lc-message-circle-symbolic` | `MessageCircle` |
| branch | `lc-git-branch-symbolic` | `GitBranch` |
| commit | `lc-git-commit-horizontal-symbolic` | `GitCommitHorizontal` |
| tool | `lc-wrench-symbolic` | `Wrench` |
| keyboard | `lc-keyboard-symbolic` | `Keyboard` |
| fullscreen | `lc-maximize-2-symbolic` | `Maximize2` |
| exit-fullscreen | `lc-minimize-2-symbolic` | `Minimize2` |
| fit, my-issues | `lc-scan-symbolic` | `Scan` |
| view-only | `lc-eye-symbolic` | `Eye` |
| back | `lc-arrow-left-symbolic` | `ArrowLeft` |
| forward | `lc-arrow-right-symbolic` | `ArrowRight` |
| expand, caret-down | `lc-chevron-down-symbolic` | `ChevronDown` |
| collapse, caret-right | `lc-chevron-right-symbolic` | `ChevronRight` |
| chevron-left | `lc-chevron-left-symbolic` | `ChevronLeft` |
| sidebar | `lc-panel-left-symbolic` | `PanelLeft` |
| details | `lc-panel-right-symbolic` | `PanelRight` |
| delete | `lc-trash-2-symbolic` | `Trash2` |
| close | `lc-x-symbolic` | `X` |
| filter | `lc-list-filter-symbolic` | `ListFilter` |
| display-options | `lc-sliders-horizontal-symbolic` | `SlidersHorizontal` |
| notifications | `lc-bell-symbolic` | `Bell` |
| favorite | `lc-star-symbolic` | `Star` |
| views | `lc-layers-symbolic` | `Layers` |
| status-backlog | `lc-circle-dashed-symbolic` | `CircleDashed` |
| status-todo | `lc-circle-symbolic` | `Circle` |
| status-progress | `lc-circle-dot-symbolic` | `CircleDot` |
| status-done-all | `lc-check-check-symbolic` | `CheckCheck` |
| assignee | `lc-circle-user-symbolic` | `CircleUser` |
| label | `lc-tag-symbolic` | `Tag` |
| link | `lc-link-symbolic` | `Link` |
| check | `lc-check-symbolic` | `Check` |
| whats-new, fix-ai | `lc-sparkles-symbolic` | `Sparkles` |
| team | `lc-square-user-symbolic` | `SquareUser` |
| minus | `lc-minus-symbolic` | `Minus` |
| help | `lc-circle-help-symbolic` | `CircleHelp` |
| logout | `lc-log-out-symbolic` | `LogOut` |
| file-code | `lc-file-code-symbolic` | `FileCode` |
| file-archive | `lc-file-archive-symbolic` | `FileArchive` |
| smartphone | `lc-smartphone-symbolic` | `Smartphone` |
| app-window | `lc-app-window-symbolic` | `AppWindow` |
| paste | `lc-clipboard-symbolic` | `Clipboard` |
| clear | `lc-eraser-symbolic` | `Eraser` |
| screenshot | `lc-camera-symbolic` | `Camera` |
| confidential | `lc-lock-symbolic` | `Lock` |
| shuffle | `lc-shuffle-symbolic` | `Shuffle` |
| attach | `lc-paperclip-symbolic` | `Paperclip` |
| image | `lc-image-symbolic` | `Image` (alias as `ImageIcon` to avoid clashing with DOM `Image`) |
| images | `lc-images-symbolic` | `Images` |
| file | `lc-file-symbolic` | `File` |
| audio | `lc-audio-waveform-symbolic` | `AudioWaveform` |

Non-Lucide icons:
| app name | GTK icon | Electron |
|---|---|---|
| brand | `tesseract-brand-symbolic` | custom SVG (copy path below), 16×16 viewBox, `fill: currentColor`; sidebar brand logo at 20px |
| window-minimize / maximize / restore / close | `window-*-symbolic` (unused at runtime; custom-drawn glyphs per §6.9) | draw the glyphs as inline SVG per §6.9 |

Brand mark path (viewBox `0 0 16 16`):
`M8 1.5c-.6 0-1 .3-1.3.8L1.7 12.4c-.4.8.1 1.6 1 1.6.4 0 .8-.2 1-.6L8 5.1l4.3 8.3c.2.4.6.6 1 .6.9 0 1.4-.8 1-1.6L9.3 2.3C9 1.8 8.6 1.5 8 1.5z`

Framework logos (Simple Icons **13.21.0**, CC0, single-color, viewBox 24, rendered 16×16 with `fill: currentColor`;
copy the path data from `apps/desktop/data/icons/hicolor/scalable/actions/logo-*-symbolic.svg` or from `simple-icons`):

| framework | slug / file |
|---|---|
| `expo`, `react-native` | `react` → `logo-react-symbolic.svg` |
| `electron` | `electron` |
| `vite` | `vite` |
| `next` | `nextdotjs` |
| `node` | `javascript` |
| `android` | `android` |
| `python` | `python` |
| `flutter` | `flutter` |
| `unknown` / none | falls back to the `project` icon (`Box`) |

In the conversation list, the project logo is 12px in `textTertiary`.

---

## 9. GTK quirks NOT to copy

1. `-gtk-icon-size`, `-gtk-icon-transform`, `min-width`/`min-height` as sizing on every box — use normal `width`/
   `height`/`min-*` and flex.
2. Pixel-scaling the whole stylesheet with a regex for zoom (`scale_css`) — use `webContents.setZoomFactor`.
3. Icon fallback chains (`resolve_icon` tries `lc-*`, then Adwaita names) — Electron ships Lucide, no fallbacks.
4. Runtime font registration via PangoCairo and the "installed-first" stack reordering — use `@font-face`.
5. The `_user_css_shield` rules (`window.background`, `list.boxed-list` resets, `--card-shade-color`, `color-mix`
   hover on boxed rows) exist only to neutralize a user's `~/.config/gtk-4.0/gtk.css` and libadwaita defaults. Port
   the resulting look (§6.4/§6.5), not the rules.
6. Adwaita variable bridge (`--accent-bg-color`, `--window-bg-color`, `--sidebar-bg-color`, …) — not needed.
7. Degenerate radial gradients on flat surfaces (§2.4) and the 3-stop solid "wash"/"brand" gradients — use solid colors.
8. `SQUARE_CORNERS`/`CORNER_SHAPES` "square" override — identical to the base radii; ignore.
9. Legacy `light`/`dark` (periwinkle, "classic") schemes — never rendered; don't implement.
10. Half-pixel offsets in window-control glyph drawing (`floor(...) + 0.5`) — a Cairo crispness trick; in SVG use
    `shape-rendering: geometricPrecision` with integer-aligned boxes.
11. `outline-offset: -2px` hacks exist because GTK clips outlines; in CSS keep the visual (inset ring) but prefer
    `box-shadow: inset 0 0 0 1px` where clipping would occur (overflow-hidden lists).
12. Pango line-height comment: GTK needed px line-heights because unitless values scale off font metrics. CSS px
    line-heights from §3.2 are correct as-is.
13. `button:active { transform: scale(0.95) }` applies to *every* button in GTK, including large dialog buttons and
    titlebar buttons; keep it (it is the intended micro-interaction) but disable for text inputs/menus and under
    reduced motion.
14. Status badge / notice markup sets `tone-*` on the label too, but the label never takes the tone color (no
    `.to-tone-fg`); keep the label `textSecondary` as described — don't "fix" it.
15. `.to-status-badge` and `.to-notice` both get `.to-tone-bg` but are overridden to transparent; the tinted
    `<tone>Muted` fill is **not** shown. Only banners use muted fills.
16. Unused tokens (`level1` shadow, `rise`/`float`/`twinkle` keyframes, `backgroundPattern`, `shimmer` color) need
    not be wired to anything.

---

## Appendix A — legacy schemes (not rendered; reference only)

| token | light | dark |
|---|---|---|
| background | `#FCFCFB` | `#000000` |
| backgroundElement | `#F0F0F3` | `#212225` |
| backgroundSelected | `#E0E1E6` | `#2E3135` |
| surface | `#FCFCFB` | `#141416` |
| surfaceElevated | `#ffffff` | `#212225` |
| surfaceSunken | `#F8F9FB` | `#000000` |
| overlay | `rgba(0, 0, 0, 0.4)` | `rgba(0, 0, 0, 0.6)` |
| text / secondary / tertiary | `#000000` / `#60646C` / `#6E7079` | `#ffffff` / `#B0B4BA` / `#9C9EA8` |
| border / borderStrong / divider | `#E0E1E6` / `#CDCED6` / `#F0F0F3` | `#2E3135` / `#3E4148` / `#212225` |
| accent / pressed / muted / strong | `#C8BFF7` / `#A496EE` / `#EFEBFE` / `#7662DA` | `#C8BFF7` / `#D7D0FB` / `#221C3D` / `#D7D0FB` |
| textOnAccent / focusRing | `#261D53` / `#7662DA` | `#261D53` / `#D0C8F9` |
| success / muted / solid | `#1B7443` / `#E4F8EC` / `#2BA25F` | `#3DD68C` / `#0F2A1B` / `#2BA25F` |
| warning / muted / solid | `#8A5A00` / `#FDF3DC` / `#B98200` | `#F2C55C` / `#2C2109` / `#E0A020` |
| danger / muted / solid | `#C62A2F` / `#FDE9E9` / `#E5484D` | `#FF6369` / `#2E1213` / `#E5484D` |
| info / muted / solid | `#1567C4` / `#E6F4FE` / `#3C87F7` | `#7FB8FA` / `#0D2440` / `#3F8FE0` |

Decorative surfaces in these schemes used radial gradients (e.g. violet `#B66FCB → #7A2890` at 15%/10%, indigo
`#0D0C2B → #5B50C6` at 50%/55% r62%, yellow `#FBE25A → #EBC92B`) with white/ink overrides — irrelevant for graphite.

## Appendix B — area-specific numbers (for page specs)

**Agents** (`extras/agents.py`): pane bar min-height 44, padding 0 8 0 16, bottom 1px `border`. List right border
1px `border`; list content padding 4 8 24 8; search padding 8 12 0 12, search input min-height 28; group title padding
8 10 4 10. Conversation rows: padding 10 12, radius 8, margin 4 0; hover `backgroundElement`; selected
`backgroundSelected`; project tint washes §2.7. State glyph 16×16 (margin-top 1): succeeded `textSecondary`, failed
`danger`, cancelled `textTertiary`. Unread dot 7×7 `accent` (`.top` margin-top 6). Attention card padding 8 10 radius
6 hover `backgroundElement`; attention action min-height 24 padding 0 8 12px/500 `textSecondary` 1px `border`.
New-conversation page padding 48 24 24 24; card radius 12, 1px `border`, bg `surfaceElevated`. Composer: padding 10 12
8 12, radius 10, 1px `borderStrong`, bg `surfaceElevated`, focus border ink 0.2, drop-target border `accent` + bg
`accentMuted`; large variant padding 4 12 12 12, radius 12, no border/bg; locked input opacity 0.6. Send button 28×28
round `accent` (pill variant min-height 32 padding 0 14; disabled `backgroundSelected`/`textTertiary`; active
`accentPressed`). Attach button 28×28 round `textSecondary` (large: 32×32, 1px `border`, bg `backgroundElement`).
Attachments: pill padding 4 radius 8 1px `border` bg `surface`; thumb radius 8; failed border `danger`; icon tile 28×28
radius 6 `backgroundElement`; remove/action 20×20; floating remove bg `rgba(0, 0, 0, 0.55)` white. Project picker
min-height 28 padding 0 2 0 10 round 1px `border` hover `backgroundElement`, label 13/500 `textSecondary`. Message
inset 13; body indent 28 (20 avatar + 8). Timeline padding 20 24 48 24; notices padding 12 24 0 24; footer padding 8
24 16 24. User message padding 12, radius 8, 1px `border`, bg `surfaceElevated`. Tool header min-height 24 padding 2 13
radius 6; chevron hidden until hover. Tool details margin 4 13 4 41, padding 8 12, radius 8, 1px `border`,
`codeBackground`. Code block radius 8 1px `border` `codeBackground`, body padding 10 12, copy actions fade in on hover
(120ms). Copy button 24×24 bg `surfaceElevated`. Blockquote left 3px `borderStrong` padding-left 12. Markdown table
scroller radius 8 1px `border`, cells padding 8 12. Links `accentStrong`.

**Projects** (`extras/projects.py`): row height 40, group header 36, progress width 80, card min width 280. List
toolbar padding 8 12; pill tab min-height 28 padding 0 10 round 1px `border` transparent `textSecondary` (hover
`backgroundElement`/`text`; checked `backgroundSelected` + `borderStrong` + `text`); toolbar button 28×28 round 1px
`border`. Search margin 0 12 8 12 min-height 28 radius 6. List body padding 0 8 16 8. Group header padding 0 4 0 12
radius 6 bg `surfaceElevated`. Record row min-height 40 padding 0 8 0 12; divided lists have bottom 1px `divider`.
Hover actions container margin-right 4 padding 0 4 0 8 radius 6 bg `backgroundElement`; row action 24×24 radius 6
`textSecondary` (labeled: padding 0 8, 12px). Danger button hover `danger`. Project card surface padding 16 radius 10
1px `border` bg `surface`; hover `backgroundElement`; active `backgroundSelected`; focus border `borderStrong`. Project
tag padding 0 8 min-height 20 round 1px `border`. Detail body padding 20 24 40 24; property chip min-height 24 padding
0 10 round 1px `border`; tabs margin-top 20 padding-bottom 8 bottom `divider`. Sync review: diff gutter 44 wide; add
rows `successMuted` (+ sign `success`); del rows `dangerMuted` (− `danger`); hunk rows `infoMuted` with `info` text.

**Terminal** (`extras/terminal.py`): sidebar bg `surface` right 1px `divider`; heading min-height 44 padding 0 16;
launch split button 1px `border` pill, halves min-height 26 `textSecondary` 500; rows padding 7 4 7 8 margin 1 0
radius 6 (hover `backgroundElement`, selected `backgroundSelected`); ended rows opacity 0.6; delete button 24×24 radius
4 `textTertiary` hidden until hover/selected (hover `dangerMuted`/`danger`), replaces the 6px status dot. Toolbar
min-height 40, padding 0 8 0 12, bg `surface`, bottom `divider`, buttons 28×28 radius 6.

**Display** (`extras/display.py`): page bg `surface`; toolbar min-height 40 padding 0 8 0 12 bottom `divider`; toolbar
buttons 28×28 radius 6 transparent `textSecondary` (hover `backgroundElement`/`text`; checked `backgroundSelected`);
scale toggles min-height 26 padding 0 10 pill 1px `border` gap 4 (checked `backgroundSelected` + `borderStrong`);
preview padding 12; stage bg `background`; fullscreen bg `#000000`; overlay card radius 12 1px `border` bg
`surfaceElevated` shadow level3 margin 24.

**Overview** (`extras/overview.py`): section title 13/500 no margin; metric tiles §6.13; flat rows §6.5.
