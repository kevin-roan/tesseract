import { useMemo } from "react";
import { creationRequests } from "../model";
import { useContainers } from "./use-containers";
import { useDeploys } from "./use-deploys";

export function useCreationRequests() {
  const { containers } = useContainers();
  const { deploys } = useDeploys();
  return useMemo(() => creationRequests(deploys, containers), [deploys, containers]);
}
