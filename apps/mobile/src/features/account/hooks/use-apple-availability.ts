import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

export function useAppleAvailability(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((result) => {
        if (active) setAvailable(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return available;
}
