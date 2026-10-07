import { useLocation } from "react-router";
import { findPage } from "../registry/pages";

export function usePaletteContext() {
  const { pathname } = useLocation();
  const pageId = pathname.split("/").filter(Boolean)[0] ?? "";
  const page = findPage(pageId);
  return page ? { title: page.title, icon: page.icon } : null;
}
