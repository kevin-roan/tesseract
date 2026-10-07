import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { PALETTE_SNAPSHOT_PARAM } from "./constants";
import { openCommandPalette } from "./store";

export function usePaletteRouteParam(): void {
  const [search] = useSearchParams();
  const requested = search.get(PALETTE_SNAPSHOT_PARAM);
  useEffect(() => {
    if (requested !== null) openCommandPalette(requested);
  }, [requested]);
}
