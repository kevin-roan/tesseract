import { createContext, useContext } from 'react';

import type { ColorSchemeName } from '@/theme/colors';

export const SchemeOverrideContext = createContext<ColorSchemeName | undefined>(undefined);

/** Scheme forced by the nearest enclosing `<SchemeScope>`, if any. */
export function useSchemeOverride(): ColorSchemeName | undefined {
  return useContext(SchemeOverrideContext);
}
