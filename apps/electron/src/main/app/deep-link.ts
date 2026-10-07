import type { AppCommand } from "../../shared/contracts/app";
import { DEEP_LINK_SCHEME } from "../../shared/runtime";
import { isOnboardingStepId, isPageId, isPreferencesSectionId, type OnboardingStepId } from "../../shared/routes";
import { DEEP_LINK_ONBOARDING, DEEP_LINK_PREFERENCES } from "../constants";
import { deepLinkParams } from "./deep-link-params";

export type LaunchAction =
  | { kind: "show" }
  | { kind: "command"; command: AppCommand }
  | { kind: "onboarding"; step?: OnboardingStepId };

const SIMPLE_COMMANDS: Record<string, AppCommand> = {
  "new-conversation": { type: "new-conversation" },
  pair: { type: "pair" },
  "pair-host": { type: "pair-host" },
  refresh: { type: "refresh" },
  rediscover: { type: "rediscover" },
  about: { type: "about" },
};

function segments(url: URL): string[] {
  const path = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  return url.hostname ? [url.hostname, ...path] : path;
}

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

export function actionFromDeepLink(raw: string): LaunchAction | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return null;
  const [target = "", detail = ""] = segments(url).map((part) => decodeURIComponent(part).toLowerCase());
  if (!target) return { kind: "show" };
  if (isPageId(target)) {
    return { kind: "command", command: { type: "navigate", page: target, params: deepLinkParams(target, url.searchParams) } };
  }
  if (includes(DEEP_LINK_PREFERENCES, target)) {
    const section = detail || url.searchParams.get("section") || "";
    return { kind: "command", command: { type: "preferences", section: isPreferencesSectionId(section) ? section : undefined } };
  }
  if (includes(DEEP_LINK_ONBOARDING, target)) {
    return { kind: "onboarding", step: isOnboardingStepId(detail) ? detail : undefined };
  }
  const simple = SIMPLE_COMMANDS[target];
  return simple ? { kind: "command", command: simple } : { kind: "show" };
}

export function commandFromDeepLink(url: string): AppCommand | null {
  const action = actionFromDeepLink(url);
  return action?.kind === "command" ? action.command : null;
}
