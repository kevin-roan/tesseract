# ADR 0008: Mobile server state with react-query plus an events socket

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The phone shows state owned by the sandbox: status, projects, processes,
builds, artifacts, terminals and agent runs. That state changes without user
action (a build moves to `package`, Claude emits a status). Phones lose
connectivity and get suspended often. The existing app already uses zustand
for local UI state.

## Decision

- **Server state** lives in `@tanstack/react-query`. The `QueryClientProvider`
  sits in the root layout. Queries call `@theone/client`. Query keys are
  scoped by sandbox id, so switching sandboxes never mixes caches.
- **Live updates** come from one `/v1/events` WebSocket per *active* sandbox.
  Each `ServerEvent` carries the full object, which is patched into the
  matching queries (`setQueryData`) and invalidates list queries where
  patching is ambiguous. `status` events feed an activity list.
- **On (re)connect** (the `hello` frame after a disconnect, or the app
  returning to the foreground) the app invalidates the sandbox's queries,
  because the socket does not replay missed events.
- **Client state** (paired sandboxes, the active sandbox) lives in a zustand
  store. The token is in `expo-secure-store`, never in the zustand persistence.
- Streams (terminal output, logs, agent-run events) stay out of react-query.
  They are handled by the WebView pages or by dedicated hooks that hold a
  bounded buffer.

## Consequences

- Screens get caching, deduplication, retry and focus refetch for free, and
  push updates keep them current without polling.
- Every event type needs a mapping to query keys. Missing mappings show up as
  stale screens until the next invalidation.
- Only the active sandbox is live. Others refresh when they are selected.
- Because events carry whole objects, a slow phone may receive large build
  objects repeatedly while a build is running. That is acceptable at MVP scale.

## Alternatives considered

- **Polling only.** Simple, but it wastes battery and shows builds and statuses late.
- **Keeping everything in zustand.** Means rebuilding caching, retries,
  loading states and invalidation by hand.
- **Redux Toolkit Query.** Capable, but it would add Redux next to the existing zustand setup.
- **Server-Sent Events.** One-way is enough for events, but React Native has
  no built-in EventSource, and the terminal and VNC need WebSockets anyway.

## Implementation notes (2026-09-23)

- The paired-sandbox list is persisted through `expo-sqlite/kv-store`
  (`localStorage` on web); tokens use `expo-secure-store` (`localStorage` on web,
  development only).
- The events socket reopens on foreground even after the client gave up, and
  skips its backoff when the network returns. Log and run streams reconnect with
  fresh tickets after abnormal closes (the controller drops slow sockets) and
  give up after 5 drops that never opened.
- A 401/403 or protocol mismatch is stored as a per-sandbox issue and shown with
  a **Pair again** action instead of an endless retry.
