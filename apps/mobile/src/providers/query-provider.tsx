import { useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { isRetryableError } from "@/features/sandbox/utils/errors";
import { bindQueryManagers, createQueryClient } from "@/lib/query-client";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient(isRetryableError));

  useEffect(() => {
    bindQueryManagers();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
