import { renderHook } from "@testing-library/react-native";

import useGetGreeting from "@/components/greeting/hooks/useGetGreeting";
import type { Greeting } from "@/components/greeting/utils/getGreeting";

type GreetingProps = { username: string; dateInput: Date };

describe("useGetGreeting", () => {
  it("returns the greeting for the given username and date", async () => {
    const { result } = await renderHook(() =>
      useGetGreeting("Kevin Roan", new Date(2026, 0, 15, 9, 0))
    );

    expect(result.current).toEqual({
      salutation: "Hi, Kevin Roan",
      timeOfDay: "Good morning",
    });
  });

  it("memoizes while username and date are unchanged", async () => {
    const date = new Date(2026, 0, 15, 9, 0);
    const { result, rerender } = await renderHook<Greeting, GreetingProps>(
      ({ username, dateInput }) => useGetGreeting(username, dateInput),
      { initialProps: { username: "Ada", dateInput: date } }
    );

    const first = result.current;
    await rerender({ username: "Ada", dateInput: date });

    expect(result.current).toBe(first);
  });

  it("recomputes when the date changes bucket", async () => {
    const { result, rerender } = await renderHook<Greeting, GreetingProps>(
      ({ username, dateInput }) => useGetGreeting(username, dateInput),
      {
        initialProps: {
          username: "Ada",
          dateInput: new Date(2026, 0, 15, 9, 0),
        },
      }
    );

    expect(result.current.timeOfDay).toBe("Good morning");

    await rerender({ username: "Ada", dateInput: new Date(2026, 0, 15, 19, 0) });

    expect(result.current.timeOfDay).toBe("Good evening");
  });

  it("recomputes when the username changes", async () => {
    const date = new Date(2026, 0, 15, 9, 0);
    const { result, rerender } = await renderHook<Greeting, GreetingProps>(
      ({ username, dateInput }) => useGetGreeting(username, dateInput),
      { initialProps: { username: "Ada", dateInput: date } }
    );

    await rerender({ username: "Grace", dateInput: date });

    expect(result.current.salutation).toBe("Hi, Grace");
  });
});
