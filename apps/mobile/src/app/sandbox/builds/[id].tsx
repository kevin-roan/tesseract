import { useLocalSearchParams } from "expo-router";

import BuildDetailView from "@/features/sandbox/components/build-detail-view";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function BuildScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <BuildDetailView buildId={firstParam(params.id) ?? ""} />;
}
