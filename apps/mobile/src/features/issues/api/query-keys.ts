export type IssueListFilter = { projectId?: string };

const filterKey = (filter?: IssueListFilter): IssueListFilter => (filter?.projectId ? { projectId: filter.projectId } : {});

export const issueKeys = {
  lists: (sandboxId: string) => ["sandbox", sandboxId, "issues", "list"] as const,
  list: (sandboxId: string, filter?: IssueListFilter) => ["sandbox", sandboxId, "issues", "list", filterKey(filter)] as const,
  detail: (sandboxId: string, issueId: string) => ["sandbox", sandboxId, "issues", "detail", issueId] as const,
};
