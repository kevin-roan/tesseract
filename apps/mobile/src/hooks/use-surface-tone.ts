import { createContext, useContext } from 'react';

import type { SurfaceTone } from '@/theme/colors';

export const SurfaceToneContext = createContext<SurfaceTone | undefined>(undefined);

/** Tone of the nearest enclosing `<Surface>`, if any. */
export function useSurfaceTone(): SurfaceTone | undefined {
  return useContext(SurfaceToneContext);
}
