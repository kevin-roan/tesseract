import { useApiQuery } from "../../../../../app/data";
import { ISSUES_QUERY_KEYS } from "../constants";

export function useIssueDetail(id: string | null) {
  const query = useApiQuery(ISSUES_QUERY_KEYS.detail(id ?? ""), (client, signal) => client.getIssue(id ?? "", { signal }), {
    enabled: id !== null,
  });
  return { detail: id !== null ? (query.data ?? null) : null, error: query.error };
}
