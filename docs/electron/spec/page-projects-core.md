# Projects page (core): list, detail shell, dialogs, actions

Source of truth (GTK, read-only): `apps/desktop/monolith_desktop/pages/projects/{page,detail,model,labels,streams,create_dialog,rename_dialog,remove_action,fix_action,run_dialog}.py`, plus the shared widgets they use (`widgets/{project_card,list_view,feedback,form_dialog,dialog,confirm_dialog,log_panel,badges,buttons,choice_dropdown,surface,page_body,motion}.py`) and styles (`theme/css.py`, `theme/extras/{projects,dialogs,motion}.py`, `theme/tokens.py`, `theme/typography.py`, `theme/semantic.py`, `theme/palette.py`).

Out of scope here (other specs cover them): the detail tab bodies (Processes, Builds, Artifacts, Git, Sync back, Chats: `tab_*.py`, `sync_*.py`), the emulator launcher (`emulator.py`, `emulator_launch.py`), the window chrome / sidebar / page header bar, and the global toast host. This spec covers how the detail shell mounts those tabs and passes data to them.

All sizes are CSS px at zoom 1.0. Colors are given as semantic tokens and then resolved for the two rendered schemes: **dark = `graphite`**, **light = `graphiteLight`** (`RENDERED_SCHEMES` in `theme/semantic.py`). The `light`/`dark` "classic" palettes are not used.

---

## 1. Reference screenshots

All in `docs/electron/reference/`. They were captured with `apps/desktop/tools/snapshot.sh ... --zoom 1 --width 1440 --height 900`. **Broadway clamps the window to 1024x768**, so every PNG is 1024x768, not 1440x900. The data is **live** (the user's real sandbox `theone-sandbox`, 4 projects) and is not a fixture.

| File | What it shows |
|---|---|
| `page-projects-core-list.png` | Dark. Projects list, `All projects` tab selected with counts `4` / `Active 1` / `Idle 3`, search and group toggles on the right of the toolbar, 2-column card grid (the content width allows only 2 columns of min 280px plus gaps). Cards: `streaxfit` (Confidential lock badge in yellow, `1 running` green dot, branch `main`, yellow `Uncommitted changes`, commit row, tags `Web bundle`, `Build script`), `monolith`, `hybrid-pos` (long branch wraps the badge row), `sante-production` (commit date older than a week shows as `2026-09-21`). All cards in all rows have the same height (GTK FlowBox homogeneous). Header bar shows the `Projects` title with refresh and `+` buttons. |
| `page-projects-core-list-light.png` | The same view in light (`graphiteLight`): white cards `#FFFFFF` on a `#F5F5F6`-ish canvas, darker yellow `#8F6400` dots, green `#2E8A5B`. |
| `page-projects-core-detail.png` | Dark. Detail of project id `theone-mobile` (display name `monolith`). Crumb row: `theone-mobile` + mono path `/workspace/projects/theone-mobile` + copy / rename / delete icon buttons on the right. `h1` title `monolith`. Property chips: `Idle`, `Node · bun`, `main`, `92 changed` (yellow circle-dot), `Claude · claude-work`. Quick actions: indigo `Ask Claude`, `Claude terminal`, `Shell`, `Open on emulator` (Expo project, so the Display button became the emulator button), then the Claude account dropdown `Default (claude-work)` wrapped onto a second line. Tab strip: `Processes` (selected), `Builds`, `Artifacts`, `Git`, `Sync back 11`, `Chats 23`, then a hairline divider and the start of the Processes tab (out of scope). The header bar breadcrumb reads `Projects › theone-mobile` (see quirk Q1). |
| `page-projects-core-detail-light.png` | The same detail view in light. |
| `page-projects-core-create-dialog.png` | Dark. `New project` dialog over the list (`--params {"create":true}`): breadcrumb chip `[box] Projects › New project`, close X, large `Name` title input (placeholder), hint `Becomes a folder in /workspace/projects.`, `Clone from` group with `Git URL (optional)` and `Branch (optional)` fields, hint `Leave empty to create an empty project.`, `Confidential` chip with a lock, footer `Cancel` (left, flat) and indigo pill `Create` (right). The backdrop is dimmed. |
| `page-projects-core-detail-error.png` | Dark. Detail for a project id that does not exist (`monolith-test-missing`; a read-only GET that returned 404): centered warning triangle, `Couldn't load this project`, message `Project monolith-test-missing not found`, indigo `Try again` button. |

Not captured (no params reach them): grouped view, search revealer open, empty / offline / unauthorized states, rename / delete / run dialogs, clone progress page. They are specified below from code.

---

## 2. Design tokens used on this page

### 2.1 Colors (resolved)

| Token | Dark (`graphite`) | Light (`graphiteLight`) |
|---|---|---|
| `background` (window/page canvas) | `#09090A` | `#F5F5F6` |
| `surface` (project cards, form entries) | `#121213` | `#FFFFFF` |
| `surfaceElevated` (dialogs, secondary buttons, entries) | `#1A1A1B` | `#FFFFFF` |
| `backgroundElement` (hover) | `#1E1E20` | `#EEEEF0` |
| `backgroundSelected` (selected / pressed) | `#232325` | `#E7E7EA` |
| `text` | `#E3E3E4` | `#1B1B1F` |
| `textSecondary` | `#929294` | `#5C5D66` |
| `textTertiary` | `#6B6B6F` | `#7E7F88` |
| `border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| `borderStrong` | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.15)` |
| `divider` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` |
| `accent` / `focusRing` | `#5E6AD2` | `#5E6AD2` |
| `accentPressed` | `#4F5BC4` | `#4F5BC4` |
| primary hover | `#6C78E6` (`suggested-action`) / `brightness(1.1)` (`to-primary`) | same |
| `textOnAccent` | `#FFFFFF` | `#FFFFFF` |
| `success` / `successMuted` | `#4CB782` / `#14261C` | `#2E8A5B` / `#E5F4EC` |
| `warning` / `warningMuted` | `#F2C94C` / `#2B2410` | `#8F6400` / `#FBF2D9` |
| `danger` / `dangerSolid` | `#EB5757` / `#EB5757` | `#C93A3A` / `#EB5757` |
| `info` | `#4EA7FC` | `#1F6FCB` |
| `overlay` (dialog dimming) | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.28)` |
| text selection | `rgba(94,106,210,0.35)` | same |

Tone to color mapping (`theme/tone.py`). The foreground is used for dots, icons, and notice text. The muted background is **not** used by status badges (see 4.4):

| Tone | foreground | background |
|---|---|---|
| neutral | `textSecondary` | `backgroundElement` |
| info | `info` | `infoMuted` |
| success | `success` | `successMuted` |
| warning | `warning` | `warningMuted` |
| danger | `danger` | `dangerMuted` |

### 2.2 Typography (`TEXT_VARIANTS`)

Fonts: sans `Inter`; display `Inter Display`; mono `Geist Mono` (from `apps/desktop/data/fonts`). The base size is 13px.

| Variant | size / line-height | weight | family | letter-spacing |
|---|---|---|---|---|
| `h1` | 24 / 30 | 600 | display | -0.4px |
| `h3` | 15 / 20 | 600 | display | -0.2px |
| `h4` | 14 / 20 | 500 | sans | 0 |
| `body` | 13 / 20 | 400 | sans | 0 |
| `bodyStrong` | 13 / 20 | 500 | sans | 0 |
| `bodySmall` | 12 / 18 | 400 | sans | 0 |
| `label` | 13 / 18 | 500 | sans | 0 |
| `caption` | 12 / 16 | 400 | sans | 0 |
| `overline` | 12 / 16 | 500 | sans | 0 |
| `code` | 12 / 18 | 400 | mono | 0 |

### 2.3 Spacing, radii, controls, motion

- Spacing scale: `xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32, 3xl 40`.
- Radii (graphite is the "square" corner shape, which only changes `card 10, sheet 12, pill 999`, the same values as the soft shape): `xs 4, sm 6, md 8, lg 10, xl 12, card 10, pill 999`.
- Control heights: `xs 24, sm 28, md 32, lg 36, xl 44`.
- Icons are Lucide at 16px everywhere on this page (`xs`/`sm`/`md` are all 16px). The empty-state glyph is `2xl` = 48px.
- Hairline borders are `1px solid`.
- Durations: `fast 120ms`, `normal 180ms`, `slow 260ms`. Easing `standard = cubic-bezier(0.2, 0, 0, 1)`.
- GTK motion to reproduce:
  - Every button, entry, card, and surface transitions `background, color, border-color, box-shadow, opacity, filter, outline-*, transform` over 120ms standard.
  - `button:active` scales to `0.95`. A project card (`.to-pressable:active`) scales to `0.98`.
  - All view swaps (list loading/content, detail loading/content, detail tab stack, dialog form/progress page) are **crossfades of 180ms**.
  - The search field is a plain `Gtk.Revealer` (GTK default: slide-down, 250ms); in Electron use 180ms height+opacity.
  - Live status dots pulse: opacity 1 → 0.35 → 1, period 2880ms (`720*4`), standard easing, infinite.
- Electron: use `motion` with 120 to 220ms ease-out, and drop all of it under `prefers-reduced-motion: reduce` (crossfades become instant, no press scale, no pulse).

### 2.4 Lucide icon names used

`projects`/`project` = `box`, `refresh` = `refresh-cw`, `add` = `plus`, `filter` = `list-filter`, `display-options` = `sliders-horizontal`, `agents` = `mouse-pointer-2`, `branch` = `git-branch`, `sync` = `cloud-download`, `commit` = `git-commit-horizontal`, `confidential` = `lock`, `status-todo` = `circle`, `status-progress` = `circle-dot`, `status-done` = `circle-check` (via `status_glyph`), `copy` = `copy`, `rename` = `pencil`, `delete` = `trash-2`, `terminal` = `square-terminal`, `display` = `monitor`, `smartphone` = `smartphone`, `shuffle` = `shuffle`, `search` = `search`, `offline` = `cloud-off`, `warning` = `triangle-alert`, `error` = `circle-alert`, `info` = `info`, `success` = `circle-check`, `close` = `x`, `caret-right` = `chevron-right`.

---

## 3. Data model

### 3.1 Controller types (subset)

```ts
type Framework = "expo" | "react-native" | "electron" | "vite" | "next" | "node" | "android" | "python" | "flutter" | "unknown";
interface GitSummary { branch: string | null; dirty: boolean; ahead: number; behind: number;
  lastCommit: { sha: string; subject: string; author: string; date: string } | null }
