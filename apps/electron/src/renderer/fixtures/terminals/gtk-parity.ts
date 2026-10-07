import type { TerminalInfo } from "@theone/protocol";
import { isParityVariant, PARITY_VARIANTS, parityProjectId, pending } from "../shell/parity";
import { fixtureTerminals } from "./data";

export function parityTerminals(): TerminalInfo[] | Promise<never> {
  if (isParityVariant(PARITY_VARIANTS.terminalsLoading)) return pending();
  return fixtureTerminals().map((terminal) => ({ ...terminal, projectId: parityProjectId(terminal.projectId) }));
}
