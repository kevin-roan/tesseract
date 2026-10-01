# UI audit

## Screens

Scope: tabs `agents`, `projects`, `tasks`, `profile`; `(onboarding)/*`; `pair`; `sandbox/**`; and the sandbox and onboarding feature code they use. Home, inbox, chats and analytics are audited separately.

Format: issue → fix, or → reported to the design owner.

### Across screens

- The "Token missing", pairing-issue and error-with-retry notices were copied into three tab screens → moved into one `features/sandbox/components/sandbox-notices` component, now used by agents, projects, profile and tasks.
- Stopping a process had no confirmation on the hub, projects, tasks or project detail screens, while closing a session and cancelling a build or run did → new `useConfirmedStop` hook asks first (destructive "Stop" / "Keep running") and is used by every screen that can stop a process.
- Each screen used the single `dusk` gradient by default → every owned screen now sets an `atmosphere`: agents `agents`, projects `projects`, tasks `agents`, profile `profile`, onboarding and pair `home`, project/build/new-project `projects`, Claude run and new run `agents`, display, terminal and the loading gate `neutral`.
- Stack screens had no titles, so the iOS back-button long-press menu and the web document title showed route names → `src/app/_layout.tsx` now gives static titles to the tabs, display, terminal, new project, project, build, Claude run and pair routes.
- No screen uses haptics, and the shared buttons don't either → no screen-level haptics added so screens stay consistent; reported to the design owner (add them to `ActionButton` / `IconButton` once, e.g. a light tap and a warning on destructive confirm).

### Agents (`(tabs)/agents.tsx`, `use-sandbox-hub.ts`)

- "No builds yet." / "No Claude runs yet." showed while the lists were still loading → the hook now returns `buildsLoading` / `runsLoading`, and empty copy waits for the lists to load.
- Failed stops and session closes were never shown → the hook returns `actionError`, and the screen shows it as a danger notice.
- The empty "Claude runs" section had no way to start a run → it now has an "Ask Claude" button.
- Stopping a process didn't ask for confirmation → it now does (`useConfirmedStop`).

### Projects (`(tabs)/projects.tsx`, `use-projects-screen.ts`)

- The "More options" (⋯) button on each project card only opened the project, same as tapping the card, so it promised a menu that didn't exist → removed from this screen. The card is still one large tap target.
- The list showed nothing while projects loaded → shows a "Loading projects…" spinner.
- A failed stop was silent → shows `stopError` in the Running section.
- "All Projects" used title case, unlike every other section → changed to "All projects".
- Stopping a process didn't ask for confirmation → it now does.

### Tasks (`(tabs)/tasks.tsx`, new `use-tasks-screen.ts`)

- The screen was a placeholder: only a "Tasks" heading built from `SafeAreaView`/`ThemedView`, with no `ScreenScaffold`, data or states → rebuilt on real sandbox data. "Running" lists active processes, builds and Claude runs; "Finished" lists the latest finished ones (capped at `LIST_PREVIEW_LIMIT` each, from the new `finishedWork` util). The screen has a `SandboxGate`, a loading spinner, empty states (Running offers "Ask Claude"), a list error with a retry that refetches all three lists, pull-to-refresh, confirmed stop, and header actions for Ask Claude and a new shell.
- Tasks has a tab on web (`app-tabs.web.tsx`) but none in the native `NativeTabs` (`app-tabs.tsx`), so on iOS and Android the screen can't be reached → reported to the design owner (add the trigger and icon, or drop the web trigger).

### Profile (`(tabs)/profile.tsx`, `use-profile-screen.ts`)

- The data was already real: the Tailscale identity, `status.counts` and an activity feed built from builds, runs and processes. No fake data to remove.
- A failed builds, runs or processes list left the feed saying "No activity yet" → the hook returns `activityError` and `retryActivity`. The Activity section shows the error with a Retry and hides the empty state.
- The empty feed had no next step → it now has an "Ask Claude" button.
- The hero name isn't a heading, the dots menu button leads to the hub rather than a menu, and the team pill text isn't truncated → reported to the design owner (`ProfileHero`).

### Project detail (`sandbox/projects/[id].tsx`, `use-project-detail.ts`)

- The screen had remote data but no pull-to-refresh → `useSandboxRefresh` added and wired into `ScreenScaffold`.
- Stopping a process didn't ask for confirmation → it now does. Errors still go to `actionError`.
- Already OK: loading and error-with-retry before the project loads, an empty label on every section, and a back button that falls back to `/agents` when the screen is opened from a deep link.

### Build detail, Claude run, new run, new project, display, terminal

- Already OK: loading and error-with-retry states, cancel confirmation (build, run, session), `avoidKeyboard` on the composer and form screens, busy and disabled submit buttons, and a back button that falls back to `/agents` for deep links.
- They used the default gradient → they now set a fitting atmosphere (see Across screens).