interface Project { id: string; name: string; path: string; framework: Framework; packageManager: string | null;
  scripts: string[]; buildTargets: string[]; git: GitSummary | null; confidential?: boolean; claudeAccountId?: string | null }
interface CreateProjectResponse { project: Project; processId?: string }   // processId present when cloning
interface DeletedProject { id: string; trashPath: string }
interface ClaudeAccountList { defaultAccountId: string; accounts: { id: string; account: { email?: string } | null }[] }
interface SyncChanges { projectId: string; baselineAt: string | null; changes: { path: string; ... }[]; totalBytes: number;
  host: { name: string } | null; lastGetAt?: string | null }
// LIVE_PROCESS_STATES = ["starting","running"]; FINAL_BUILD_STATES = ["succeeded","failed","cancelled"]
```

`ProcessInfo` (`id, projectId, state, startedAt, endedAt, exitCode, port, display, pid, name, command`), `BuildJob` (`id, projectId, state, createdAt, startedAt, endedAt, target, profile, stage, progress, artifacts, error`), `AgentRun` (`id, projectId, state, startedAt, endedAt`), `Artifact`, `ClaudeSession`, `RunTargetInfo`, `AppRun` come from `packages/protocol`.

### 3.2 Constants (put them in a `constants.ts` next to the components)

```
PROJECTS_ROOT = "/workspace/projects"
DEFAULT_PACKAGE_MANAGER = "npm"
LIST_ACTIVITY_INTERVAL_MS = 15000          // list page poll of processes + builds
DETAIL_REFRESH_INTERVAL_MS = 15000         // detail poll
SESSION_LIMIT = 50                         // chats fetched per project
BRANCH_CHARS = 40                          // detail branch chip truncation
SEARCH_SHORTCUT = Ctrl+F (Cmd+F on macOS)
PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/   PROJECT_ID_MAX_LENGTH = 64
GIT_URL_PATTERN = /^(?:https?:\/\/|ssh:\/\/|git:\/\/|file:\/\/|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:)\S+$/
GIT_REF_PATTERN = /^(?![-/.])(?!.*\.\.)[A-Za-z0-9._/-]{1,255}$/
MAX_NAME_LENGTH = 128  MAX_GIT_URL_LENGTH = 2048  MAX_COMMAND_LENGTH = 16384  PORT 1..65535
SHELL_SAFE_WORD = /^[\w.:@/+=-]+$/
GUI_FRAMEWORKS = {"electron"}              // Run dialog's display chip defaults on
ANDROID_FRAMEWORKS = ["expo","react-native","android"]
DEFAULT_CLAUDE_ACCOUNT = ""                // option id for "Default (...)"
REMOVAL_PATH_PREVIEW = 3
FIX_LOG_TAIL = 150
LOG_SNAPSHOT_TAIL = 500  LOG_SNAPSHOT_INTERVAL_MS = 2000
CLONE_LOG_HEIGHT = 260
CARD_MIN_WIDTH = 280  GRID_MAX_COLUMNS = 3
```

### 3.3 Pure functions (port these 1:1 from `model.py` into `projects/model.ts` with unit tests)

- `projectIdFromName(name)`:
  1. Lowercase and trim.
  2. Replace `[^a-z0-9._-]+` with `-`.
  3. Collapse `-{2,}` to `-`.
  4. Strip leading `[._-]+`.
  5. Cut to 64 characters.
  6. Strip trailing `[._-]+`.
  7. Return the result if it matches `PROJECT_ID_PATTERN`, else `null`.
- `validateProjectDraft({name, gitUrl, branch, confidential}, existingIds)`. Trim all fields. Errors are keyed by `name`, `git_url`, and `branch`:
  - Name: empty gives `name_required`. Longer than 128 gives `name_too_long`. No id gives `name_invalid`. An id in `existingIds` gives `name_exists`.
  - Git URL: if non-empty and (longer than 2048 or no pattern match), gives `git_url`.
  - Branch: if non-empty and the URL is empty, gives `branch_needs_url`. Otherwise, no ref-pattern match gives `branch_invalid`.
  - The result is `{errors, projectId, name, gitUrl|null, branch (only if gitUrl)|null, confidential}`. `ok` means no errors and a projectId is set.
- `locationHint(name)`: `Created as {root}/{id}` when an id can be derived, else `Becomes a folder in {root}.`
- `createLabel(gitUrl)`: `Clone` if the trimmed URL is non-empty, else `Create`.
- `isConflict(err)`: an ApiError with status 409 or code `"conflict"`.
- `cloneOutcome(code, finished)`:
  - Not finished: `("Cloning", info, "")`.
  - Code 0: `("Cloned", success, "The repository is ready.")`.
  - Otherwise: `("Failed", danger, reason + " " + "The project folder stays in place, so you can open it and retry from a shell.")`. The reason is `git stopped before it finished.` when the code is null, else `git exited with code {code}.`
- `renameError(name)`: `name_too_long` if the trimmed name is longer than 128. `renameValue(name)`: the trimmed name, or `null` when blank (null resets to the detected name).
- `removalPrompt(name, sync)`:
  - `host` is `sync.host?.name`, falling back to `"your computer"`.
  - If `baselineAt == null`: heading `Only copy of this project`, body `only_copy_body`, confirm `Force delete`, `force=true`.
  - Else if there are changes: heading `Unsynced changes`, body `unsynced_body`, `force=true`, confirm `Force delete`. In the body:
    - `files` is `"{n} file"` or `"{n} files"`.
    - `verb` is `is` for 1 change and `are` otherwise.
    - `paths` is the first 3 paths joined with `", "`. When there are more, it becomes `"{paths} and {extra} more"`.
  - Else: heading `Delete {name}?`, body `It moves to /tmp in the sandbox. The project on {host} is not touched.`, confirm `Delete`, `force=false`.
- `validateProcessDraft({command, name, port, display}, projectId)`:
  - Command: empty gives `command_required`. Longer than 16384 gives `command_too_long`.
  - Name: longer than 128 gives `name_too_long` (key `name`).
  - Port: a non-empty value that is not all digits or is outside 1..65535 gives `port_invalid`.
  - The body is `{projectId, command, name?, port?, display?: true}`.
- `prefersDisplay(framework)`: `framework === "electron"`.
- `frameworkLabel(f)`: the `FRAMEWORKS[f]` entry, falling back to `"Project"`.
- `targetLabel(t)`: the `BUILD_TARGETS[t][0]` entry, else `t`.
- `joinMeta(...parts)`: the truthy parts joined with `" · "` (U+00B7 with spaces).
- `formatRelativeTime(iso, now)`:
  - Under 45s: `just now`.
  - Under 1h: `{max(1, round(min))}m ago`.
  - Under 1d: `{floor h}h ago`.
  - Under 1w: `{floor d}d ago`.
  - Otherwise: the date `YYYY-MM-DD` in UTC.
  - An empty or unparseable value gives `""`.
- `syncLabel(ahead, behind)`: the parts `↑{ahead}` and `↓{behind}`, keeping only non-zero ones, joined by a space. The result is `null` when it is empty.
- `dirtyBadge(git, changes?)`:
  - No git: `null`.
  - Not dirty: `("Clean", success)`.
  - Dirty: `("{n} changed", warning)` if `changes` is truthy, else `("Uncommitted changes", warning)`.
- `projectActivity(id, processes, builds, runs)`. `running` counts the project's live processes. The first match wins:
  1. Any run with state `running`: `agent`, `Claude working`, info.
  2. Any non-final build: `building`, `Building`, info.
  3. `running > 0`: `running`, `{count} running`, success.
  4. Otherwise: `idle`, `Idle`, neutral.
- `activityTimestamp(project, ...)`: the maximum of `git.lastCommit.date`, the process `startedAt`/`endedAt` values, the build `createdAt`/`endedAt` values, and the run `startedAt`/`endedAt` values for that project (0 if none).
- `sortProjects(projects, processes, builds, runs)`: busy (activity is not idle) first, then by newest `activityTimestamp`, then by `name.toLowerCase()`.
- `matches(project, query)`:
  - Split the lowercased query on whitespace. Every token must be a substring of the haystack.
  - The haystack joins name, id, framework label, git branch, packageManager, each buildTarget **id** (not label), and `Confidential` when the project is confidential.
  - An empty query matches everything.
- `inTab(activity, tab)`: `active` means not idle, `idle` means idle, `all` is always true.
- `groupByActivity(cards)`: buckets in the order `agent, building, running, idle`, with empty buckets dropped.
- `cardModel(project, processes, builds, runs, now)`:
  - `id`.
  - `title` = `name || id`.
  - `subtitle` = `joinMeta(frameworkLabel, packageManager, id)`.
  - `activity`.
  - `branch` = `git ? (git.branch || "detached") : "Not a git repository"`.
  - `sync` = `git ? syncLabel : null`.
  - `dirty` = `dirtyBadge(git)`.
  - `commit` = `lastCommit ? (subject || null) : (git ? "No commits yet" : null)`.
  - `commitWhen` = the relative time of `lastCommit.date`.
  - `tags` = each `targetLabel` of buildTargets.
  - `confidential` = `("Confidential", warning)` or null.
- Per-project list helpers (detail):
  - `projectProcesses`: newest `startedAt` first, then live processes ahead of ended ones (a stable sort).
  - `projectBuilds` and `projectArtifacts`: newest `createdAt` first.
  - `runningCount`: the number of live processes.
  - `activeBuildCount`: the number of non-final builds.
- `claudeAccountOptions(project, accounts)`:
  - Start with `[("", "Default ({defaultAccountId})")]`.
  - Add one entry per profile: `(id, joinMeta(id, email))`.
  - If the project is pinned to an unknown id, append `(pinned, pinned)`.
- `claudeAccountLabel(project, accounts)`: `Claude · {effective}`, where effective is `project.claudeAccountId || accounts.defaultAccountId`. It is null when there is no account.
- `failurePrompt(subject, lines, command?, exitCode?, error?)`. The parts are joined with a blank line (`\n\n`), and empty parts are skipped:
  1. `"{subject} failed. Find the cause and fix it, then run it again to confirm it works."`
  2. The fact lines, joined by `\n`:
     - ``"Command: `{command}`"``
     - `"Exit code: {code}"`
     - `"Error: {error}"`
  3. The log: ``"Last {n} log lines:\n```\n{log}\n```"`` or `"No log output was captured."`.
  - The log is the last 150 lines, each `clean_log_text(line.text)`, joined with `\n` and trimmed.
  - Process subject: `` `{name || id}` ``, plus command and exitCode.
  - Build subject: `The {targetLabel} {profileLabel.lower()} build`, with whitespace collapsed, plus `error`.
- `logStatus(state, exitCode?, ended?)`:
  - If ended: `Stopped` (neutral) when there is no code, else `Exited {code}` (success when 0, danger otherwise).
  - `open`: `Live`, success, pulsing.
  - `connecting`: `Connecting`, warning.
  - Anything else: `Ended`, neutral.

---

## 4. Projects list page

### 4.1 Page registration and header

- Page id `projects`, title `Projects`, icon `box`, sidebar section `sandbox`, order 20.
- Header-bar end widgets (rendered by the window chrome, flat 28x28 icon buttons) are, in order:
  1. `refresh-cw`, tooltip `Refresh`. This calls `workspace.refresh()` and forces the activity poll.
  2. `plus`, tooltip `New project`. This opens the Create dialog.
- `open(params)`:
  - `params.create` opens the Create dialog.
  - `params.projectId` (a non-empty string) pushes the detail view, optionally with `params.tab`.
- `onShown` calls `workspace.refresh()`, which refetches `GET /v1/projects` (and the agent runs) into the shared store.

### 4.2 Layout (top to bottom inside the page content area)

The root is a crossfade stack with two children: `state` (EmptyState) and `content`.

`content` is a vertical box:

1. **List toolbar** `.to-list-toolbar`: padding `8px 12px 8px 12px`, horizontal, gap 8.
   - Start (hexpand, gap 8, vertically centered) holds the **PillTabs** with the options `all: "All projects"`, `active: "Active"`, `idle: "Idle"`. The aria-label is `Project filter`.
   - End (gap 2) holds two **toolbar toggles**, in this order:
     1. `list-filter` (tooltip and aria `Search projects`, initially off).
     2. `sliders-horizontal` (tooltip `Group by status`, initially off).
2. **Search revealer**, initially collapsed. Inside is a search input `.to-list-search` with placeholder `Search projects`, full width, margin `0 12px 8px 12px`, min-height 28, radius 6. The rest of the entry style is the global entry: background `surfaceElevated`, 1px `border`, and on focus a border of `accent` plus a 1px `focusRing` outline at offset 1. It has a leading search glyph and a clear button (GTK SearchEntry).
   - Typing filters live (`search-changed` is GTK's ~150ms debounced signal, so debounce about 150ms).
   - `Esc` (stop-search) turns the search toggle off.
   - Turning the toggle on reveals the field and focuses it. Turning it off hides it and **clears the text** if there was any.
   - `Ctrl+F` anywhere in the content turns the toggle on.
3. **Scroller** (vertical only, fills the rest). It contains `.to-project-groups`, padding `4px 12px 24px 12px`, as a vertical stack with a gap of 24 holding five sections: `agent`, `building`, `running`, `idle`, `all`. Each section is a vertical box with a gap of 10 and is hidden when it has no items:
   - The heading `.to-project-section` has padding `0 2px` and a gap of 8. It holds the group title (`label` 13/18 500, `text`) and the count (`label` variant, `textTertiary`). The heading is **visible only in grouped mode**.
   - Group titles: `agent: "Claude working"`, `building: "Building"`, `running: "Running"`, `idle: "Idle"`, `all: "Projects"`.
   - Below the heading comes the **ProjectGrid**.
   - After the sections comes a **no-match EmptyState** (icon `search`), hidden unless nothing is visible.

#### PillTabs (shared with detail)

- The container has a gap of 4 and is aligned start.
- Each tab `button.to-pill-tab`:
  - min-height 28, padding `0 10px`, radius 999, 1px `border`, transparent background, color `textSecondary`, no shadow.
  - Content: a row with a gap of 6 holding the label (`label` variant 13/18 500, color inherited from the button) and the count (`caption` 12/16, `textTertiary`). The count is hidden when it is 0 or null.
  - Hover: background `backgroundElement`, color `text`.
  - Selected (`:checked`): background `backgroundSelected`, border `borderStrong`, color `text`.
- The tabs act as a radio group, so exactly one is selected. Implement as `role="tablist"` with arrow-key navigation.
- Micro-animation: a 120ms background/border/color fade. A shared-layout "selected pill" slide (motion `layoutId`) is allowed if it lands on identical pixels.

List tab counts are recomputed on every render from the **search-filtered** cards:
- `all` = the number of filtered cards.
- `active` / `idle` = the number of filtered cards passing `inTab`.

#### Toolbar toggle

- `button.to-toolbar-button`: 28x28, padding 0, radius 999, 1px `border`, color `textSecondary`, and a flat (transparent) background.
- Hover: background `backgroundElement` (from `button.flat:hover`), color `text`.
- Checked: background `backgroundSelected`, color `text`.
- Icon 16px.

#### ProjectGrid

- A GTK FlowBox, homogeneous, from 1 to **3** columns.
- Column and row spacing are 12, and Adwaita pads every `flowboxchild` by 3px, so the visible gap between cards is 18px and the grid sits 3px further in than the 12px page padding (measured in the reference: cards at x=321 and x=670, rows at y=110 and y=390). CSS: `gap: 12px` on the grid and `padding: 3px` on each cell.
- The card min-width is 280.
- **All cards share one size**: the width is the column width, and the **height of every card equals the tallest card** across all rows (homogeneous FlowBox; verified in the screenshot, where every card is 260px tall).
- CSS equivalent:
  - `display:grid; gap:12px; grid-template-columns: repeat(auto-fill, minmax(max(280px, calc((100% - 24px)/3)), 1fr)); grid-auto-rows: 1fr;`
  - In a grid with no fixed height, `grid-auto-rows: 1fr` sizes every row to the tallest row, which reproduces the homogeneous FlowBox (all cards 260px in the reference). The Electron app uses this.
- Keyed by project id. Reordering moves existing cards rather than recreating them. Use motion `layout` for a 180ms reorder animation, and fade new cards in with opacity 0→1 plus y 4→0 over 180ms.

#### ProjectCard

The outer element is an overlay (`.to-project-card`, min-width 280). It contains a full-card pressable button and, overlaid at the top-right, the Ask button.

- The pressable `button.to-pressable` has padding 0, no background or border, radius 10. Clicking opens the detail. Its aria-label is the card title.
- The surface `.to-surface.to-project-surface` is a vertical box with a gap of 12, padding 16, radius 10, a 1px `border`, background `surface`, no shadow, and overflow hidden.
  - Hover: background `backgroundElement`.
  - Active: background `backgroundSelected`, scale 0.98.
  - Focus-visible: border `borderStrong`.
- Children, in order:
  1. **Top row** (gap 12):
     - An icon badge `.to-icon-badge`: **32x32** (see Q3), radius 8, background `backgroundElement`, 1px `border`, color `textSecondary`, with a 16px `box` icon centered.
     - Titles column (vertical, gap 2, hexpand, vertically centered):
       - Title: `h3` 15/20 600 Inter Display -0.2, color `text`, one line ellipsized.
       - Subtitle: `caption` 12/16 `textTertiary`, one line ellipsized, `"{Framework} · {pm} · {id}"`.
     - A 28px-wide spacer reserving room for the Ask button.
  2. **Badges wrap** (gap 6 horizontal and vertical). Each badge is hidden when it has no value. Order:
     1. Confidential: lock icon in the warning color, label `Confidential`.
     2. Activity: a dot in the activity tone and the activity label.
     3. Branch: `git-branch` icon in the neutral color (`textSecondary`), label `main`, `detached` or `Not a git repository`. The badge shows whenever `branch` is truthy, so it also shows `Not a git repository` for non-git projects.
     4. Sync: `cloud-download` icon, label `↑2 ↓1`.
     5. Dirty: a dot in the tone, label `Clean` or `Uncommitted changes`. The card never shows a count.
  3. A flexible spacer that pushes the rest to the bottom of the equal-height card.
  4. **Commit row** `.to-project-commit`, gap 8, hidden when there is no commit:
     - `git-commit-horizontal` 16px in `textTertiary`.
     - The commit subject: `body` 13/20 `textSecondary`, flex 1, one line ellipsized.
     - The relative time: `caption` `textTertiary`, hidden when empty.
  5. **Tags wrap** (gap 6), hidden when there are no tags. Each tag `.to-project-tag` has padding `0 8px`, min-height 20, radius 999, a 1px `border`, and the text in `caption` `textSecondary`. Examples: `Web bundle`, `Build script`, `Linux AppImage`, `Windows installer`, `Android APK`.
- **Ask button** `button.to-project-ask`:
  - Overlay aligned top-end with margin `12px 12px 0 0`.
  - 28x28, padding 0, radius 6, color `textSecondary`, flat. The icon is `mouse-pointer-2` 16px.
  - Hover: background `backgroundSelected`, color `text`.
  - The tooltip and aria-label are `Ask Claude about {title}`.
  - Click calls `navigate("agents", {new: true, projectId})`. It must not trigger the card's open action.

#### StatusBadge (cards, clone dialog, log panel)

- `.to-status-badge`: inline-flex row with a gap of 4, min-height 20, padding `0 8px 0 7px`, radius 999, **transparent background with a 1px `border`**, aligned start and centered vertically.
- The leading element is either a **6x6 dot** (radius 999, background = the tone foreground) or a 16px icon in the tone foreground.
- The label is `caption` 12/16 400 in **`textSecondary`** (the label does not take the tone color).
- When `live`, the dot pulses (see 2.3).

Tone sources on cards:
- Activity: agent=info, building=info, running=success, idle=neutral (dot `#929294` in dark).
- Dirty: Clean=success, dirty=warning.
- Confidential: warning (yellow lock).
- Branch and sync: neutral, so the icon is `textSecondary`.

