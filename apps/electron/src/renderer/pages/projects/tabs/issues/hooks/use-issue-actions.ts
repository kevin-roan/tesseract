import { ApiError } from "@tesseract/client";
import type { Issue, UpdateIssue } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { useApiClient } from "../../../../../app/data";
import { showToast } from "../../../../../components/Toast";
import { NOT_FOUND_STATUS } from "../../../../../features/projects/constants";
import { CREATE_LABELS } from "../labels";
import { draftBody, dropUpdate, issueIdentifier } from "../model";
import type { DropPosition, IssueDraft } from "../types";
import type { IssuesCache } from "./use-issues-cache";

export interface IssueActions {
  create(draft: IssueDraft): Promise<Issue | null>;
  update(id: string, patch: UpdateIssue): Promise<void>;
  move(id: string, target: DropPosition): Promise<void>;
  remove(id: string): Promise<boolean>;
  dispatch(id: string): Promise<void>;
  comment(id: string, body: string): Promise<boolean>;
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === NOT_FOUND_STATUS;

export function useIssueActions(projectId: string, cache: IssuesCache, report: (error: unknown) => void): IssueActions {
  const client = useApiClient();

  const update = useCallback(
    async (id: string, patch: UpdateIssue) => {
      if (!client) return;
      const previous = cache.find(id);
      cache.patch(id, patch);
      try {
        cache.upsert(await client.updateIssue(id, patch));
      } catch (error) {
        if (previous) cache.upsert(previous);
        if (isNotFound(error)) cache.remove(id);
        else report(error);
      }
    },
    [client, cache, report],
  );

  const move = useCallback(
    async (id: string, target: DropPosition) => {
      const patch = dropUpdate(cache.list() ?? [], id, target);
      if (patch) await update(id, patch);
    },
    [cache, update],
  );

  const create = useCallback(
    async (draft: IssueDraft) => {
      if (!client) return null;
      try {
        const issue = await client.createIssue(projectId, draftBody(draft));
        cache.upsert(issue);
        showToast(CREATE_LABELS.created(issueIdentifier(issue)));
        return issue;
      } catch (error) {
        report(error);
        return null;
      }
    },
    [client, projectId, cache, report],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!client) return false;
      try {
        await client.deleteIssue(id);
      } catch (error) {
        if (!isNotFound(error)) {
          report(error);
          return false;
        }
      }
      cache.remove(id);
      return true;
    },
    [client, cache, report],
  );

  const dispatch = useCallback(
    async (id: string) => {
      if (!client) return;
      try {
        cache.upsert(await client.dispatchIssue(id));
      } catch (error) {
        report(error);
        cache.refreshDetail(id);
      }
    },
    [client, cache, report],
  );

  const comment = useCallback(
    async (id: string, body: string) => {
      if (!client) return false;
      try {
        cache.addComment(await client.commentOnIssue(id, { body }));
        return true;
      } catch (error) {
        report(error);
        return false;
      }
    },
    [client, cache, report],
  );

  return useMemo(() => ({ create, update, move, remove, dispatch, comment }), [create, update, move, remove, dispatch, comment]);
}
