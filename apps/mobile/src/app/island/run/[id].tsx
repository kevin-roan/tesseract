import { useLocalSearchParams } from "expo-router";

import { useIslandRoute } from "@/features/island/hooks/use-island-route";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function IslandRunScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  useIslandRoute("run", firstParam(params.id));
  return null;
}
