import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useIsFocused } from "expo-router";

import type { AttachSource, PickedFile } from "@/features/attachments/types";

import { useIslandStore } from "../store/island-store";
import { mergeDraftText } from "../utils/shared";

type DraftInjectionTarget = {
  setText: Dispatch<SetStateAction<string>>;
  add: (files: PickedFile[], source: AttachSource) => void;
};

/** Pulls the island's pending draft into the composer that is on screen, once. */
export function useDraftInjection({ setText, add }: DraftInjectionTarget): void {
  const focused = useIsFocused();
  const pending = useIslandStore((state) => state.pendingDraft);
  const takePendingDraft = useIslandStore((state) => state.takePendingDraft);

  useEffect(() => {
    if (!focused || !pending) return;
    const draft = takePendingDraft();
    if (!draft) return;
    if (draft.text) setText((current) => mergeDraftText(current, draft.text));
    if (draft.files.length > 0) add(draft.files, draft.source);
  }, [focused, pending, takePendingDraft, setText, add]);
}