### 4.3 States (the `state` child, EmptyState)

EmptyState layout:
- A vertical stack with a gap of 8, centered both ways, margins `40px 24px`.
- Children, in order:
  1. A spinner (24x24) **or** a glyph (48px, `textTertiary`, margin-bottom 4).
  2. The title: `h4` 14/20 500 `textSecondary`, centered, wrapping.
  3. The message: `bodySmall` 12/18 `textTertiary`, centered, wrapping, max-width 56ch, hidden when empty.
  4. The actions row: gap 8, margin-top 8. A primary pill button comes first, then a flat button.

Render rules (`_render`):

1. If `store.projects` is `null` (not loaded):
   - If the connection is online: a spinner with `Loading projects…`.
   - Otherwise, map `connection.status` as follows. The message `{error}` is replaced with `state.error_message`, and an empty message is hidden. When the action is missing, show the spinner. Otherwise show the `cloud-off` glyph and a primary action button.

     | status | title | message | action → handler |
     |---|---|---|---|
     | `unconfigured` | `Connect to your sandbox` | `Projects live inside the sandbox. Set up the connection first.` | `Preferences` → open Preferences |
     | `discovering` | `Looking for the sandbox…` | none | spinner |
     | `connecting` (also the fallback) | `Connecting…` | none | spinner |
     | `offline` | `Sandbox unreachable` | `{error}` | `Retry` → `connection.refresh()` |
     | `unauthorized` | `Token rejected` | `The controller refused the saved token.` | `Preferences` |
     | `incompatible` | `Version mismatch` | `{error}` | `Preferences` |

