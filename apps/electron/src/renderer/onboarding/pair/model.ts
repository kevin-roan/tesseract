import type { PairingInfo } from "../../../shared/contracts/sandbox";
import { fill } from "../../components/PairDialog";
import { PAIR_STEP_LABELS } from "./labels";

export type PairStepView =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; link: string; local: boolean; caption: string };

export function pairCaption(pair: PairingInfo): string {
  return pair.name ? fill(PAIR_STEP_LABELS.caption, { name: pair.name, url: pair.url }) : pair.url;
}

export function pairView(pair: PairingInfo | null, error: string | null, loading: boolean): PairStepView {
  if (pair && pair.link)
    return {
      kind: "ready",
      link: pair.link,
      local: pair.local,
      caption: pairCaption(pair),
    };
  if (error && !loading)
    return {
      kind: "error",
      message: fill(PAIR_STEP_LABELS.invalid, { error }),
    };
  return { kind: "loading" };
}
