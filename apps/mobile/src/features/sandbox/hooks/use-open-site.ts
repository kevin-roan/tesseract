import { Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { describeError } from "../utils/errors";

export function useOpenSite() {
  const mutation = useMutation({ mutationFn: (url: string) => Linking.openURL(url) });

  return {
    open: (url: string) => mutation.mutate(url),
    error: mutation.error ? describeError(mutation.error) : null,
  };
}