2. If the projects list is empty: show glyph `box` with the title `No projects yet` and the message `Clone a repository or start an empty project in /workspace/projects, or ask Claude to set one up.` The primary action `New project` opens Create. The flat secondary action `Ask Claude` navigates to `agents {new:true}`.
3. Otherwise, show `content`:
   1. Sort the filtered projects.
   2. Build the card models.
   3. Set the tab counts.
   4. Keep the cards that pass the selected tab.
   5. In grouped mode, bucket them by activity (only non-empty buckets, with headings and counts). Otherwise put everything in the single `all` section with no heading.
   6. If nothing is visible:
      - With a non-blank query: the no-match state is the `search` glyph, the title `No matching projects`, and the message `Nothing matches “{query}”.` (typographic quotes, trimmed query), plus the primary action `Clear search`, which clears the field.
      - Otherwise: the `box` glyph and the title `No {tab label lowercased} projects`, i.e. `No all projects projects`, `No active projects` or `No idle projects` (see Q5).

### 4.4 Data and live updates (list)

- `store.projects` (shared, from `GET /v1/projects`) and `store.agent_runs` (shared) drive the cards.
- The page also polls **`GET /v1/processes`** and **`GET /v1/builds`** (no projectId) every **15s** while the page is mounted and visible. Poll immediately on mount, then pause when the page is hidden.
- While visible, it subscribes to:
  - the store changes for `projects`, `agent_runs` and `connection`;
  - the WebSocket events `process.updated` (`{process}`) and `build.updated` (`{build}`). Each event upserts by `id` into the polled lists, and only once a first poll has landed.
- Every change triggers a full re-render. React: derive everything with `useMemo` from `{projects, runs, processes, builds, query, tab, grouped}`.

---

## 5. Project detail

### 5.1 Navigation

- `open_project(id, tab?)` builds the detail and **pushes** it onto the page's navigation stack.
  - The title is `project.name` if the project is already in `workspace` (the store), else the id.
  - The header end widgets hold only `refresh-cw`, tooltip `Refresh`.
  - The tag is `project:{id}`.
  - If `tab` is given, that tab is selected (the ids are `processes|builds|artifacts|git|sync|conversations`, and unknown ids are ignored).
- The window chrome shows a back chevron and the breadcrumb `Projects › {title}` (`page-projects-core-detail.png`).
- On delete success the detail pops itself.
- The title updates to the display name whenever the project renders (see Q1).

### 5.2 Layout

The root is a crossfade stack with `loading` (EmptyState) and `content`.

`content` is a vertical scroller (no horizontal scroll). The body box `.to-detail-body` has padding `20px 24px 40px 24px`, a gap of 0 between children, and **no max width** (it spans the pane).

1. **Crumb row** `.to-detail-crumb`: gap 8, margin-bottom 4.
   - The id: `caption` 12/16 `textTertiary`.
   - The path: `code` 12/18 Geist Mono `textTertiary`, hexpand, selectable. It shows `project.path`.
   - Three icon buttons `button.to-row-action`, each 24x24, radius 6, color `textSecondary`, flat, with a 16px icon. Hover sets color `text` and background `backgroundElement`.
     - `copy`, tooltip `Copy path`: copies `project.path` and toasts `Path copied`.
     - `pencil`, tooltip `Rename`: opens the Rename dialog.
     - `trash-2`, tooltip `Delete from sandbox`, class `.to-danger-button`, so hover sets color `danger`. It runs the remove flow.
2. **Title**: `h1` 24/30 600 Inter Display -0.4, `text`, selectable. It shows `name || id` (initially the id until loaded).
3. **Property chips** `.to-detail-props`: a wrap with gaps of 6/6 and margin-top 8. Each chip is hidden when its label is empty. The order is fixed:

   | chip | icon (color) | label |
   |---|---|---|
   | activity | idle `circle` (`textTertiary`); agent `circle-dot` (`accent`); building `circle-dot` (`info`); running `circle-dot` (`success`) | `Idle` / `Claude working` / `Building` / `{n} running` |
   | framework | `box` (`textSecondary`) | `joinMeta(frameworkLabel, packageManager)`, e.g. `Node · bun` |
   | branch | `git-branch` | `git.branch` or `detached`. **Hidden if not a git repo.** Max 40 chars, ellipsized, with a tooltip of the full text only when truncated |
   | sync | `cloud-download` | `↑n ↓m` (hidden when both are 0 or there is no git) |
   | dirty | `Clean`: `circle-check` (`success`); dirty: `circle-dot` (`warning`) | `Clean` / `{n} changed` (n = the number of files in `GET /git` details, when loaded) / `Uncommitted changes` |
   | confidential | `lock` (`warning`) | `Confidential` |
   | claude account | `mouse-pointer-2` | `Claude · {effective account id}`, shown only once `/claude/accounts` loaded |

   PropertyChip `.to-property-chip`:
   - Row with a gap of 6, min-height 24, padding `0 10px`, radius 999, 1px `border`, transparent.
   - The icon is 16px. The label is `caption` 12/16 `textSecondary`.
4. **Quick actions** `.to-detail-actions`: a wrap with gaps of 8/8 and margin-top 12.
   1. `Ask Claude`, primary pill, icon `mouse-pointer-2`: navigates to `agents {new:true, projectId}`.
   2. `Claude terminal`, secondary, icon `square-terminal`: navigates to `terminals {kind:"claude", projectId}`.
   3. `Shell`, secondary, icon `square-terminal`: navigates to `terminals {kind:"shell", projectId}`.
   4. **Display / emulator button**, secondary. Its state comes from `display_button(runTargets, appRuns, framework, runTargetsError)`:
      - If there is no Android run target and the framework is not Android: label `Display`, icon `monitor`, no tooltip. The action navigates to `display`.
      - If the framework is Android-ish (`expo`, `react-native`, `android`) but there is no Android target: label `Open on emulator`, icon `smartphone`, **disabled**. The tooltip is:
        - none, while the targets are still loading;
        - `No Android app was detected in this project`;
        - `This sandbox can't run apps on the emulator yet; update the sandbox` on a 404;
        - `Couldn't read the project's run targets: {error}` on other errors.
      - If there is an Android target: label `Open on emulator`, or `Show emulator` when a live app run exists. The icon is `smartphone`. The tooltip is:
        - `Build the app in {dir} and install it on the host Android emulator`, or the same without `in {dir}`;
        - `{reason}. Monolith starts and links the emulator on this computer first` when the reason is host-fixable;
        - otherwise the raw reason.
        Clicking hands off to the emulator launcher (out of scope).
      - The button is disabled while the emulator is busy, and the label then shows the launcher's progress text, e.g. `Starting the emulator…`.
   5. **Claude account dropdown** `.to-choice-dropdown.flat`, visible once the accounts load.
      - Its button is min-height 28, padding `0 8px`, radius 6, flat, with a trailing caret.
      - The tooltip is `Claude account for this project`.
      - The options come from `claudeAccountOptions`. The selected one is `project.claudeAccountId || ""`.
      - The popover rows are min-height 28, padding `0 8px`, radius 4. The popover itself has `surfaceElevated`, a 1px border, radius 8, padding 4, and shadow `0 8px 24px rgba(0,0,0,0.4)`.
      - On change:
        1. Convert `""` to `null`.
        2. If the value equals the current one, stop.
        3. Disable the dropdown.
        4. Call `PUT /v1/projects/{id}/claude-account {accountId}`.
        5. On success: replace the project, upsert it in the store, and toast `{project name} now uses the {account} Claude account` (account = the effective id).
        6. On error: show the danger notice `Couldn't change the Claude account: {error}`.
        7. Always: re-enable the dropdown and re-render the header.
5. **Notice** (danger), hidden by default, margin-top 12.
   - Box `.to-notice`: gap 10, padding `8px 10px`, radius 8, 1px `border`, transparent background.
   - Children:
     - Leading icon `circle-alert` 16px in `danger`.
     - Message: `bodySmall` `textSecondary`, wrapping.
     - Trailing flat button: min-height 24, padding `0 8px`, 12px, color `danger`, default label `Dismiss`.
   - `report(error, action?)` shows it with the described error. An optional `(label, fn)` replaces Dismiss, and that button hides the notice and then runs `fn`.
   - A later successful poll hides the notice **only if it was raised by a failed poll**.
6. **Tab strip** `.to-detail-tabs`: a horizontally scrollable container with **no visible scrollbar**, margin-top 20, padding-bottom 8, and a bottom border of 1px `divider`. It holds PillTabs (aria `Project sections`) in this order, with these labels and counts:

   | id | label | count shown (hidden when 0/null) |
   |---|---|---|
   | `processes` (default) | `Processes` | live processes |
   | `builds` | `Builds` | non-final builds |
   | `artifacts` | `Artifacts` | number of artifacts |
   | `git` | `Git` | none |
   | `sync` | `Sync back` | the sync tab's change count (pushed by `SyncTab` via callback) |
   | `conversations` | `Chats` | number of sessions |

7. **Tab content** `.to-detail-tab`: margin-top 12. It is a crossfade stack (180ms) where **each child keeps its natural height** (non-homogeneous) and only the selected tab is mounted or visible. Each tab is rendered by its own component (out of scope) with these props:
   - `GitTab.render(project, gitDetails, gitError)`
   - `ProcessesTab.render(project, processes)`
   - `BuildsTab.render(project, builds)`
   - `ArtifactsTab.render(artifacts)`
   - `ConversationsTab.render(sessions, runs)`
   - `SyncTab(host, onCount)`, with `refresh()`
   - The tabs call back into the shell through `upsert(kind, item)`, `remove(kind, id)`, `report(error, action?)`, `ctx`, `projectId`, and `FixWithAi` (6.6).

### 5.3 States

- **Loading** (no cached project): a spinner with `Loading project…`.
- **First fetch failed and no project is known**:
  - The glyph is `triangle-alert` (48px `textTertiary`).
  - The title is `Couldn't load this project`, and the message is the described error (e.g. `Project monolith-test-missing not found`).
  - The primary action is `Try again`, which runs refresh.
  - See `page-projects-core-detail-error.png`.
- **Fetch failed with a known project**: keep showing the content and raise the danger notice with the error.
- **Refresh**:
  - Header button or Try again.
  - If there is no project yet, reset to the spinner with `Loading project…`.
  - Then force the poll, `SyncTab.refresh()`, and `workspace.refresh()`.
- If a project is cached in the store (opened from the list), the content renders immediately from the cached project while the first poll runs. The lists inside the tabs are still `null`, so the tabs show their own loading placeholders.

### 5.4 Data fetching (one poll, every 15s while visible; immediately on mount)

The snapshot runs sequentially (Python; parallelize with `Promise.allSettled` in Electron but keep the same error semantics). The `/v1` prefix is implied.

| # | call | on error |
|---|---|---|
| 1 | `GET /projects/{id}` | fails the whole snapshot (5.3) |
| 2 | `GET /processes?projectId={id}` | fails the snapshot |
| 3 | `GET /builds?projectId={id}` | fails the snapshot |
| 4 | `GET /artifacts?projectId={id}` | fails the snapshot |
| 5 | `GET /projects/{id}/run-targets` then `GET /app-runs?projectId={id}` | sets `runTargetsError` and leaves both null. Logged as info on 404 ("older sandbox"), else as a warning, and only when the message changed. Not shown to the user except through the Display button tooltip |
| 6 | `GET /sessions?limit=50&projectId={id}` | sessions stay `[]`, warning logged |
| 7 | `GET /claude/accounts` | ignored (accounts null, so the dropdown and chip are hidden) |
| 8 | `GET /projects/{id}/git`, only if `project.git` is truthy | stored as `gitError` (shown by GitTab) |

