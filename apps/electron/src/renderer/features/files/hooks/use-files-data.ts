import type { Artifact, BuildOutput } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { describeError, usePoller, useServerEvent, useWindowVisible } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { REFRESH_INTERVAL_MS } from "../constants";
import { newestArtifacts, removeArtifact, upsertArtifact } from "../model";
import { filesStore, scopedData, useFilesStore } from "../store";

export interface FilesData {
  artifacts: Artifact[] | null;
  outputs: BuildOutput[] | null;
  artifactsError: string | null;
  outputsError: string | null;
  refresh(includeOutputs: boolean): void;
  removeArtifact(id: string): void;
}

function currentData(scope: string | null) {
  return scopedData(useFilesStore.getState(), scope);
}

export function useFilesData(report: (message: string) => void): FilesData {
  const client = useApiClient();
  const scope = client?.baseUrl ?? null;
  const visible = useWindowVisible();
  const enabled = client !== null && visible;
  const { artifacts, outputs, artifactsError, outputsError } = useFilesStore(
    useShallow((state) => {
      const data = scopedData(state, scope);
      return { artifacts: data.artifacts, outputs: data.outputs, artifactsError: data.artifactsError, outputsError: data.outputsError };
    }),
  );

  const artifactsPoller = usePoller(
    (signal) => (client ? client.listArtifacts(undefined, { signal }) : Promise.resolve(null)),
    REFRESH_INTERVAL_MS,
    {
      enabled,
      onResult: (value) => {
        if (value && scope) filesStore.setArtifacts(scope, newestArtifacts(value));
      },
      onError: (error) => {
        if (!scope) return;
        if (currentData(scope).artifacts) report(describeError(error));
        else filesStore.setArtifactsError(scope, describeError(error));
      },
    },
  );

  const outputsPoller = usePoller(
    (signal) => (client ? client.listBuildOutputs(undefined, { signal }) : Promise.resolve(null)),
    REFRESH_INTERVAL_MS,
    {
      enabled,
      onResult: (value) => {
        if (value && scope) filesStore.setOutputs(scope, value);
      },
      onError: (error) => {
        if (!scope) return;
        if (currentData(scope).outputs) report(describeError(error));
        else filesStore.setOutputsError(scope, describeError(error));
      },
    },
  );

  useServerEvent("artifact.created", (event) => {
    if (scope) filesStore.updateArtifacts(scope, (current) => upsertArtifact(current, event.artifact));
  });
  useServerEvent("artifact.deleted", (event) => {
    if (scope) filesStore.updateArtifacts(scope, (current) => removeArtifact(current, event.id));
  });

  const refresh = useCallback(
    (includeOutputs: boolean) => {
      if (scope && !currentData(scope).artifacts) filesStore.setArtifactsError(scope, null);
      artifactsPoller.refresh();
      if (includeOutputs) outputsPoller.refresh();
    },
    [scope, artifactsPoller, outputsPoller],
  );

  const remove = useCallback(
    (id: string) => {
      if (scope) filesStore.updateArtifacts(scope, (current) => removeArtifact(current, id));
    },
    [scope],
  );

  return useMemo(
    () => ({ artifacts, outputs, artifactsError, outputsError, refresh, removeArtifact: remove }),
    [artifacts, outputs, artifactsError, outputsError, refresh, remove],
  );
}
