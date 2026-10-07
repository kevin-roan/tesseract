import { parse } from "yaml";

export const SMOKE_ROUTE = "/onboarding/welcome";
export const SMOKE_SIZE = { width: 880, height: 620 } as const;
export const SMOKE_TIMEOUT_MS = 60_000;

export const APP_EXECUTABLE = "monolith-desktop";

export const PACKAGED_FILES = [
  { path: APP_EXECUTABLE, executable: true },
  { path: "resources/app.asar", executable: false },
  { path: "resources/app-update.yml", executable: false },
  { path: "resources/bin/monolith", executable: true },
  { path: "resources/bin/theone-controller", executable: true },
  { path: "resources/sandbox/manifest.json", executable: false },
  { path: "resources/sandbox/build-weights.json", executable: false },
  { path: "resources/sandbox/infra/docker/sandbox/Dockerfile", executable: false },
  { path: "resources/icons/512x512.png", executable: false },
  { path: "resources/icons/tray.png", executable: false },
  { path: "resources/licenses/LICENSE-inter", executable: false },
] as const;

export const DESKTOP_ENTRY = "usr/share/applications/dev.monolith.Desktop.desktop";

export const DEB_FILES = [
  "opt/Monolith/monolith-desktop",
  "opt/Monolith/resources/bin/monolith",
  "opt/Monolith/resources/app.asar",
  "opt/Monolith/resources/apparmor-profile",
  DESKTOP_ENTRY,
] as const;

export const DEB_POSTINST_MARKERS = ["APP_DIR='/opt/Monolith'", "CLI_LINK=/usr/bin/monolith", 'CLI_TARGET="$APP_DIR/resources/bin/monolith"'] as const;

export const DESKTOP_ENTRY_LINES = [
  "Exec=/opt/Monolith/monolith-desktop %U",
  "StartupWMClass=dev.monolith.Desktop",
  "MimeType=x-scheme-handler/monolith;",
] as const;

export function artifactName(version: string, ext: "AppImage" | "deb"): string {
  return ext === "AppImage" ? `Monolith-${version}-x86_64.AppImage` : `Monolith-${version}-amd64.deb`;
}

export function parseCliVersion(output: string): string | null {
  return /^monolith\s+(\S+)/m.exec(output.trim())?.[1] ?? null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function pngSize(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 24 || PNG_SIGNATURE.some((byte, index) => buffer[index] !== byte)) return null;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export interface UpdateFeed {
  provider: string | null;
  url: string | null;
  channel: string | null;
}

export function parseUpdateFeed(text: string): UpdateFeed {
  const data = (parse(text) ?? {}) as Record<string, unknown>;
  const field = (name: string) => (typeof data[name] === "string" ? (data[name] as string) : null);
  return { provider: field("provider"), url: field("url"), channel: field("channel") };
}