On success:
1. Replace the project.
2. Sort the lists (processes, builds, artifacts as in 3.3).
3. Store git, accounts, run targets, app runs and sessions.
4. Clear a poll-raised notice.
5. Render.

Live updates while visible:
- `process.updated {process}`, `build.updated {build}` and `artifact.created {artifact}`: if `item.projectId === id` and that list has loaded, upsert it, re-sort, re-render the lists, and update the tab counts and the header activity chip.
- `artifact.deleted {id}`: remove the artifact from the list.
- `app.updated {run}`: for this project, upsert into `appRuns` and re-render the Display button.
- Store `projects` changes: if this project's entry differs, adopt it. If `git` changed, force a poll.
- Store `agent_runs` changes:
  - Re-render the Chats tab and the header (the activity chip).
  - If a **new** run id appeared for this project after sessions were loaded, force a poll so the new chat shows up.

---

## 6. Dialogs and actions

### 6.1 Shared dialog shell (Linear modal)

- Modal over a dimming `overlay` (dark `rgba(0,0,0,0.55)`, light `rgba(0,0,0,0.28)`), centered.
- The sheet: radius 12, background `surfaceElevated` (`#1A1A1B` dark, `#FFFFFF` light), 1px `border`, shadow `0 16px 48px rgba(0,0,0,0.5)`.
- The default content width is **520**.
- Micro-animation (Electron): backdrop fade 160ms; sheet opacity 0→1 and scale 0.98→1 with y 4→0 over 180ms ease-out; reversed on close at 120ms.
- **Header** `.to-dialog-header`: padding `12px 12px 4px 16px`, min-height 24, gap 4.
  - The breadcrumb (gap 6):
    1. When a context is set, a chip `.to-breadcrumb-chip` (min-height 24, padding `0 8px`, radius 6, background `backgroundSelected`, gap 6) holding a 16px icon in `textSecondary` and the context text in `bodyStrong` `textSecondary`.
    2. Then a `chevron-right` 16px in `textTertiary`.
    3. Then the title in `bodyStrong` `text`.
  - Trailing: the close `x` button `button.to-dialog-icon-button`, 24x24, radius 6, `textSecondary`, flat. Hover sets `text`. The tooltip is `Close`.
- **Body** `.to-dialog-body`: padding `8px 16px 16px 16px`, vertical gap 12. It sits in a scroller that grows to its natural height.
- **Footer** `.to-dialog-footer`: padding `8px 12px 12px 16px`, gap 8. The start side (left) holds the secondary/cancel button. The end side (right) holds the spinner (16px, while busy) and the primary button. All footer buttons are min-height **30**.
- Esc closes. Enter in any registered field submits.

FormDialog additions:
- Subtitle: `caption` `textSecondary`, wrapping, at the top of the body when given.
- Then a hidden danger **error notice** (same as 5.2.5 without an action).
- Field groups `.to-field-group` (vertical, gap 8):
  - The optional group title in `label` 13/18 500.
  - The fields box (gap 10).
  - The description in `caption` `textSecondary`, wrapping.
  - The group's error text in `caption` `danger`, wrapping. It holds every field error of the group joined by `\n`.
- **TitleEntry** `entry.to-title-entry`:
  - Borderless, transparent, no shadow and no focus outline; min-height 36, padding 0, **18px 600**, hexpand.
  - In monospace mode: Geist Mono **15px 400**.
  - The placeholder is in `textTertiary`.
  - With an error, the text is in `danger`.
- **Labeled entry**:
  - A field box (vertical, gap 6) with its title in `overline` 12/16 500 `textSecondary` and an input `entry.to-form-entry`.
  - The input: min-height 32, radius 6, background `surface`, 1px `border`. Focus sets the border to `accent` plus a 1px `focusRing` outline at offset 1. With an error, the border is `danger`.
- **Chips row** `.to-property-chips`: gap 6, margin-top 4.
  - Each chip `button.to-chip`: toggle, min-height 28, padding `0 10px`, radius 999, 1px `border`, transparent, `textSecondary`, 400 weight, with a 16px icon and a gap of 6.
  - Hover: `backgroundElement` and `text`.
  - Checked: `backgroundSelected`, border `borderStrong`, `text`.
  - Each chip with a hint gets a tooltip, plus a `caption` `textSecondary` wrapping note in a box (gap 4) below the row. The note is visible only while the chip is active.
- Behaviour:
  - Typing in a field clears that field's error.
  - `setFieldErrors` focuses the first field that has an error.
  - `setBusy(true)` shows the spinner and disables the primary button and all fields.
  - Submit is ignored while busy or while the primary button is hidden or disabled.
- Buttons:
  - **Primary** `button.to-primary`: min-height 28 (30 in the footer), padding `0 14px`, radius 999, background `accent`, color `textOnAccent`, 500. Hover `brightness(1.1)`; active `accentPressed`; disabled opacity 0.5.
  - **Flat** (Cancel): transparent; hover `backgroundElement`; padding `0 10px`; radius 6; 13px 500.

ConfirmDialog:
- Width **420**. The header has padding-top 16, a title and no context chip.
- The body text is `body` `textSecondary`, wrapping.
- The footer end holds `Cancel` (flat) then the confirm button. For a destructive confirm, the button is a solid `dangerSolid` background with `textOnAccent` (white) and no border.
- The default focus is **Cancel** when destructive, else Confirm. Enter activates the confirm button.
- Clicking confirm closes the dialog and then runs the callback.

### 6.2 Create project (`CreateProjectDialog`)

- Opened by the header `+`, the empty-state `New project`, or `params.create`.
- FormDialog with title `New project`, no subtitle, primary `Create`, cancel `Cancel`, context chip `Projects` with the `box` icon, width 520.
- Body, in order:
  1. A group without a title, holding the TitleEntry with placeholder `Name` (key `name`). The group description is `locationHint(name)`, live, starting at `Becomes a folder in /workspace/projects.`
  2. The group `Clone from` with the description `Leave empty to create an empty project.`:
     - Entry `Git URL (optional)` (key `git_url`). While typing, the primary label switches between `Clone` and `Create`.
     - Entry `Branch (optional)` (key `branch`).
  3. The chip `Confidential` (icon `lock`, off). Its hint, shown when active, is: `The real name stays on this computer and the sandbox only sees a pseudonym. Claude won't share artifacts and redacts names, URLs and authors.`
- Focus starts in Name.
- **Confidential toggle on**:
  1. Remember the typed name.
  2. Replace the name with a fresh pseudonym (an `adjective-noun` pair from the lists in `monolith_desktop/pseudonym.py`, not colliding with existing ids or the current text; on exhaustion `{pair}-{n}`).
  3. Make the name read-only.
  4. Show a trailing `shuffle` icon in the entry with the tooltip `New pseudonym`. Clicking it re-rolls.
  5. Change the `Clone from` description to `Leave empty to create an empty project. The sandbox still receives the git URL to clone it.`
- **Confidential toggle off**: restore the typed name, make it editable, remove the icon, and restore the description.
- **Submit**:
  1. Validate (3.3) against the ids currently in the store.
  2. Clear the error notice and set the field errors, using the `VALIDATION` strings below. If any error, stop.
  3. Set busy and call `POST /v1/projects` with `{name, gitUrl?, branch?, confidential?: true}`.
  - On error:
    - A conflict sets the name field error `/workspace/projects/{id} already exists.`
    - Anything else shows the described error in the notice.
  - Busy clears in all cases.
- **Created**:
  1. Upsert the project into the store and refresh the projects.
  2. If there is **no `processId`** (empty project): toast `Created {name}`, close, then navigate to `projects {projectId}`, which opens the detail.
  3. If cloning: crossfade to the **progress page**:
     - `.to-dialog-body`, vertical, gap 12.
     - Header row (gap 8): the title `Cloning {name}` (`bodyStrong`, flex 1) and a StatusBadge `Cloning` (info).
     - A **LogPanel** (min-height **260**, vexpand):
       - Its title is the git URL plus a space plus the branch (blank parts are skipped).
       - There is no close button.
       - The empty text is `Waiting for output…` and the jump button text is `Jump to latest output`.
     - A hidden `bodySmall` `textSecondary` message.
     - The primary button is hidden. The left button becomes `Close`.
     - It follows the process logs (6.7).
