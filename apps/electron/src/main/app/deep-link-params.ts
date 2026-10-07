import type { PageId } from "../../shared/routes";
import { DEEP_LINK_FLAG_VALUES } from "../constants";

type PageParams = Record<string, string | boolean>;
type ParamKind = "text" | "flag";

const PAGE_PARAMS: Record<PageId, Record<string, ParamKind>> = {
  overview: {},
  agents: { new: "flag", search: "flag", runId: "text", prompt: "text", filter: "text" },
  projects: { projectId: "text", tab: "text", create: "flag" },
  files: { view: "text" },
  terminals: { terminalId: "text" },
  display: {},
};

function flag(value: string): boolean {
  return DEEP_LINK_FLAG_VALUES.includes(value.trim().toLowerCase());
}

export function deepLinkParams(page: PageId, search: URLSearchParams): PageParams {
  const allowed = PAGE_PARAMS[page];
  const params: PageParams = {};
  for (const [key, kind] of Object.entries(allowed)) {
    const value = search.get(key);
    if (value === null) continue;
    if (kind === "flag") {
      if (flag(value)) params[key] = true;
    } else if (value.trim()) {
      params[key] = value;
    }
  }
  return params;
}
