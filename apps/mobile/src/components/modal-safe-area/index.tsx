import type { ReactNode } from "react";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";

import { NativeTabBarContext, useNativeTabBar } from "@/hooks/use-tab-bar-inset";

export type ModalSafeAreaProps = {
  children: ReactNode;
};

/**
 * Wrap a Modal's content so its safe-area insets are the modal window's own. A Modal opened from a screen under the
 * system tab bar otherwise inherits that screen's insets, which include the bar the modal is drawn over.
 */
const ModalSafeArea = ({ children }: ModalSafeAreaProps) => {
  const nativeTabBar = useNativeTabBar();
  if (!nativeTabBar) return children;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <NativeTabBarContext.Provider value={false}>{children}</NativeTabBarContext.Provider>
    </SafeAreaProvider>
  );
};

export default ModalSafeArea;
