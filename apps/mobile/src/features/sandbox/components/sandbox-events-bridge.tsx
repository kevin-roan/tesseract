import { useEffect } from "react";

import { useResourceRecorder } from "../hooks/use-resource-recorder";
import { useSandboxEvents } from "../hooks/use-sandbox-events";
import { useSandboxStore } from "../store/sandbox-store";

export default function SandboxEventsBridge() {
  const hydrate = useSandboxStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useSandboxEvents();
  useResourceRecorder();
  return null;
}
