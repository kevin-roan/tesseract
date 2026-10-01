import { useSandboxStore } from "../store/sandbox-store";

export function usePairingState() {
  const hydrated = useSandboxStore((state) => state.hydrated);
  const paired = useSandboxStore((state) => state.sandboxes.length > 0);
  return { hydrated, paired };
}
