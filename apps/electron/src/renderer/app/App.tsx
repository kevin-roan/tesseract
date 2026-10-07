import { useMemo } from "react";
import { createHashRouter, RouterProvider } from "react-router";
import { installIdleProbe } from "./idle";
import { Providers } from "./providers";
import { createQueryClient } from "./query-client";
import { ROUTES } from "./routes";

export function App() {
  const queryClient = useMemo(() => {
    const client = createQueryClient();
    installIdleProbe(client);
    return client;
  }, []);
  const router = useMemo(() => createHashRouter(ROUTES), []);
  return (
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  );
}
