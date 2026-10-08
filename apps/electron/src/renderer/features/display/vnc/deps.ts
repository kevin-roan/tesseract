import { ApiError, type TesseractClient } from "@tesseract/client";
import { wsPaths } from "@tesseract/protocol";
import { describeError, isUnauthorizedError } from "../../../app/connection";
import { isFixtureMode } from "../../../app/runtime";
import { scenarioVncChannel } from "../../../fixtures/display/vnc-server";
import { createNoVncRfb } from "./rfb";
import type { RfbChannel } from "./rfb-types";
import type { SessionDeps } from "./session";

const FORBIDDEN = 403;

function isAuthError(error: unknown): boolean {
  return isUnauthorizedError(error) || (error instanceof ApiError && error.status === FORBIDDEN);
}

export function sessionDepsFor(client: TesseractClient | null): SessionDeps | null {
  if (!client) return null;
  const fixtures = isFixtureMode();
  return {
    fetchStatus: (signal) => client.displayStatus({ signal }),
    createTicket: async (signal) => (await client.createTicket({ signal })).ticket,
    openChannel: (ticket) => (fixtures ? (scenarioVncChannel() as RfbChannel) : client.wsUrl(wsPaths.vnc(), ticket)),
    createRfb: createNoVncRfb,
    isAuthError,
    describeError,
  };
}