- **Clone finished** (the stream ended):
  - The badge becomes `Cloned` (success) or `Failed` (danger), and the message is `cloneOutcome.message`.
  - Refresh the projects.
  - The primary button reappears as `Open project` (ok) or `Open anyway` (failed). It closes the dialog and opens the detail.
- **Closing** stops the follower. If the clone was still running, toast `Cloning continues in the background.`

LogPanel visuals (shared with the tabs):
- A vertical box `.to-log-panel` with a gap of 6 and margin-top 4.
- Header `.to-log-panel-header`: min-height 28, padding `0 4px 0 12px`, gap 8.
  - A `square-terminal` 16px icon in `textTertiary`.
  - The title in `label`, flex 1.
  - An optional secondary action button.
  - The status badge (hidden until set).
- An optional notice line in `caption` `textTertiary`, e.g. `Live logs unavailable: showing a snapshot`.
- The log view: radius 8, a 1px `border`, and background `background` (`#09090A` dark). The text has padding `10px 12px` and is Geist Mono 12px.
- A floating jump-to-latest button `.to-jump-button`: 28x28, radius 999, background `surfaceElevated`, 1px `borderStrong`, shadow `0 4px 12px rgba(0,0,0,0.3)`.

### 6.3 Rename project (`RenameProjectDialog`)

- FormDialog with title `Rename project`, subtitle `/workspace/projects/{id}`, primary `Save`, cancel `Cancel`, **width 460**, context chip = the current name (`name || id`) with the `box` icon.
- One group (no title) with the description `Only the name shown in the apps changes, not the folder. Leave it empty to use the detected name.`. It holds a TitleEntry with placeholder `Name`, prefilled with the current name and focused.
- **Submit**:
  1. If the trimmed name is longer than 128, set the field error `Keep the name under 128 characters.` and stop.
  2. Compute `value = trimmed || null`.
  3. If `value === current`, close without a request.
  4. Otherwise set busy and call `PUT /v1/projects/{id}/name {name: value}`.
  - On success: upsert the store and toast `Renamed to {project.name}`, or `{id} uses its detected name again` when the value was null. Then close.
  - On error: show the error notice.

### 6.4 Delete project (`remove_project`)

1. Call `GET /v1/projects/{id}/sync/changes`. On failure, toast `Couldn't delete {name}: {error}` and stop.
2. Build the confirmation from `removalPrompt(name, sync)` (3.3). This is a destructive ConfirmDialog with `Cancel`. The three variants:
   - `Only copy of this project`: `{name} was never synced from a computer, so the sandbox has its only copy. Deleting moves it to /tmp in the sandbox.`, confirm button `Force delete`.
   - `Unsynced changes`: `{files} in {name} changed in the sandbox and {verb} not synced back to {host}: {paths}.` + blank line + `Sync to host first to keep them there, or force delete: the sandbox copy moves to /tmp and the project on {host} stays as it was.`, confirm button `Force delete`.
   - `Delete {name}?`: `It moves to /tmp in the sandbox. The project on {host} is not touched.`, confirm button `Delete`.
3. On confirm, call `DELETE /v1/projects/{id}` (with `?force=1` when forced).
   - On success: remove the project from the store, toast `Deleted {name} from the sandbox`, and pop the detail view.
   - On failure: toast `Couldn't delete {name}: {error}`.
   - There is no busy state in the dialog, because it closes before the request.

### 6.5 Run a command (`RunCommandDialog`; opened from the Processes tab)

- FormDialog with title `Run a command`, primary `Run`, cancel `Cancel`, width 520, context chip = the project name with the `box` icon.
- Group 1 has the description `Runs with bash -lc in {project.path}` and a **monospace** TitleEntry with placeholder `Command` (key `command`), which is focused.
- Group 2 holds the entries `Name (optional)` (key `name`) and `Port (optional)` (key `port`, numeric input mode).
- The chip `Show on the sandbox display` (icon `monitor`) is on by default when the framework is `electron`. Its hint is `Sets DISPLAY so GUI apps appear in the VNC view`.
- **Submit**:
  1. Validate (3.3) and set the field errors.
  2. Set busy and call `POST /v1/processes` with the body.
  - On a conflict when a port was given: the port field error `Port {port} is taken: {described error}`.
  - On other errors: the notice.
  - On success: close and call `onStarted(process)`. The Processes tab handles this (toast and logs), so it is out of scope here.

### 6.6 Fix with AI (`FixWithAi`, used by the Processes and Builds tabs)

- The action label is `Fix with AI` (rendered by the tabs).
- It is offered when:
  - a process has state `failed`, or state `exited` with an `exitCode` that is not 0 or null;
  - a build has state `failed`.
- `open(itemId, fetchLines, toPrompt)`:
  - It is ignored if that item is already pending. Otherwise it marks the item pending and notifies the tab, which disables that row's button.
  - It fetches the log lines (the tab passes e.g. `GET /processes/{id}/logs?tail=…` or `GET /builds/{id}/logs?tail=…`) and builds the prompt with `processFailurePrompt` or `buildFailurePrompt` (3.3).
  - It navigates to `agents {new: true, projectId, prompt}`, so the composer is prefilled and **not sent**.
  - Errors go to the detail notice via `report`.
  - Finally it clears the pending flag and notifies.

### 6.7 Log following (`LogFollower`, shared by the clone dialog and the tabs)

- `follow(kind: "process"|"build", id)`:
  1. Stop any previous follow.
  2. Clear the view and the notice.
  3. If the panel is visible, open now. Otherwise suspend until it is shown.
