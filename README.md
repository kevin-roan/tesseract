# theone

An [Expo](https://expo.dev) app (SDK 56) using [expo-router](https://docs.expo.dev/router/introduction/) for file-based routing.

## Getting started

```bash
npm install
npx expo start
```

Then open the app on iOS, Android or the web. Native projects are generated with
`npx expo prebuild` and are not checked in.

## Structure

```
src/
  app/        routes (expo-router)
  features/   feature modules, each owning its components/hooks/api/store
  components/ shared presentational components
  services/   api, ai, storage, audio, notifications
  theme/      design tokens — colors, spacing, typography, motion
  hooks/      shared hooks
  lib/        pure helpers
```

Design tokens come from `@/theme`; use `useAppTheme()` for viewport-aware
values and `useResponsive()` for breakpoint checks.
