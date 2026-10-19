import { routePatterns } from "@tesseract/protocol";
import { defineHttpFixtures, reply } from "../types";
import { fixtureRuntime, stopFixtureRuntime } from "./data";

const rest = routePatterns.rest;
const NOT_FOUND = 404;

export default defineHttpFixtures([
  { method: "GET", path: rest.runtime, respond: () => fixtureRuntime() },
  {
    method: "DELETE",
    path: rest.runtimeEntry,
    respond: ({ params }) =>
      stopFixtureRuntime(params[0] ?? "", params[1] ?? "") ?? reply(NOT_FOUND, { error: { code: "not_found", message: "Not running" } }),
  },
]);
