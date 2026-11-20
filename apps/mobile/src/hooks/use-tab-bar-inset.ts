import { createContext, useContext } from 'react';

export const TabBarInsetContext = createContext(0);

export const NativeTabBarContext = createContext(false);

/** Space the floating tab bar covers above the bottom safe area; 0 outside the tabs. */
export function useTabBarInset(): number {
  return useContext(TabBarInsetContext);
}

/** True under the system tab bar, whose height arrives through the safe area instead of `useTabBarInset`. */
export function useNativeTabBar(): boolean {
  return useContext(NativeTabBarContext);
}