### Pair (`pair.tsx`) and onboarding

- Pair uses `avoidKeyboard`, disables the fields and shows a spinner on the button while validating, and shows form errors inline → OK. Set `atmosphere="home"` to match onboarding.
- In the pairing and new-project forms, `returnKeyType="next"` doesn't move focus to the next field, because `TextField` doesn't accept a ref → reported to the design owner (forward a ref from `TextField`, then chain `onSubmitEditing` → `focus()`).
- Onboarding (welcome, setup) → OK: `ScreenScaffold`, footer CTA, skip, and a back button that falls back to `/welcome`. Moved from `gradient="aurora"` to `atmosphere="home"`.

### Reported to the design owner (shared components)

- `SectionHeader`: the title has no `accessibilityRole="header"`, and the trailing action ("Add", "New run") is a text `Pressable` with no `hitSlop` or min height, so it's under 44pt.
- `Section`: has no `loading` state, so screens either show nothing or a full `EmptyState` spinner while a section loads. Empty-state copy uses `textTertiary` at `bodySmall`; check its contrast in both schemes.
- `EmptyState`: the title isn't marked as a heading.
- `ProjectCard`: the chat button and the (optional) menu button sit inside the card's own `accessibilityRole="button"` `Pressable`. iOS VoiceOver merges nested buttons into the parent, so "Ask Claude about …" can't be reached with VoiceOver.
- `TextField`: no ref forwarding (see Pair).
- `app-tabs.tsx` / `app-tabs.web.tsx`: the Tasks tab exists only on web. The web tab bar is absolutely positioned and `BottomTabInset` isn't applied by `ScreenScaffold`, so the last rows of scrolled content can sit under the web tab bar (check once the new `edges` prop settles).
- `ProfileHero`: see Profile.
- Haptics: see Across screens.

## Theme & shared components

### Backgrounds: atmospheres instead of one linear gradient

- Found: every screen painted a single two-stop `LinearGradient` (`gradients.dusk`), so all screens looked the same.
- Fixed: added `theme.atmospheres` (`src/theme/colors/atmospheres.ts`). Each atmosphere is a neutral base, a bottom wash, and 4 soft radial color fields from one hue family. Names: `home`, `projects`, `agents`, `analytics`, `inbox`, `profile`, `neutral`. Light mode uses pale 100–300 steps; dark mode uses saturated 500–700 steps at low opacity, which reads as colored light on black.
- New `<ScreenBackground atmosphere drift? />` (`src/components/screen-background`), drawn with react-native-svg `RadialGradient`s so it works the same on iOS, Android and web. We didn't use Skia because it needs extra setup on web. It's static by default. `drift` adds a 28s pan on the UI thread and stays off when the OS asks for reduced motion. SVG ids come from `useId()`, so two mounted screens can't clash on web.
- `ScreenScaffold` now takes `atmosphere` (default `home`) and `drift`. `gradient` still works but is deprecated; `AtmosphereForGradient` maps it to an atmosphere. `edges` and `testID` props are also new.
- Field opacities are capped so `textSecondary` keeps 4.5:1 at the brightest point of any light field. `textTertiary` is only AA on glass and surfaces, so keep it off the bare background.

### Color system

- Found: status ink failed AA in light mode on its own muted fill: success 2.9:1, warning about 2:1, danger 3.4:1. `info` borrowed `accentPressed` (2.2:1). `textTertiary` was 3.2:1 on the canvas.
- Fixed: status colors now come in three roles: `success|warning|danger|info` (ink, AA on the background and on the muted fill), `…Muted` (tinted fill), and `…Solid` (vivid mark, 3:1 or more). Added `info`, `infoMuted`, `infoSolid`, `accentStrong`, `notification`, `textOnNotification`, `glassBorder`. `textTertiary` is now gray 550 in light mode (4.8:1) and gray 450 in dark mode. `focusRing` is `accentStrong`. `lib/tone` `info` now points at `info`/`infoMuted`.
- Added `theme.chart` (`src/theme/colors/chart.ts`):
  - `categorical`: 6 hues in a fixed order (indigo, teal, coral, blue, rose, amber) with separate light and dark steps. Checked with a colorblind-safety validator: adjacent colors stay distinguishable under protan, deutan and tritan simulation, and each hue is at least 3:1 against the background.
  - `named`: the same hues by name.
  - `sequential`: an indigo ramp.
  - `diverging`: coral / gray / teal.
  - `status`: reserved for status.
  - `grid`, `axis`, `label`: neutral chart chrome.
- Palette: added `indigo`, `teal`, `coral` and `rose` ramps, filled in the `blue`, `green`, `amber`, `red` and `violet` steps, and added gray 450 and 550.
- Glass fallback (Android, web, iOS below 26): the tint is more opaque and has a hairline `glassBorder`, so cards stay readable over the colored backgrounds.

