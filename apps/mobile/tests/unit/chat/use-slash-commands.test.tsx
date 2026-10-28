import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import type { ClaudeCommand } from "@tesseract/protocol";
import { useState } from "react";

import { useSlashCommands } from "@/features/chat/hooks/use-slash-commands";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const commands: ClaudeCommand[] = [
  { name: "deploy", description: "Deploy the app", kind: "skill", source: "project" },
  { name: "debug", description: "Debug", kind: "command", source: "user" },
  { name: "review", description: "Review", kind: "command", source: "builtin" },
];
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

const useHarness = (projectId: string | null) => {
  const [text, setText] = useState("");
  return { text, setText, ...useSlashCommands({ text, setText, projectId }) };
};

const render = (projectId: string | null = "proj_a") =>
  renderHook(() => useHarness(projectId), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  MockClient.mockReset().mockImplementation(() => ({
    httpUrl: (path: string) => `http://sandbox${path}`,
    authHeaders: () => ({ Authorization: "Bearer t" }),
  }));
  fetchMock.mockReset().mockResolvedValue(json(200, commands));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("useSlashCommands", () => {
  it("fetches only once the draft starts with / and filters as the user types", async () => {
    const { result } = await render();
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => result.current.setText("/de"));
    await waitFor(() => expect(result.current.items.map((item) => item.name)).toEqual(["debug", "deploy"]));
    expect(fetchMock.mock.calls[0][0]).toBe("http://sandbox/v1/claude/commands?projectId=proj_a");

    await act(async () => result.current.select("deploy"));
    expect(result.current.text).toBe("/deploy ");
    expect(result.current.items).toEqual([]);
  });

  it("shows nothing when the sandbox has no commands endpoint", async () => {
    fetchMock.mockResolvedValue(json(404, { error: { code: "not_found" } }));
    const { result } = await render(null);
    await act(async () => result.current.setText("/"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("http://sandbox/v1/claude/commands");
    expect(result.current.items).toEqual([]);
  });
});