- **Open**: connect the WebSocket at `/v1/processes/{id}/logs/stream` or `/v1/builds/{id}/logs/stream` (through the app's authenticated stream helper with auto-reconnect). Messages:
  - `{"type":"log","line":{seq,ts,stream,text}}` appends the line.
  - `{"type":"build","build":{...}}` updates the item (via `onUpdate`).
  - `{"type":"exit","code":n|null}` finishes the follow. This message is final, so no reconnect follows.
- The connection state sets the panel status with `logStatus(state)`. `Live` is the pulsing success badge.
- **When the stream can't be created** (e.g. no WebSocket support):
  - The notice reads `Live logs unavailable: showing a snapshot`.
  - Poll every **2s** for the logs (`GET .../logs?tail=500`) together with the item (`GET /processes/{id}` or `GET /builds/{id}`).
  - Append the lines and update the item.
  - When the item is final, finish with an exit code: the process `exitCode`, or for a build 0 if it `succeeded` and 1 otherwise. Then stop polling.
  - Final means: for a process, the state is not `starting` or `running`; for a build, the state is in `FINAL_BUILD_STATES`.
- **Socket closed without reconnect, and not yet ended**: fetch the item once. If it is final, finish. On a fetch error, put the described error in the notice.
- **Finish** (runs once):
  - Set the status. For a build with a final known state, use `build_state`: `Succeeded` success, `Failed` danger, `Cancelled` warning. Otherwise use `logStatus("closed", code, ended=true)`.
  - Call `onExit(code)`.
- **Visibility**: hiding the panel closes the socket or poller (suspends it, if not ended), and showing it reopens. Unmounting stops it.
- The Python `append_lines` for snapshots re-appends every tail. The `LogView` dedups by `seq`, so make the React log view dedupe by `seq` too.

---

## 7. Strings (verbatim; put them in `projects/labels.ts`)

List: `Projects`, `Search projects`, `New project`, `Refresh`, `No matching projects`, `Nothing matches “{query}”.`, `No {tab} projects`, `Clear search`, `Ask Claude about {name}`, `Loading projects…`, `Project filter`, `Group by status`, and the tabs `All projects` / `Active` / `Idle`.

Groups: `Claude working`, `Building`, `Running`, `Idle`, `Projects`. Activity: `Claude working`, `Building`, `{count} running`, `Idle`.

Empty: `No projects yet` / `Clone a repository or start an empty project in /workspace/projects, or ask Claude to set one up.` / `New project` / `Ask Claude`.

Connection: see the table in 4.3.

Git: `Not a git repository`, `detached`, `↑{count}`, `↓{count}`, `Uncommitted changes`, `Clean`, `{count} changed`, `No commits yet`.

Frameworks: `Expo`, `React Native`, `Electron`, `Vite`, `Next.js`, `Node`, `Android`, `Python`, `Flutter`, and `Project` (unknown).

Build targets (label, platform):

| target id | label | platform |
|---|---|---|
| `electron-linux` | `Linux AppImage` | `Electron` |
| `electron-windows` | `Windows installer` | `Electron + wine` |
| `android-apk` | `Android APK` | `Gradle` |
| `web` | `Web bundle` | `Static files` |
| `script` | `Build script` | `Logs only` |

Profiles: `Debug`, `Release`.

Detail: `Loading project…`, `Couldn't load this project`, `Try again`, `Refresh`, `Ask Claude`, `Claude terminal`, `Shell`, `Display`, `Rename`, `Delete from sandbox`, `Copy path`, `Path copied`, `Dismiss`, `Project sections`.

Tabs: `Processes`, `Builds`, `Artifacts`, `Git`, `Sync back`, `Chats`.

Claude account: `Claude account for this project`, `Default ({id})`, `Claude · {id}`, `{project} now uses the {account} Claude account`, `Couldn't change the Claude account: {error}`.

Emulator button: `Open on emulator`, `Show emulator`, and the tooltips quoted in 5.2.

Create: `New project`, `Name`, `Git URL (optional)`, `Branch (optional)`, `Clone from`, `Leave empty to create an empty project.`, `Leave empty to create an empty project. The sandbox still receives the git URL to clone it.`, `Create`, `Clone`, `Cancel`, `Close`, `Open project`, `Open anyway`, `Created as {root}/{id}`, `Becomes a folder in {root}.`, `Cloning`, `Cloned`, `Failed`, `Cloning {name}`, `The repository is ready.`, `git exited with code {code}.`, `git stopped before it finished.`, `The project folder stays in place, so you can open it and retry from a shell.`, `Cloning continues in the background.`, `Created {name}`, `{root}/{id} already exists.`, `Confidential`, the confidential hint (6.2), `New pseudonym`. (`details: "Project"`, `source_hint`, and `location` exist in labels; `details` is unused.)

Rename: `Rename project`, `{root}/{id}`, `Name`, the hint (6.3), `Save`, `Cancel`, `Renamed to {name}`, `{id} uses its detected name again`. (`group: "Display name"` is unused.)

Remove: see 6.4. Also `Delete`, `Force delete`, `Cancel`, `Deleted {name} from the sandbox`, `Couldn't delete {name}: {error}`, `your computer`, `{paths} and {extra} more`.

Validation:
- `Enter a project name.`
- `Keep the name under {max} characters.`
- `Use at least one letter or digit.`
- `{root}/{id} already exists.`
- `Use an https://, ssh://, git://, file:// or user@host:path URL.`
- `A branch only applies when cloning. Add a git URL or clear it.`
- `That is not a valid branch name.`
- `Enter a command to run.`
- `Keep the command under {max} characters.`
- `Use a port between 1 and 65535.`

Run dialog: `Run a command`, `Runs with bash -lc in {path}`, `Name (optional)`, `Command`, `Port (optional)`, `Show on the sandbox display`, `Sets DISPLAY so GUI apps appear in the VNC view`, `Run`, `Cancel`, `Port {port} is taken: {message}`.

Logs: `Waiting for output…`, `Jump to latest output`, `Connecting`, `Live`, `Ended`, `Exited {code}`, `Stopped`, `Live logs unavailable: showing a snapshot`, `Close logs`.

Process states: `Starting`, `Running`, `Exited`, `Failed`, `Stopped`, `Orphaned`. Build states: `Queued`, `Running`, `Succeeded`, `Failed`, `Cancelled`. Run states: `Working`, `Done`, `Failed`, `Cancelled`.

Fix: `Fix with AI`.

The ellipsis is U+2026 (`…`) everywhere it appears, and the middle dot is U+00B7.

---

## 8. API summary (all under `/v1`, bearer-authenticated through the shared client)

| Method | Path | Used by |
|---|---|---|
| GET | `/projects` | store / workspace refresh |
| POST | `/projects` `{name, gitUrl?, branch?, confidential?}` → `{project, processId?}` | Create |
| GET | `/projects/{id}` | detail poll |
| PUT | `/projects/{id}/name` `{name: string\|null}` → Project | Rename |
| PUT | `/projects/{id}/claude-account` `{accountId: string\|null}` → Project | account dropdown |
| DELETE | `/projects/{id}[?force=1]` → `{id, trashPath}` | Delete |
| GET | `/projects/{id}/git` | detail (git projects) |
| GET | `/projects/{id}/sync/changes` | Delete pre-check (and Sync tab) |
| GET | `/projects/{id}/run-targets` | Display/emulator button |
| GET | `/app-runs?projectId=` | Display/emulator button |
| GET | `/processes[?projectId=]` | list activity, detail |
| POST | `/processes` `{projectId, command, name?, port?, display?}` | Run dialog |
| GET | `/processes/{id}`, `/processes/{id}/logs?tail=` | log fallback, Fix with AI |
| GET | `/builds[?projectId=]`, `/builds/{id}`, `/builds/{id}/logs?tail=` | list activity, detail, logs |
| GET | `/artifacts?projectId=` | detail |
| GET | `/sessions?limit=50&projectId=` | detail Chats |
| GET | `/claude/accounts` | detail account dropdown |
| WS | `/processes/{id}/logs/stream`, `/builds/{id}/logs/stream` | LogFollower |
| events | `process.updated`, `build.updated`, `artifact.created`, `artifact.deleted`, `app.updated` | live updates |

Navigation targets used:
- `agents {new, projectId?, prompt?}`
- `terminals {kind: "claude"|"shell", projectId}`
- `display`
- `projects {projectId, tab?, create?}`
- Preferences

---

## 9. Suggested React structure (per CODING.md: constants out of components, hooks for logic)

```
renderer/pages/projects/
  labels.ts  constants.ts  model.ts (+ model.test.ts, port of model.py tests)
  hooks/useProjectsList.ts      // store + 15s activity poll + events → {cards, counts, state}
  hooks/useProjectDetail.ts     // 15s snapshot poll + events → {project, lists, git, accounts, runTargets, appRuns, sessions, error}
  hooks/useLogFollower.ts
  hooks/useCreateProject.ts  useRenameProject.ts  useRemoveProject.ts  useRunCommand.ts  useFixWithAi.ts
  ProjectsPage.tsx  ProjectsToolbar.tsx  ProjectGrid.tsx  ProjectCard.tsx
  ProjectDetail.tsx  DetailHeader.tsx  DetailTabs.tsx
  dialogs/CreateProjectDialog.tsx  RenameProjectDialog.tsx  RunCommandDialog.tsx
shared components: PillTabs, ToolbarToggle, StatusBadge, PropertyChip, EmptyState, Notice, FormDialog, ConfirmDialog, LogPanel, ChoiceDropdown, IconButton, ActionButton
```

---

## 10. GTK quirks: do NOT copy

- **Q1. Stale breadcrumb title.** The screenshot shows `Projects › theone-mobile` (the id) while the page h1 says `monolith`. `page.set_title(name)` runs on render, but the header bar breadcrumb doesn't follow it. In Electron, the breadcrumb should always show the display name (`name || id`).
- **Q2. FlowBox spacing and global equal height.** GTK spreads leftover width into the gaps (measured about 19px instead of 12) and makes every card as tall as the tallest card in the whole grid. Use a CSS grid with a 12px gap. Per-row equal height is acceptable; global equal height is optional.
- **Q3. Icon badge size.** By cascade order, `.to-project-surface .to-icon-badge` (32px) beats `.to-icon-badge.large` (36px). The rendered badge is **32x32 with radius 8**. Copy the rendered result (32/8), not the "large" intent.
- **Q4. Ellipsis.** `set_max_width_chars(1)` is a GTK trick to let labels shrink. Use `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Q5. Odd empty-tab title.** `No {tab} projects` with the `all` tab would read `No all projects projects`. It is unreachable today, because the `all` tab with no query and no projects shows the "No projects yet" state instead. Keep the logic but guard it.
- **Q6. Badge background.** `to-tone-bg` would tint status badges with the muted tone color. A later rule makes them transparent and outlined, so match the outlined look. The label stays `textSecondary`; only the dot or icon takes the tone.
- **Q7. Detail tabs scroller.** A GTK ScrolledWindow with an EXTERNAL horizontal policy hides the scrollbar. Use `overflow-x: auto` with hidden scrollbars, and scroll the selected tab into view.
- **Q8. Polling while unmapped.** The GTK pollers bind to widget map/unmap. In React, pause the polls when the page or route is hidden or the window is minimized, and resume with an immediate fetch.
- **Q9. Sequential snapshot.** The Python detail fetch is serial, on a worker thread. Parallelize the requests, but keep the failure semantics in 5.4 (only project, processes, builds and artifacts are fatal).
- **Q10. Broadway artifacts in the screenshots.** Animations are disabled and the window is clamped to 1024x768. The sidebar `Projects` section and the composer are window chrome, not part of this page.
- **Q11. Button press scale.** GTK applies `scale(0.95)` to every `button:active`, including the 28px toolbar toggles and the pill tabs. Keep it subtle (0.97 is fine for pills), and skip it under reduced motion.
- **Q12. GTK SearchEntry semantics** (debounced `search-changed`, `stop-search` on Esc) are reproduced manually. Don't use a native `type=search` cancel button styled by Chromium. Render a Lucide `x` clear button instead.
