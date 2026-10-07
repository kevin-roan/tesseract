import { routePatterns, type ClaudeAccountList, type SttStatus, type UpdateStt } from "@theone/protocol";
import { sampleClaudeAccountList, sampleClaudeAuthStatus, sampleSttStatus } from "@theone/protocol/fixtures";
import { isScenario } from "../scenario";
import { defineHttpFixtures, reply } from "../types";
import { GTK_PARITY_DEFAULT_ACCOUNT, PREFERENCES_SCENARIOS } from "./data";

export const SCENARIOS = PREFERENCES_SCENARIOS;

const rest = routePatterns.rest;
const NOT_FOUND = { error: { code: "not_found", message: "Not found" } };

let stt: SttStatus = sampleSttStatus;
let accounts: ClaudeAccountList = isScenario(PREFERENCES_SCENARIOS.gtkParity)
  ? { ...sampleClaudeAccountList, defaultAccountId: GTK_PARITY_DEFAULT_ACCOUNT }
  : sampleClaudeAccountList;

function currentStt(): SttStatus {
  if (isScenario(PREFERENCES_SCENARIOS.geminiSaved)) return { ...stt, gemini: { ...stt.gemini, configured: true, source: "settings" } };
  return stt;
}

function applyStt(body: UpdateStt): SttStatus {
  const gemini =
    body.geminiApiKey === undefined
      ? stt.gemini
      : { ...stt.gemini, configured: body.geminiApiKey !== null, source: body.geminiApiKey === null ? null : ("settings" as const) };
  stt = { ...stt, profile: body.profile ?? stt.profile, gemini };
  return stt;
}

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.stt,
    respond: () => {
      if (isScenario(PREFERENCES_SCENARIOS.outdated)) return reply(404, NOT_FOUND);
      return currentStt();
    },
  },
  { method: "PUT", path: rest.stt, respond: (request) => applyStt(request.body as UpdateStt) },
  {
    method: "GET",
    path: rest.claudeAuth,
    respond: () => (isScenario(PREFERENCES_SCENARIOS.outdated) ? reply(404, NOT_FOUND) : sampleClaudeAuthStatus),
  },
  {
    method: "GET",
    path: rest.claudeAccounts,
    respond: () => (isScenario(PREFERENCES_SCENARIOS.outdated) ? reply(404, NOT_FOUND) : accounts),
  },
  {
    method: "PUT",
    path: rest.claudeDefaultAccount,
    respond: (request) => {
      const { accountId } = request.body as { accountId: string };
      accounts = { ...accounts, defaultAccountId: accountId };
      return accounts;
    },
  },
]);
