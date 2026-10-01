import { render, screen } from "@testing-library/react-native";

import Greeting from "@/components/greeting";

describe("<Greeting />", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const renderAt = async (date: Date, name?: string | null) => {
    jest.useFakeTimers();
    jest.setSystemTime(date);
    await render(<Greeting name={name} />);
  };

  it.each<[Date, string]>([
    [new Date(2026, 0, 15, 9, 0), "Good morning, Kevin Roan"],
    [new Date(2026, 0, 15, 14, 0), "Good afternoon, Kevin Roan"],
    [new Date(2026, 0, 15, 19, 0), "Good evening, Kevin Roan"],
    [new Date(2026, 0, 15, 2, 0), "Working late, Kevin Roan"],
  ])("greets at %s with %s", async (date, expected) => {
    await renderAt(date);
    expect(screen.getByRole("header", { name: expected })).toBeOnTheScreen();
  });

  it("greets a given name and falls back when it is missing", async () => {
    await renderAt(new Date(2026, 0, 15, 19, 0), "Ada");
    expect(screen.getByText("Good evening, Ada")).toBeOnTheScreen();
    await render(<Greeting name={null} />);
    expect(screen.getByText("Good evening, Kevin Roan")).toBeOnTheScreen();
  });

  it("uses an explicit date", async () => {
    await render(<Greeting name="Ada" date={new Date(2026, 0, 15, 9, 0)} />);
    expect(screen.getByText("Good morning, Ada")).toBeOnTheScreen();
  });
});
