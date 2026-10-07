import { createContext, useContext } from "react";

export const FooterTargetContext = createContext<HTMLElement | null>(null);

export function useFooterTarget(): HTMLElement | null {
  return useContext(FooterTargetContext);
}