### Components

- `greeting`: the export was misspelled `GreetinText`. It's now `Greeting` (default and named export). `GreetinText` stays as a deprecated alias. Added a `name` prop, one-line truncation, and the header role.
- `home-header`: showed a Feather `inbox` icon labeled "Open profile" with `interactive={false}`. Now it uses phosphor icons: an inbox button (`onOpenInbox`, with an `inboxCount` badge capped at "99+" and read out in the label) and a profile button (`onOpenProfile`). Each button only renders when its handler is set. The last `expo-vector-icons` import in components is gone.
- New `avatar` component with `initialsOf`. It replaces three copies of the photo-or-initials code in `activity-item`, `avatar-stack` and `profile-hero`.
- Haptics: `ActionButton` and `IconButton` give a light impact on native, not on web. It's controlled by the `haptics` prop (default on), via `hooks/use-haptic-press`.
- `app-tabs`: native tabs were missing the Tasks trigger; added it. The web tab bar floated over content with sub-44pt targets. It now sits in normal flow below the content, uses icon-over-label buttons that are at least `MinTouchTarget` tall, and has `tab` / `tablist` roles with selected state.
- `section-header`: title is now a header; the action has `hitSlop` so it reaches 44pt. `section`: added `loading` and `loadingLabel`; the empty text moved to `textSecondary` for AA.
- `empty-state`, `profile-hero`: titles are now headers. The profile-hero team pill truncates.
- `project-card`: the chat and menu buttons were unreachable inside the card's button for screen readers. They're now also offered as accessibility actions on the card.
- `text-field`: accepts `ref` (React 19 ref-as-prop) so `returnKeyType="next"` can move focus. The hint or error is exposed as `accessibilityHint`.
- `chip`: added a disabled style; the selected outline uses `accentStrong` (3:1). `progress-ring`: defaults to `accentStrong` and exposes `progressbar` role and value. `connection-dot`, `key-value-row`, `status-badge`: their labels had no effect until the view was `accessible`; fixed.
- `ai-fab`: replaced its own tab-bar constant with `BottomTabInset`. Added a `label` prop. `activity-item`: the timestamp no longer wraps.
- Not changed, for other owners: the profile ⋯ button's destination is screen wiring. `home` (`(tabs)/index.tsx`) still paints `LinearGradient` directly and should switch to `ScreenScaffold atmosphere="home"` or `<ScreenBackground atmosphere="home" />`.

## Home & Inbox

### Home (`src/app/(tabs)/index.tsx`)

- All placeholder data is gone (the "Conversations 24,891" stats, the Create/Templates/Share actions, the "Recent Forms" list). The screen now uses `ScreenScaffold atmosphere="home"` with pull-to-refresh, not its own `LinearGradient`.
- Order, top to bottom:
  - `HomeHeader` with `inboxCount` (unread) and `onOpenInbox` → `/inbox`. When `attentionCount > 0`, a warning `Notice` ("1 request needs you" / "Open inbox") sits under the header. `HomeHeader` has no attention prop, so the emphasis lives on the screen.
  - Usage hero (`features/home/components/usage-hero`): 7- and 30-day chips, total tokens in the `display` style, a sparkline of daily `totalTokens`, an input / output / cache read / cache write split bar with a legend (`theme.chart.categorical`), and a footer with cost ("Reported by agent runs"), messages and sessions. It has loading skeletons, an error `Notice` with Retry, and an empty message when the range has no usage.
  - `StatGrid`: active projects (projects with a live process, agent run or terminal, out of all projects), running agents, and sessions and tokens for today (the last `daily` entry, UTC day).
  - `ActionRow`: New chat → `/sandbox/agent/new`, New project → `/sandbox/projects/new`, Analytics → `/analytics`, Display → `/sandbox/display`.
  - Recent chats: `client.sessions({ limit: 5 })` rendered as `ChatRow`s (title, preview, project chip, relative time, green "Active" dot, token count). "View all" goes to `/chats`. Tapping a row opens the agent run, else the terminal, else `/chats/[id]`.
- When no sandbox is paired, the screen shows `SandboxGate` while hydrating, then a "Pair a sandbox" empty state.

### Inbox (`src/app/inbox.tsx`, new)

- Uses the `inbox` atmosphere and `ScreenHeader`, with a "Mark all read" header action that only shows while something is unread. The subtitle counts the items waiting on you.
- Sections: "Needs you" (unread `needs_input` / `permission`), "Unread", then "Earlier", newest first. Empty sections are dropped.
- `InboxRow`: a kind icon on a tone badge (needs_input and permission in warning with an outlined card, completed in success, failed in danger, status in info), the title (bold while unread, with a notification dot), the body, and the kind label, project and relative time.
- Tapping a row marks it read and opens the agent run, terminal, chat (`/chats/[id]`) or project. Long-pressing a row marks it read.
- Live updates: `inbox.updated` is handled in `applyServerEvent` → `storeInboxEvent`, which upserts the item and counts into the cache (or refetches when nothing is cached) and invalidates session lists.

