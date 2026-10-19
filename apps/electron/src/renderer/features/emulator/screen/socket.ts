import type { TesseractClient } from "@tesseract/client";
import { isFixtureMode } from "../../../app/runtime";
import { FixtureSocket } from "../../../fixtures/socket";
import type { ScreenSessionDeps, ScreenSocket } from "./session";

export function screenSocketOpener(client: TesseractClient): ScreenSessionDeps["openSocket"] {
  return async (path, query) => {
    const { ticket } = await client.createTicket();
    const url = new URL(client.wsUrl(path, ticket));
    query.forEach((value, key) => url.searchParams.set(key, value));
    return isFixtureMode() ? new FixtureSocket(url.toString()) : (new WebSocket(url.toString()) as unknown as ScreenSocket);
  };
}
