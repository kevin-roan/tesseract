import { routePatterns } from "@theone/protocol";
import type { CreateTerminal } from "@theone/protocol";
import { currentScenario } from "../scenario";
import { isGtkParity } from "../shell/parity";
import { defineHttpFixtures, reply } from "../types";
import { closeFixtureTerminal, createFixtureTerminal, fixtureTerminals, TERMINAL_SCENARIOS } from "./data";
import { parityTerminals } from "./gtk-parity";

export const SCENARIOS = TERMINAL_SCENARIOS;

const rest = routePatterns.rest;
const NOT_FOUND = 404;
const CREATED = 201;

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.terminals,
    respond: () => {
      if (isGtkParity()) return parityTerminals();
      return currentScenario() === TERMINAL_SCENARIOS.loading ? new Promise<never>(() => undefined) : fixtureTerminals();
    },
  },
  {
    method: "POST",
    path: rest.terminals,
    respond: ({ body }) => reply(CREATED, createFixtureTerminal(body as Partial<CreateTerminal> | undefined)),
  },
  {
    method: "DELETE",
    path: rest.terminal,
    respond: ({ params }) => closeFixtureTerminal(params[0] ?? "") ?? reply(NOT_FOUND, { error: { code: "not_found", message: "Terminal not found" } }),
  },
]);
