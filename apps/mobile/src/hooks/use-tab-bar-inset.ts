import { createContext, useContext } from 'react';

export const TabBarInsetContext = createContext(0);

/** Space the floating tab bar covers above the bottom safe area; 0 outside the tabs. */
export function useTabBarInset(): number {
  return useContext(TabBarInsetContext);
}
