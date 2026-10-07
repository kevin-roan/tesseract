import { useCallback, type Ref, type RefObject } from "react";

export function useMergedRef<T>(own: RefObject<T | null>, external: Ref<T> | undefined) {
  return useCallback(
    (node: T | null) => {
      own.current = node;
      if (typeof external === "function") external(node);
      else if (external) external.current = node;
    },
    [own, external],
  );
}
