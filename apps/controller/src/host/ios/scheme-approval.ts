import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { IosConfig } from "./config";
import type { CommandRunner } from "./runner";

const PLIST_TIMEOUT_MS = 10_000;
/** `simctl openurl` comes from this bridge; iOS asks "Open in …?" once per scheme unless the pair is approved. */
const BRIDGE = "com.apple.CoreSimulator.CoreSimulatorBridge";

/** `~/Library/Developer/CoreSimulator/Devices/<udid>/data/Library/Preferences/com.apple.launchservices.schemeapproval.plist`. */
export function schemeApprovalPath(home: string, udid: string): string {
  return join(home, "Library", "Developer", "CoreSimulator", "Devices", udid, "data", "Library", "Preferences", "com.apple.launchservices.schemeapproval.plist");
}

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A flat string → string dictionary as an XML property list (CFPreferences reads XML and binary alike). */
export function stringPlist(entries: Record<string, string>): string {
  const body = Object.entries(entries)
    .map(([key, value]) => `\t<key>${escapeXml(key)}</key>\n\t<string>${escapeXml(value)}</string>\n`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
}

function stringEntries(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

/**
 * Lets `simctl openurl` open `url`'s scheme in `appId` without the "Open in …?" prompt, which nobody sees on a
 * headless host (the run would look ready while the app never opened). Same file Expo CLI rewrites for `expo start --ios`.
 */
export async function approveUrlScheme(config: IosConfig, runner: CommandRunner, udid: string, url: string, appId: string, home = config.env.HOME || homedir()): Promise<void> {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1];
  if (!scheme || config.platform !== "darwin") return;
  const path = schemeApprovalPath(home, udid);
  const key = `${BRIDGE}-->${scheme}`;
  let entries: Record<string, string> = {};
  if (existsSync(path)) {
    const current = await runner(["plutil", "-convert", "json", "-o", "-", path], { env: config.env, timeoutMs: PLIST_TIMEOUT_MS });
    if (!current.ok) throw new Error(`Couldn't read ${path}: ${current.stderr.trim() || "plutil failed"}`);
    entries = stringEntries(current.stdout);
  }
  if (entries[key] === appId) return;
  entries[key] = appId;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringPlist(entries));
}
