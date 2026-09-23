import type { ReactNode } from "react";

import SandboxEventsBridge from "@/features/sandbox/components/sandbox-events-bridge";

import QueryProvider from "./query-provider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SandboxEventsBridge />
      {children}
    </QueryProvider>
  );
}
