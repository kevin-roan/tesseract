import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/** Largest square that fits the measured view. */
export function useFitSize() {
  const [size, setSize] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(Math.floor(Math.min(width, height)));
  }, []);

  return { size, onLayout };
}
