import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SavedMachine } from "../../../../shared/contracts/connection";
import { MACHINE_SCOPED_QUERY_KEYS } from "../constants";
import { useMachineScopeRefresh } from "./use-machine-scope-refresh";

const machines = vi.hoisted(() => ({ list: [] as SavedMachine[] }));
vi.mock("../../../app/connection", () => ({ useSavedMachines: () => machines.list }));

const machine = (id: string, active: boolean): SavedMachine => ({ id, apiUrl: id, name: null, active, local: false, status: "unknown", host: null });

describe("useMachineScopeRefresh", () => {
  it("invalidates host-scoped queries only when the active machine changes", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    machines.list = [machine("a", true), machine("b", false)];
    const { rerender } = renderHook(() => useMachineScopeRefresh(), { wrapper });
    expect(invalidate).not.toHaveBeenCalled();
    machines.list = [machine("a", true), machine("b", false)];
    rerender();
    expect(invalidate).not.toHaveBeenCalled();
    machines.list = [machine("a", false), machine("b", true)];
    rerender();
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([...MACHINE_SCOPED_QUERY_KEYS]);
  });
});
