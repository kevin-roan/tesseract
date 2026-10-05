import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/** Width of a view once it has been laid out; 0 until then. */
export function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);
  return { width, onLayout };
}
