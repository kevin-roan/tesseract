# Mobile app

`apps/mobile` (`@theone/mobile`) is the Expo SDK 56 / React Native 0.85 app
with expo-router. The sandbox integration lives in one feature module. The
app's existing screens (Home, Projects, Tasks, Profile) and their in-progress
work are separate from it. It talks to controllers only through
`@theone/client`, and wire types come from `@theone/protocol`.

Decision record for state handling:
[ADR 0008](../adr/0008-mobile-server-state-react-query-and-events.md).

## Feature module

```text
apps/mobile/src/features/sandbox/
├── api/          client.ts (TheOneClient per paired sandbox) · query-keys.ts · cache.ts (event → cache patches) · pairing.ts
│                 · streams.ts (log/run socket options)
├── components/   feature components, each a folder with index.tsx (+ styles.ts):
│                 agent-composer, agent-event, agent-run-card, agent-run-view, artifact-card, build-card,
│                 build-detail-view, build-target-card, clone-progress, git-card, new-agent-run-view,
│                 new-project-view, pairing-form, process-card, project-form, qr-scanner, remote-surface,
│                 script-card, terminal-card, sandbox-events-bridge.tsx
├── hooks/        one hook per screen or concern: use-sandbox-hub, use-project-detail, use-build-detail,
│                 use-agent-run-screen, use-pair-screen, use-new-project, use-display-session,
│                 use-terminal-session, use-sandbox-queries, use-sandbox-mutations, use-sandbox-events,
│                 use-log-stream, use-agent-run-stream, use-web-page-session, use-page-url, use-qr-scanner, …
├── store/        sandbox-store.ts (paired sandboxes, active id) · token-storage(.web).ts · list-storage(.web).ts
│                 · connection-store.ts (live link state per sandbox)
├── types/        feature types (PairedSandbox, SandboxLink, PageKind, …)
└── utils/        labels, icons, states (incl. issue notices), formatting, actions, routes, errors, pairing,
                  new-project, display, projects, web-bridge, constants
```

Shared building blocks used by the screens live in `src/components/`
(`screen-scaffold`, `screen-header`, `section`, `stat-grid`, `status-badge`,
`log-view`, `web-surface`, `notice`, `empty-state`, `action-tile`/`action-tile-row`, …),
and app-wide providers in `src/providers/`.

## State

| Kind | Where | Details |
|---|---|---|
| Paired sandboxes, active sandbox | `useSandboxStore` (zustand + `persist`) | persisted through `expo-sqlite/kv-store` (`list-storage`), `localStorage` on web. Holds id, name and base URL, never the token |
| Tokens | `token-storage` | `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on iOS/Android. On web: `localStorage`, which is weaker and only meant for development |
| Link state, issues | `useConnectionStore` | `idle`, `connecting`, `open` or `closed` per sandbox, from the events socket; plus an issue (`unauthorized` or `incompatible`) set from socket errors and cleared on `hello` or when the link is removed |
| Server state | `@tanstack/react-query` | query keys `["sandbox", <sandboxId>, …]` (`api/query-keys.ts`), so sandboxes never share cache entries |

The query client (`src/lib/query-client.ts`) uses `staleTime` 5 s and
retries twice, but only for network errors, 5xx, 408 and 429. It never
retries 4xx or mutations. On native it is wired to `AppState` (focus) and
`expo-network` (online).

## Live updates

`AppProviders` (root layout) mounts `QueryProvider` and
`SandboxEventsBridge`. The bridge hydrates the store and runs
`useSandboxEvents` for the active sandbox:

1. `client.openEvents()` gets a ticket, opens `WS /v1/events`, and reconnects
   with exponential backoff (1–30 s). A ping watchdog (about 60 s without a
   frame) forces a reconnect.
2. On `hello` (every new connection) it calls `resyncSandbox`, which
   invalidates the sandbox's queries, because the socket does not replay
   missed events.
3. Every other event goes through `applyServerEvent` (`api/cache.ts`), which
   upserts the object into the matching lists (respecting `?projectId=`
   filters) and detail queries. `artifact.created` also patches its build's
   `artifacts`. `status` events are prepended to an activity list capped at 20.
4. When the app returns to the foreground, a closed socket reconnects
   immediately, also after the client gave up. When the network comes back
   (`expo-network`), a pending backoff is skipped.
5. A 401/403 on the ticket request sets the `unauthorized` issue; a `hello` (or
   `GET /v1/health`) with another `protocolVersion` raises
   `ProtocolVersionError`, ends the stream and sets `incompatible`. The hub then
   shows "Pairing no longer valid" or "Version mismatch" with **Pair again**,
   which opens `/pair` with the URL and name filled in (the QR scanner stays
   available because there is no token).

Streams stay out of react-query. `use-log-stream` (process and build logs)
and `use-agent-run-stream` hold bounded buffers (`use-stream-buffer`) and
reconnect with a fresh ticket after an abnormal close (the controller drops
slow sockets at 16 MiB of backlog and expects clients to come back). They give
up after 5 drops in a row that never opened (for example a deleted process)
and show the generic "Can't reach the sandbox" error, because a browser
WebSocket cannot tell a 404 at upgrade from a network error.

## Screens (expo-router)

| Route | Purpose |
|---|---|
| `(tabs)/agents` | **Sandbox hub.** Pair prompt when empty. Otherwise: sandbox switcher, connection dot, issue notice, resources (CPU, memory, workspace disk, display), quick actions (Display, Terminal, Claude, Build — Build is disabled with "Unavailable until a project has build targets." when no project has one), projects (**Add** in the header, **Add a project** when empty), running processes, sessions, recent builds, Claude runs, activity |
| `pair` (modal) | QR scanner (`expo-camera`; a scanned code pairs at once) plus the manual form; the `theone://pair?…` deep link pre-fills the form and needs a tap on **Pair sandbox** |
| `sandbox/projects/new` | add a project: name, optional git URL and branch, validated like the controller (including existing names). Without a URL it creates the project and opens it. With a URL it shows the clone's live log; exit code 0 opens the project, a failure shows the exit code and **Open project** (the folder stays). The exit is also taken from the process list the events socket keeps current, in case the log stream never reports it |
| `sandbox/projects/[id]` | git summary, scripts (run one as a tracked process), build targets (debug/release), processes, recent builds, artifacts; open a shell, an interactive Claude session, or ask Claude (headless run) |
| `sandbox/builds/[id]` | stage, progress, live log, artifacts with download, cancel |
| `sandbox/agent/[id]` | headless Claude run: streamed events, result, cost, continue (`resumeSessionId`), cancel |
| `sandbox/terminal/[id]` | xterm page in a WebView (`shell` or `claude`) |
| `sandbox/display` | noVNC page in a WebView, loaded only while `display.available` and `display.vnc.available` are true; otherwise it explains whether X or VNC is down and offers **Check again**. The single-use page URL is dropped during an outage so recovery fetches a fresh ticket |

