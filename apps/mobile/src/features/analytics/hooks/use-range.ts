import { useCallback, useState } from "react";

import type { RangeDays } from "../types";
import { RANGE_OPTIONS, parseRange } from "../utils/range";

export function useRange(initial?: string | string[]) {
  const [days, setDays] = useState<RangeDays>(() => parseRange(initial));
  const select = useCallback((id: string) => setDays(parseRange(id)), []);
  return { days, select, options: RANGE_OPTIONS };
}
