import { render, screen } from "@testing-library/react-native";

import GreetinText from "@/components/greeting";

describe("<GreetinText />", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const renderAt = async (date: Date) => {
    jest.useFakeTimers();
    jest.setSystemTime(date);
    await render(<GreetinText />);
  };

  it("renders the salutation and the time of day", async () => {
    await renderAt(new Date(2026, 0, 15, 9, 0));

    expect(screen.getByText("Hi, Kevin Roan")).toBeOnTheScreen();
    expect(screen.getByText("Good morning")).toBeOnTheScreen();
  });

  it.each<[Date, string]>([
    [new Date(2026, 0, 15, 9, 0), "Good morning"],
    [new Date(2026, 0, 15, 14, 0), "Good afternoon"],
    [new Date(2026, 0, 15, 19, 0), "Good evening"],
    [new Date(2026, 0, 15, 2, 0), "Late night"],
  ])("renders %s as %s", async (date, expected) => {
    await renderAt(date);

    expect(screen.getByText(expected)).toBeOnTheScreen();
  });

  it("renders the salutation above the time of day", async () => {
    await renderAt(new Date(2026, 0, 15, 9, 0));

    const texts = screen.getAllByText(/Hi, Kevin Roan|Good morning/);

    expect(texts.map((node) => node.props.children)).toEqual([
      "Hi, Kevin Roan",
      "Good morning",
    ]);
  });
});
