import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { FOCUS_PARAM, FOCUS_TARGET_SELECTOR } from "../constants";

export function useFocusSection<T extends HTMLElement>(section: string) {
  const ref = useRef<T>(null);
  const [params] = useSearchParams();
  const wanted = params.get(FOCUS_PARAM) === section;

  useEffect(() => {
    const node = ref.current;
    if (!wanted || !node) return;
    node.scrollIntoView({ block: "start", behavior: "smooth" });
    node.querySelector<HTMLElement>(FOCUS_TARGET_SELECTOR)?.focus({ preventScroll: true });
  }, [wanted]);

  return ref;
}
