import { useLocation } from "react-router";

export function pageKeyOf(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export function usePageKey(): string {
  return pageKeyOf(useLocation().pathname);
}
