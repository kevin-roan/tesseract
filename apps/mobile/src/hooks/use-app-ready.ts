import { useFonts } from "expo-font";
// Per-weight entry points on purpose: the package barrels pull in all eighteen
// faces of each family, and we ship a handful.
import { Exo2_400Regular } from "@expo-google-fonts/exo-2/400Regular";
import { Exo2_500Medium } from "@expo-google-fonts/exo-2/500Medium";
import { Exo2_600SemiBold } from "@expo-google-fonts/exo-2/600SemiBold";
import { Exo2_700Bold } from "@expo-google-fonts/exo-2/700Bold";
import { Exo2_800ExtraBold } from "@expo-google-fonts/exo-2/800ExtraBold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { GeistMono_600SemiBold } from "@expo-google-fonts/geist-mono/600SemiBold";
import { GeistMono_700Bold } from "@expo-google-fonts/geist-mono/700Bold";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans/400Regular";
import { NotoSans_400Regular_Italic } from "@expo-google-fonts/noto-sans/400Regular_Italic";
import { NotoSans_500Medium } from "@expo-google-fonts/noto-sans/500Medium";
import { NotoSans_600SemiBold } from "@expo-google-fonts/noto-sans/600SemiBold";
import { NotoSans_600SemiBold_Italic } from "@expo-google-fonts/noto-sans/600SemiBold_Italic";
import { NotoSans_700Bold } from "@expo-google-fonts/noto-sans/700Bold";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";

import { usePairingState } from "@/features/sandbox/hooks/use-pairing-state";

export function useAppReady() {
  const [fontsLoaded, fontError] = useFonts({
    Exo2_400Regular,
    Exo2_500Medium,
    Exo2_600SemiBold,
    Exo2_700Bold,
    Exo2_800ExtraBold,
    NotoSans_400Regular,
    NotoSans_400Regular_Italic,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_600SemiBold_Italic,
    NotoSans_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { hydrated, paired } = usePairingState();
  // A font failure is not worth a permanent splash — show the UI regardless.
  const ready = Boolean(fontsLoaded || fontError) && hydrated;

  return { ready, paired };
}
