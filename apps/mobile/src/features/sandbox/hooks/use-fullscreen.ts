import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { BackHandler } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Full-screen state for a remote surface; Android's back button leaves full screen first. While on, the
 * home indicator (iOS) and the navigation bar (Android) hide so only the remote screen shows.
 */
export function useFullscreen() {
  const navigation = useNavigation();
  const [fullscreen, setFullscreen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ autoHideHomeIndicator: fullscreen, navigationBarHidden: fullscreen });
  }, [navigation, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setFullscreen(false);
      return true;
    });
    return () => subscription.remove();
  }, [fullscreen]);

  const enter = useCallback(() => setFullscreen(true), []);
  const exit = useCallback(() => setFullscreen(false), []);

  return { fullscreen, enter, exit };
}
