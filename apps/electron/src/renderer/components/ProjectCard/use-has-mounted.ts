import { useEffect, useRef } from "react";

export function useHasMounted(): boolean {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return mounted.current;
}
