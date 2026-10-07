import type { ParsedArgs } from "./args.ts";
import { findTarget, hostTargetId } from "./targets.ts";

export type DistPlatform = "linux" | "mac" | "win";
export type PublishMode = "never" | "always" | "onTag" | "onTagOrDraft";

export const DIST_PLATFORMS: readonly DistPlatform[] = ["linux", "mac", "win"];
export const PUBLISH_MODES: readonly PublishMode[] = ["never", "always", "onTag", "onTagOrDraft"];
export const DIST_VALUE_FLAGS = ["platform", "publish", "update-url", "channel"] as const;

export const BUILDER_PLATFORM_FLAG: Record<DistPlatform, string> = { linux: "--linux", mac: "--mac", win: "--win" };
export const CLI_TARGETS: Record<DistPlatform, readonly string[]> = {
  linux: ["linux-x64"],
  mac: ["mac-x64", "mac-arm64"],
  win: ["win-x64"],
};

export const DIST_ENV = { updateUrl: "MONOLITH_UPDATE_URL", channel: "MONOLITH_UPDATE_CHANNEL" } as const;

export interface DistPlan {
  platform: DistPlatform;
  dir: boolean;
  publish: PublishMode;
  updateUrl: string | null;
  channel: string | null;
  build: boolean;
  cli: boolean;
  sandbox: boolean;
  smoke: boolean;
}

const CHANNEL = /^[a-z][a-z0-9-]*$/;

function oneOf<T extends string>(name: string, raw: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new Error(`--${name} must be one of ${allowed.join(", ")} (got ${raw})`);
}

function updateUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`update URL must be http(s): ${raw}`);
  return raw.replace(/\/+$/, "");
}

function channel(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!CHANNEL.test(raw)) throw new Error(`update channel must match ${CHANNEL.source}: ${raw}`);
  return raw;
}

export function hostPlatform(): DistPlatform {
  return hostTargetId().split("-")[0] as DistPlatform;
}

export function distPlan(args: ParsedArgs, env: Readonly<Record<string, string | undefined>>, host: DistPlatform = hostPlatform()): DistPlan {
  const platform = oneOf("platform", args.values.get("platform") ?? host, DIST_PLATFORMS);
  const dir = args.flags.has("dir");
  const smoke = args.flags.has("smoke");
  if (smoke && (platform !== "linux" || host !== "linux")) throw new Error("--smoke runs the Linux AppImage and needs a Linux host");
  if (smoke && dir) throw new Error("--smoke needs the AppImage; drop --dir");
  return {
    platform,
    dir,
    publish: oneOf("publish", args.values.get("publish") ?? "never", PUBLISH_MODES),
    updateUrl: updateUrl(args.values.get("update-url") ?? env[DIST_ENV.updateUrl]),
    channel: channel(args.values.get("channel") ?? env[DIST_ENV.channel]),
    build: !args.flags.has("skip-build"),
    cli: !args.flags.has("skip-cli"),
    sandbox: !args.flags.has("skip-sandbox"),
    smoke,
  };
}

export function builderArgs(plan: DistPlan, config = "electron-builder.yml"): string[] {
  const args = ["--config", config, BUILDER_PLATFORM_FLAG[plan.platform], "--publish", plan.publish];
  if (plan.dir) args.push("--dir");
  if (plan.updateUrl) args.push(`-c.publish.url=${plan.updateUrl}`);
  if (plan.channel) args.push(`-c.publish.channel=${plan.channel}`);
  return args;
}

export const CLI_BINARIES = ["tesseract", "theone-controller"] as const;

export function requiredCliFiles(platform: DistPlatform): string[] {
  return CLI_TARGETS[platform].flatMap((id) => {
    const target = findTarget(id);
    return CLI_BINARIES.map((name) => `dist-cli/${target.builderOs}-${target.arch}/${name}${target.exe}`);
  });
}
