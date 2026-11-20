import { IpcError } from "../../shared/ipc-types";
import { createLogger } from "../../core/log";
import { mainContext } from "../context";
import { accountService } from "../services/account";
import { defineService } from "./_framework/define";

const log = createLogger("account");

function text(value: unknown, field: string): string {
  if (typeof value !== "string") throw new IpcError("invalid_argument", `${field} must be a string`);
  return value;
}

export default defineService(
  "account",
  {
    state: () => accountService().state(),
    setServer: (_context, url) => accountService().setServer(text(url, "url")),
    signIn: (_context, email, password) => accountService().signIn(text(email, "email"), text(password, "password")),
    signUp: (_context, email, password, displayName) =>
      accountService().signUp(text(email, "email"), text(password, "password"), typeof displayName === "string" ? displayName : undefined),
    signOut: () => accountService().signOut(),
    refresh: () => accountService().refresh(),
    devices: () => accountService().devices(),
    removeDevice: (_context, id) => accountService().removeDevice(text(id, "id")),
    deleteAccount: () => accountService().deleteAccount(),
  },
  {
    start: async () => {
      if (mainContext().fixtures) return;
      await accountService()
        .load()
        .then(() => accountService().refresh())
        .catch((error: unknown) => log.warn(`account load failed: ${error instanceof Error ? error.message : String(error)}`));
    },
  },
);
