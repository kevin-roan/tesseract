import { useState } from 'react';
import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

/** True when the system Liquid Glass tab bar can replace the floating one (iOS 26+). Decided once per mount. */
export function useNativeTabs(): boolean {
  const [native] = useState(() => Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable());
  return native;
}
