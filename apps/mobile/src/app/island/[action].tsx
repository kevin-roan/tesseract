import { useLocalSearchParams } from "expo-router";

import { useIslandRoute } from "@/features/island/hooks/use-island-route";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function IslandActionScreen() {
  const params = useLocalSearchParams<{ action: string }>();
  useIslandRoute(firstParam(params.action));
  return null;
}
