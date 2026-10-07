# Monolith landing page

Next.js 16 (App Router, Turbopack) + Motion + Lenis. Linear-style: Inter, near-black, hairlines. Standalone package with its own `bun.lock`; it is not a workspace of the monorepo.

```bash
bun install --frozen-lockfile
bun run dev        # http://localhost:3100
bun run build && bun run start
bun run typecheck
```

## Content

- Copy, sections, downloads: `src/content/site.ts`
- Phone screenshots: `public/screens/*.png`, real 1206×2622 iPhone captures. The status bar (top 172 px) is filled with the screen background and redrawn as a clean 9:41 bar by `components/device.tsx`. The tailnet IP on `projects-dark.png` is blurred.
- To swap a screenshot, replace the PNG (same size) and fill its top 172 px: `magick in.png -fill "#0d0d0d" -draw "rectangle 0,0 1205,172" out.png`

## Environment

Download buttons show "Coming soon" until their URL is set at build time:

| Variable | Button |
|---|---|
| `NEXT_PUBLIC_APP_STORE_URL` | App Store |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Google Play |
| `NEXT_PUBLIC_APK_URL` | Android APK |
| `NEXT_PUBLIC_DESKTOP_URL` | Linux desktop app |
| `NEXT_PUBLIC_SANDBOX_URL` | Sandbox image |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata |
