import type { ReactNode } from "react";
import { ShimmerProvider } from "react-native-fast-shimmer";

import SandboxEventsBridge from "@/features/sandbox/components/sandbox-events-bridge";

import QueryProvider from "./query-provider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SandboxEventsBridge />
      <ShimmerProvider duration={1400}>{children}</ShimmerProvider>
    </QueryProvider>
  );
}
