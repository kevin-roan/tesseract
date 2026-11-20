import { useContext, useMemo } from "react";
import { SafeAreaInsetsContext, type Edge } from "react-native-safe-area-context";

import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useNativeTabBar, useTabBarInset } from "@/hooks/use-tab-bar-inset";

const ALL_EDGES: readonly Edge[] = ["top", "right", "bottom", "left"];

type ScaffoldInsetOptions = {
  edges?: readonly Edge[];
  scroll: boolean;
  hasFooter: boolean;
  avoidKeyboard: boolean;
};

export type ScaffoldInsets = {
  /** Edges the SafeAreaView pads. */
  edges?: readonly Edge[];
  /** Space reserved under the body for a tab bar; 0 while the keyboard is up, as the bar sits under it. */
  bottomInset: number;
  /** Padding that lifts the screen to the keyboard's top, on top of the SafeAreaView's own bottom padding. */
  keyboardInset: number;
};

/**
 * Under the system tab bar, scrolling content runs beneath the translucent bar: the bottom edge is dropped and the
 * safe-area bottom, which includes the bar, is reserved inside the scroll instead. Fixed layouts keep the padded edge.
 */
export function useScaffoldInsets({ edges, scroll, hasFooter, avoidKeyboard }: ScaffoldInsetOptions): ScaffoldInsets {
  const insets = useContext(SafeAreaInsetsContext);
  const keyboardHeight = useKeyboardHeight(avoidKeyboard);
  const tabBarInset = useTabBarInset();
  const underNativeBar = useNativeTabBar() && scroll && !hasFooter;
  const insetBottom = insets?.bottom ?? 0;

  const safeEdges = useMemo(
    () => (underNativeBar ? (edges ?? ALL_EDGES).filter((edge) => edge !== "bottom") : edges),
    [underNativeBar, edges],
  );

  const barInset = underNativeBar ? insetBottom : tabBarInset;
  const safeBottom = !safeEdges || safeEdges.includes("bottom") ? insetBottom : 0;

  return {
    edges: safeEdges,
    bottomInset: keyboardHeight > 0 ? 0 : barInset,
    keyboardInset: Math.max(keyboardHeight - safeBottom, 0),
  };
}
