# tesseract

An [Expo](https://expo.dev) app (SDK 56) using [expo-router](https://docs.expo.dev/router/introduction/) for file-based routing.

## Getting started

This app is the `@tesseract/mobile` workspace of the Tesseract monorepo; install from the
repository root with bun:

```bash
bun install            # at the repository root
bun run android        # in apps/mobile: development build (expo run:android); or bun run ios
bun run start          # in apps/mobile (or `bun run mobile` at the root): Metro
```

The sandbox features use native modules (`react-native-webview`, `expo-camera`,
`expo-secure-store`, `expo-sqlite`), so use a development build, not Expo Go. Native
projects are generated with `expo prebuild` and are not checked in. Checks:
`bun run typecheck`, `bun run test` (jest), `bun run lint`. The sandbox integration is
documented in [docs/architecture/mobile-app.md](../../docs/architecture/mobile-app.md);
the web build currently renders blank tabs (see "Web build" there).

## Structure

```
src/
  app/        routes (expo-router)
  features/   feature modules, each owning its components/hooks/api/store
              (features/sandbox: pairing, hub, projects, builds, terminals, display, Claude runs)
  components/ shared presentational components
  services/   api, ai, storage, audio, notifications
  theme/      design tokens — colors, spacing, typography, motion
  hooks/      shared hooks
  lib/        pure helpers
```

Design tokens come from `@/theme`; use `useAppTheme()` for viewport-aware
values and `useResponsive()` for breakpoint checks.
