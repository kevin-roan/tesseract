import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// Per-weight entry points on purpose: the package barrels pull in all eighteen
// faces of each family, and we ship a handful.
import { Exo2_400Regular } from "@expo-google-fonts/exo-2/400Regular";
import { Exo2_500Medium } from "@expo-google-fonts/exo-2/500Medium";
import { Exo2_600SemiBold } from "@expo-google-fonts/exo-2/600SemiBold";
import { Exo2_700Bold } from "@expo-google-fonts/exo-2/700Bold";
import { Exo2_800ExtraBold } from "@expo-google-fonts/exo-2/800ExtraBold";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans/400Regular";
import { NotoSans_500Medium } from "@expo-google-fonts/noto-sans/500Medium";
import { NotoSans_600SemiBold } from "@expo-google-fonts/noto-sans/600SemiBold";
import { NotoSans_700Bold } from "@expo-google-fonts/noto-sans/700Bold";

import { usePairingState } from "@/features/sandbox/hooks/use-pairing-state";

export function useAppReady() {
  const [fontsLoaded, fontError] = useFonts({
    Exo2_400Regular,
    Exo2_500Medium,
    Exo2_600SemiBold,
    Exo2_700Bold,
    Exo2_800ExtraBold,
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });
  const { hydrated, paired } = usePairingState();
  // A font failure is not worth a permanent splash — show the UI regardless.
  const ready = Boolean(fontsLoaded || fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return { ready, paired };
}
