import { useEffect } from "react";

import { useSandboxEvents } from "../hooks/use-sandbox-events";
import { useSandboxStore } from "../store/sandbox-store";

export default function SandboxEventsBridge() {
  const hydrate = useSandboxStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useSandboxEvents();
  return null;
}
