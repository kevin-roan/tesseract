import { HOST_SHELL_PORT, HOST_WORKSPACE_PORT } from "@tesseract/protocol";

export const HOST_TAILNET = {
  binary: "tesseract-tailnet",
  /** Under `process.resourcesPath` in packaged builds (electron-builder extraResources `resources/bin/${os}-${arch}`). */
  bundledDir: "bin",
  /** In a checkout: written by native/tailnet/scripts/build-desktop.sh. */
  devDir: ["apps", "electron", "resources", "bin"],
  stateDir: "tailnet",
  metaFile: "tailnet.json",
  hostSuffix: "-host",
  fallbackHost: "tesseract",
  maxHostnameLength: 63,
  loopback: "127.0.0.1",
  ports: { shell: HOST_SHELL_PORT, workspace: HOST_WORKSPACE_PORT },
  backoffMs: [1_000, 2_000, 5_000, 10_000, 30_000],
  /** A node that ran this long resets the backoff. */
  stableMs: 60_000,
  stopGraceMs: 3_000,
  logLimit: 200,
} as const;

/** electron-builder's `${os}` names. */
export const BUILDER_OS: Partial<Record<NodeJS.Platform, string>> = { darwin: "mac", linux: "linux", win32: "win" };

/** Env the host shell and host workspace daemons get while the node runs (apps/controller/src/host/{config,workspace}.ts). */
export const HOST_TAILNET_ENV = {
  shellBind: "TESSERACT_HOST_SHELL_BIND",
  shellPublicUrl: "TESSERACT_HOST_SHELL_PUBLIC_URL",
  workspaceBind: "TESSERACT_HOST_WORKSPACE_BIND",
  workspacePublicUrl: "TESSERACT_HOST_WORKSPACE_PUBLIC_URL",
} as const;

export const HOST_TAILNET_ENV_KEYS = Object.values(HOST_TAILNET_ENV);
