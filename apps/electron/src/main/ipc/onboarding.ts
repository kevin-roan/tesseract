import { shell } from "electron";
import { ONBOARDING_URLS } from "../../core/onboarding/urls";
import type { OnboardingUrlKey } from "../../shared/contracts/onboarding";
import { IpcError } from "../../shared/ipc-types";
import { onboarding } from "../services/onboarding";
import { defineService } from "./_framework/define";

function isUrlKey(key: unknown): key is OnboardingUrlKey {
  return typeof key === "string" && Object.hasOwn(ONBOARDING_URLS, key);
}

export default defineService(
  "onboarding",
  {
    get: () => onboarding.get(),
    goto: (_context, step) => onboarding.goto(step),
    skip: (_context, step) => onboarding.skip(step),
    dockerCheck: () => onboarding.dockerCheck(),
    dockerInstall: (_context, request) => onboarding.dockerInstall(request),
    dockerStart: () => onboarding.dockerStart(),
    claudeCheck: () => onboarding.claudeCheck(),
    claudeCreateDir: () => onboarding.claudeCreateDir(),
    sandboxSave: (_context, choices) => onboarding.sandboxSave(choices),
    buildStart: (_context, mode) => onboarding.buildStart(mode),
    buildCancel: () => onboarding.buildCancel(),
    sandboxAdopt: () => onboarding.sandboxAdopt(),
    androidCatalog: (_context, refresh) => onboarding.androidCatalog(Boolean(refresh)),
    androidAcceptLicense: (_context, licenseId) => onboarding.androidAcceptLicense(licenseId),
    androidInstall: (_context, plan) => onboarding.androidInstall(plan),
    androidCancel: () => onboarding.androidCancel(),
    androidUseExisting: (_context, sdkRoot, avd) => onboarding.androidUseExisting(String(sdkRoot), String(avd)),
    pairLoad: () => onboarding.pairLoad(),
    connectRemote: (_context, input) => onboarding.connectRemote(input),
    finish: (_context, sandboxAutostart) => onboarding.finish(Boolean(sandboxAutostart)),
    openExternal: async (_context, key) => {
      if (!isUrlKey(key)) throw new IpcError("invalid_argument", "Unknown link");
      await shell.openExternal(ONBOARDING_URLS[key]);
    },
  },
  {
    start: (emitter) => {
      const detach = onboarding.attach();
      const unsubscribe = onboarding.subscribe((state) => emitter.emit("state", state));
      return () => {
        unsubscribe();
        detach();
      };
    },
  },
);
