import { QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { createQueryClient } from "../app/query-client";

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
}

export function renderRoutes(routes: RouteObject[], path: string): RenderResult {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}