## WebView pages

The terminal and display screens embed controller-served pages through
`RemoteSurface` → `WebSurface` (`src/components/web-surface`:
`react-native-webview` on native, `<iframe>` on web):

```text
<baseUrl>/ui/terminal#ticket=<ticket>&session=<terminal id>
<baseUrl>/ui/vnc#ticket=<ticket>&password=<vnc password>[&viewOnly=1]
```

- URLs come from `client.terminalPageUrl(id)` / `client.vncPageUrl()`, each with a fresh ticket.
- `WebSurface` only accepts messages from the sandbox's origin
  (`allowedOrigin`) and pins navigation to it; other links (for example OSC 8
  links in the terminal, which xterm confirms first) open in the OS browser.
- The message contract is in [protocol.md](protocol.md#webview-bridge)
  (`@theone/protocol/bridge`). The page asks for a new ticket
  (`terminal-need-ticket`, `vnc-need-ticket`) when its socket drops. The app
  answers automatically, up to 4 times with backoff and again when the app
  returns to the foreground: native via injected `window.theone.reconnect(ticket)`,
  web via `postMessage({ type: "theone-reconnect", ticket })`. It never
  reconnects after `exited` or `error`, and reloads the page if the WebView
  process was terminated.
- Secrets travel only in the fragment, and the page strips it from its history
  ([protocol](protocol.md#authentication)).

## Web build

`bunx expo export --platform web` produces a static site (every route, including
`/sandbox/projects/new`). Known issue: with the current
`src/components/app-tabs.web.tsx` every tab route renders blank on web
("Couldn't find any screens for the navigator"), because expo-router's `TabList`
only finds `TabTrigger`s that are direct children of its single `asChild`
element and here they sit two levels down. Moving the `View`/`ThemedView`
wrapper into a component that renders `{children}` (like the Expo template's
`CustomTabList`) fixes it; the e2e web flow passes with that change
([e2e-testing](../runbooks/e2e-testing.md#mobile-web-flow)). Other web gaps: a
hydration warning (#418) on load of the static export, header icon buttons
without icons on the project and build screens, and a tab bar wider than a
390 px viewport.

## Dev build requirement

`react-native-webview`, `expo-camera`, `expo-secure-store` and `expo-sqlite`
are native modules. Use a development build: `bun run android` / `bun run ios`
in `apps/mobile` (`expo run:*`), or an EAS development build. Then run
`bun run mobile` for Metro. Expo Go is not supported for this feature,
because it ships its own module versions and cannot open custom `theone://`
links. Native folders are generated (continuous native generation) and
gitignored.

Config plugins for native permissions and settings (camera usage text, secure
store) belong in `app.json` → `plugins`. Rebuild the dev client after changing them.

## Adding a screen (CODING.md)

1. **Route file** in `src/app/sandbox/…`, registered in the root `Stack` if it
   needs options. It only composes components and calls one screen hook, with
   no data logic and no constants.
2. **Screen hook** in `features/sandbox/hooks/use-<screen>.ts`: queries,
   mutations, navigation and derived view data.
3. **Data access** via `use-sandbox-queries` / `use-sandbox-mutations`
   (add a query key to `api/query-keys.ts`). If a new `ServerEvent` affects
   the data, extend `api/cache.ts`.
4. **Components**: reuse `src/components/*` first. Feature-specific ones go
   in `features/sandbox/components/<name>/index.tsx` with `styles.ts` next to
   them. Labels, icons and state tones go in `features/sandbox/utils/`, not in
   UI files.
5. **No unnecessary comments.** Typecheck with `bun run typecheck` in
   `apps/mobile` (`tsc --noEmit`), run `bun run test` there (jest) and
   `bun run lint` (`expo lint`), and add tests under `apps/mobile/tests/`.

New wire features start in the blueprint and `@theone/protocol`, then
`@theone/client`, then this module ([monorepo.md](monorepo.md#adding-things)).
