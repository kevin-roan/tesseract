import { routePatterns } from "@tesseract/protocol";
import { httpFixtures } from "../registry";
import type { HttpFixtureRequest, HttpFixtureRoute } from "../types";
import { isParityVariant, PARITY_VARIANTS, pending } from "./parity";

const rest = routePatterns.rest;

function gate(method: string, path: string, variants: readonly string[]): HttpFixtureRoute {
  const route: HttpFixtureRoute = {
    method,
    path,
    respond: (request: HttpFixtureRequest) => {
      if (isParityVariant(...variants)) return pending();
      return httpFixtures.find((next) => next !== route && next.method === method && next.path === path)?.respond(request);
    },
  };
  return route;
}

export const PARITY_GATES: readonly HttpFixtureRoute[] = [
  gate("GET", rest.projects, [PARITY_VARIANTS.loading]),
  gate("POST", rest.authTicket, [PARITY_VARIANTS.loading, PARITY_VARIANTS.connecting]),
];
