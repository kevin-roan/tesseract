import { useCallback, useState } from "react";

import { useSandboxStore } from "../store/sandbox-store";
import type { PairedSandbox, RenameSheetState } from "../types";
import { SANDBOX_RENAME_HINT, sandboxRenameError } from "../utils/sandbox-rename";

/** A sheet that edits the name a paired sandbox has on this device. */
export function useSandboxRename() {
  const renameSandbox = useSandboxStore((state) => state.renameSandbox);
  const [target, setTarget] = useState<Pick<PairedSandbox, "id" | "name"> | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((sandbox: Pick<PairedSandbox, "id" | "name">) => {
    setError(null);
    setName(sandbox.name);
    setTarget(sandbox);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const change = useCallback((text: string) => {
    setName(text);
    setError(null);
  }, []);

  const save = useCallback(() => {
    if (!target) return;
    const invalid = sandboxRenameError(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    renameSandbox(target.id, name);
    setTarget(null);
  }, [target, name, renameSandbox]);

  const sheet: RenameSheetState = {
    visible: target !== null,
    name,
    setName: change,
    hint: SANDBOX_RENAME_HINT,
    error,
    saving: false,
    save,
    close,
  };

  return { open, sheet };
}
