import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { useStrayDropGuard } from "./drop-guard";
import { runtime } from "./runtime";
import { useApplyScheme } from "./scheme";

function SchemeSync({ children }: { children: ReactNode }) {
  useApplyScheme();
  useStrayDropGuard();
  return children;
}

export interface ProvidersProps {
  queryClient: QueryClient;
  children: ReactNode;
}

export function Providers({ queryClient, children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={runtime.reducedMotion ? "always" : "user"}>
        <SchemeSync>{children}</SchemeSync>
      </MotionConfig>
    </QueryClientProvider>
  );
}
