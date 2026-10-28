import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createQueryClient } from "../../../app/query-client";
import "../../../fixtures/registry";
import { SCENARIOS } from "../../../fixtures/agents/http";
import { useSlashCommands } from "./use-slash-commands";

function setup(projectId?: string | null) {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...renderHook(() => useSlashCommands(projectId), { wrapper }) };
}

describe("useSlashCommands", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("maps the controller's commands to slash hints", async () => {
    const { result } = setup("tesseract");
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));
    expect(result.current).toContainEqual({
      command: "/deploy",
      description: "Deploy an app from this sandbox to a Tesseract server container",
      tag: "skill",
    });
    expect(result.current.map((entry) => entry.command)).toContain("/send-file");
  });

  it("falls back to no hints when the sandbox lacks the endpoint", async () => {
    window.history.replaceState(null, "", `/?scenario=${SCENARIOS.commandsMissing}`);
    const { result, queryClient } = setup("tesseract");
    await waitFor(() => expect(queryClient.getQueryCache().getAll().some((query) => query.state.status === "error")).toBe(true));
    expect(result.current).toEqual([]);
  });
});