### Chats (`src/app/chats/index.tsx`, `src/app/chats/[id].tsx`, new)

- `/chats` lists up to 50 sessions with the same `ChatRow`. The Agents tab lists agent runs, not transcripts, so it could not be reused.
- `/chats/[id]` resumes a CLI session that has no live run or terminal. It shows the last preview and an `AgentComposer` that starts a run with `resumeSessionId`, then replaces itself with that run.

### Notifications

- `InboxNotifier` is mounted in the root layout while paired. When an `inbox.updated` event brings a new unread `needs_input` / `permission` item, it posts a local notification if the app is backgrounded (socket still alive) or in the foreground on any screen other than `/inbox`. Each item and `updatedAt` pair fires at most once.
- Permission is requested lazily, the first time such an item arrives, at most once per launch, and never again if the OS says it can't ask. Android uses a high-importance `inbox` channel. Tapping the notification (including a cold start) opens `/inbox`. Web is skipped via `notifications/index.web.ts`.

## Analytics

New screens: `/analytics` (the home screen's Analytics quick action) and `/analytics/projects/[id]?days=` (drill-down from "By project"). Both are registered inside the paired guard in `app/_layout.tsx` and use `ScreenScaffold atmosphere="analytics"`. The code lives in `src/features/analytics/`: pure transforms in `utils/`, queries and screen hooks in `hooks/`, charts in `components/`.

### Data and honesty

- Data comes from `client.usage({ days })` and `client.sessions({ limit: 200, projectId? })`. Query keys sit under `["sandbox", id, …]`, so pull-to-refresh (`useSandboxRefresh`) refetches them. Switching range keeps the previous render at half opacity (`keepPreviousData`), so there's no skeleton flash.
- Token delta: a second report of 2× the range is fetched, and the previous period is every day of it except the newest `days`. At 90 days that would need 180 days, over `LIMITS.maxUsageDays`, so the headline says "No comparison: history only goes back 90 days". Messages get the same delta. Sessions don't, because a session that spans days is not additive.
- Cache hit rate is `cacheRead / (input + cacheRead + cacheWrite)`. It shows "–" when there are no prompt tokens.
- Cost is labelled "Agent run cost, as reported by agent runs", because interactive sessions report no cost.
- Sessions per day comes from `daily[].sessions`. The weekday × hour heat map counts session *starts* in local time, and only from the sessions the controller lists (up to 200). The subtitle says so.
- Top sessions are sessions whose `lastActiveAt` falls in the range, ranked by lifetime `usage.totalTokens`. The caption says it's lifetime. Rows link to `/sandbox/agent/[id]` or `/sandbox/terminal/[id]` when there's a link, and are plain rows otherwise.

### Charts (dataviz method)

- Colors come from `theme.chart`. The token series take categorical slots 1–4 (indigo, teal, coral, blue) in a fixed order, and the stack order matches the slot order. The palette validator passes in both schemes (adjacent CVD ΔE ≥ 11.5 light / 9.0 dark, normal-vision ΔE ≥ 21.8, all slots ≥ 3:1). Model and project bars are single-series, so they're all slot 1. The heat map uses the `sequential` ramp, with empty cells kept on a neutral step.
- Stacked bars are react-native-svg, so they work on native and web. Bars are ≤ 24px, with a 2px surface gap between segments and bars, a 4px rounded data end and a square base. Gridlines are hairline and solid, with clean ticks (`niceTicks`). Axis labels are the first, last and two evenly spaced dates. 90 days is bucketed weekly, counting back from today so only the oldest week can be short.
- The legend and the tooltip are one readout above the plot. It shows range totals by default. Tap or drag across the plot to snap to a column (tap again to clear), and the unselected bars dim. The plot is an `adjustable` element, so VoiceOver/TalkBack step through columns with increment/decrement. Text stays in text ink next to a color key.
- Every chart card has a "Show table" toggle, the no-color, no-gesture twin of the chart.
- Loading uses layout-matched skeletons. "No usage yet" is an empty state that offers "Start an agent run". Zero-data reports still render (flat chart, "No activity", empty-section copy). Errors show a danger `Notice` with Retry; a sessions failure stays inside its own section.

### Follow-ups

- Not verified on a device against a live controller: only jest render tests and typecheck have run. Check axis-label collisions on narrow phones at 30 days, and the heat map's hour labels on very small widths.
- Per-project daily usage isn't in the report, so the drill-down shows a token mix bar, KPIs, the start-time heat map and sessions, but no per-day chart.
