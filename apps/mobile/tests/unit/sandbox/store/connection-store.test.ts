import { useConnectionStore } from "@/features/sandbox/store/connection-store";

beforeEach(() => useConnectionStore.setState({ links: {}, issues: {} }));

describe("connection store", () => {
  it("sets and clears issues per sandbox without touching others", () => {
    const { setIssue } = useConnectionStore.getState();
    setIssue("sbx_a", "unauthorized");
    setIssue("sbx_b", "incompatible");
    expect(useConnectionStore.getState().issues).toEqual({ sbx_a: "unauthorized", sbx_b: "incompatible" });

    setIssue("sbx_a", null);
    expect(useConnectionStore.getState().issues).toEqual({ sbx_b: "incompatible" });
  });

  it("keeps the same state object when nothing changes", () => {
    const before = useConnectionStore.getState();
    before.setIssue("sbx_a", null);
    expect(useConnectionStore.getState()).toBe(before);
  });

  it("forgets the link and the issue of a removed sandbox", () => {
    const { setLink, setIssue, clearLink } = useConnectionStore.getState();
    setLink("sbx_a", "closed");
    setIssue("sbx_a", "unauthorized");
    setLink("sbx_b", "open");
    clearLink("sbx_a");
    expect(useConnectionStore.getState().links).toEqual({ sbx_b: "open" });
    expect(useConnectionStore.getState().issues).toEqual({});
  });
});
