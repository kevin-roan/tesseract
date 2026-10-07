import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { ABOUT_KEYS } from "../constants";
import { ABOUT_LABELS } from "../labels";

export function useCliInstall() {
  const client = useQueryClient();
  const toast = usePreferencesToast();
  const query = useQuery({ queryKey: ABOUT_KEYS.cli, queryFn: () => ipc.app.cliStatus(), staleTime: Number.POSITIVE_INFINITY, retry: false });
  const mutation = useMutation({
    mutationFn: () => ipc.app.installCli(),
    onSuccess: (status) => {
      client.setQueryData(ABOUT_KEYS.cli, status);
      if (status.state === "installed") toast(ABOUT_LABELS.cli.installedToast);
      else if (status.message) toast(status.message, true);
    },
    onError: (error) => toast(ABOUT_LABELS.cli.failed(errorMessage(error)), true),
  });
  return { status: query.data ?? null, install: () => mutation.mutate(), installing: mutation.isPending };
}
