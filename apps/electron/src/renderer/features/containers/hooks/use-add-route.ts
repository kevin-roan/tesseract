import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { DomainRoute, RouteScheme } from "../../../../shared/contracts/containers";
import { resolveChoice } from "../../../components/ChoiceDropdown";
import { errorMessage, useFormState, useSubmitAction } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, ROUTE_DEFAULTS } from "../constants";
import { DOMAINS_LABELS as L } from "../labels";
import { composeHostname, containerOptions, parsePort, upsertRoute, zoneOptions } from "../model";
import { useContainers } from "./use-containers";
import { useContainersReport } from "./use-containers-report";

type RouteField = "subdomain" | "port";

export function useAddRoute(preselected: string | null, onClose: () => void) {
  const queryClient = useQueryClient();
  const fields = useFormState<RouteField>({ subdomain: "", port: ROUTE_DEFAULTS.port });
  const action = useSubmitAction();
  const { containers } = useContainers();
  const { report } = useContainersReport();
  const [container, setContainer] = useState<string | null>(preselected);
  const [zone, setZone] = useState<string | null>(null);
  const [scheme, setScheme] = useState<RouteScheme>(ROUTE_DEFAULTS.scheme);
  const containerChoices = containerOptions(containers);
  const zoneChoices = zoneOptions(report);
  const selectedContainer = resolveChoice(containerChoices, container);
  const selectedZone = resolveChoice(zoneChoices, zone);
  const hostname = selectedZone ? composeHostname(fields.values.subdomain, selectedZone) : "";
  const { reset: resetFields, fail, values } = fields;
  const { reset: resetAction, run } = action;

  const reset = useCallback(() => {
    resetFields();
    resetAction();
    setContainer(preselected);
    setZone(null);
    setScheme(ROUTE_DEFAULTS.scheme);
  }, [preselected, resetAction, resetFields]);

  const blocker = containerChoices.length === 0 ? L.add.noContainer : zoneChoices.length === 0 ? L.add.noZones : null;

  const submit = useCallback(async () => {
    if (blocker || action.busy || !selectedContainer || !hostname) return;
    const port = parsePort(values.port);
    if (port === null) {
      fail({ port: L.add.invalidPort });
      return;
    }
    await run(async () => {
      const route = await ipc.containers.addRoute({ container: selectedContainer, hostname, port, scheme });
      queryClient.setQueryData<DomainRoute[]>(CONTAINERS_KEYS.routes, (routes) => upsertRoute(routes, route));
      showToast(L.add.added(route.hostname));
      onClose();
    }, (error) => L.add.failed(errorMessage(error)));
  }, [action.busy, blocker, fail, hostname, onClose, queryClient, run, scheme, selectedContainer, values.port]);

  return {
    fields,
    containerChoices,
    container: selectedContainer,
    setContainer,
    containerLocked: preselected !== null,
    zoneChoices,
    zone: selectedZone,
    setZone,
    scheme,
    setScheme,
    hostname,
    blocker,
    busy: action.busy,
    error: action.error,
    submit,
    reset,
  };
}
