import { parse } from "yaml";

export const SMOKE_ROUTE = "/onboarding/welcome";
export const SMOKE_SIZE = { width: 880, height: 620 } as const;
export const SMOKE_TIMEOUT_MS = 60_000;

export const APP_EXECUTABLE = "tesseract-desktop";

export const PACKAGED_FILES = [
  { path: APP_EXECUTABLE, executable: true },
  { path: "resources/app.asar", executable: false },
  { path: "resources/app-update.yml", executable: false },
  { path: "resources/bin/tesseract", executable: true },
  { path: "resources/bin/tesseract-controller", executable: true },
  { path: "resources/sandbox/manifest.json", executable: false },
  { path: "resources/sandbox/build-weights.json", executable: false },
  { path: "resources/sandbox/infra/docker/sandbox/Dockerfile", executable: false },
  { path: "resources/icons/512x512.png", executable: false },
  { path: "resources/icons/tray.png", executable: false },
  { path: "resources/licenses/LICENSE-inter", executable: false },
] as const;

export const DESKTOP_ENTRY = "usr/share/applications/dev.tesseract.Desktop.desktop";

export const DEB_FILES = [
  "opt/Tesseract/tesseract-desktop",
  "opt/Tesseract/resources/bin/tesseract",
  "opt/Tesseract/resources/app.asar",
  "opt/Tesseract/resources/apparmor-profile",
  DESKTOP_ENTRY,
] as const;

export const DEB_POSTINST_MARKERS = ["APP_DIR='/opt/Tesseract'", "CLI_LINK=/usr/bin/tesseract", 'CLI_TARGET="$APP_DIR/resources/bin/tesseract"'] as const;

export const DESKTOP_ENTRY_LINES = [
  "Exec=/opt/Tesseract/tesseract-desktop %U",
  "StartupWMClass=dev.tesseract.Desktop",
  "MimeType=x-scheme-handler/tesseract;",
] as const;

export function artifactName(version: string, ext: "AppImage" | "deb"): string {
  return ext === "AppImage" ? `Tesseract-${version}-x86_64.AppImage` : `Tesseract-${version}-amd64.deb`;
}

export function parseCliVersion(output: string): string | null {
  return /^tesseract\s+(\S+)/m.exec(output.trim())?.[1] ?? null;
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
