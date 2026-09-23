import {
  getGreeting,
  getTimeOfDayGreeting,
} from "@/components/greeting/utils/getGreeting";

const at = (hours: number, minutes = 0) =>
  new Date(2026, 0, 15, hours, minutes, 0, 0);

describe("getTimeOfDayGreeting", () => {
  describe("time buckets", () => {
    it.each<[number, string]>([
      [5, "Good morning"],
      [8, "Good morning"],
      [11, "Good morning"],
      [12, "Good afternoon"],
      [14, "Good afternoon"],
      [16, "Good afternoon"],
      [17, "Good evening"],
      [19, "Good evening"],
      [21, "Good evening"],
      [22, "Late night"],
      [23, "Late night"],
      [0, "Late night"],
      [3, "Late night"],
      [4, "Late night"],
    ])("returns %s for hour %i", (hour, expected) => {
      expect(getTimeOfDayGreeting(at(hour))).toBe(expected);
    });
  });

  describe("bucket boundaries", () => {
    it("switches to morning at 05:00 and not at 04:59", () => {
      expect(getTimeOfDayGreeting(at(4, 59))).toBe("Late night");
      expect(getTimeOfDayGreeting(at(5, 0))).toBe("Good morning");
    });

    it("switches to afternoon at 12:00 and not at 11:59", () => {
      expect(getTimeOfDayGreeting(at(11, 59))).toBe("Good morning");
      expect(getTimeOfDayGreeting(at(12, 0))).toBe("Good afternoon");
    });

    it("switches to evening at 17:00 and not at 16:59", () => {
      expect(getTimeOfDayGreeting(at(16, 59))).toBe("Good afternoon");
      expect(getTimeOfDayGreeting(at(17, 0))).toBe("Good evening");
    });

    it("switches to late night at 22:00 and not at 21:59", () => {
      expect(getTimeOfDayGreeting(at(21, 59))).toBe("Good evening");
      expect(getTimeOfDayGreeting(at(22, 0))).toBe("Late night");
    });

    it("covers midnight rollover", () => {
      expect(getTimeOfDayGreeting(at(23, 59))).toBe("Late night");
      expect(getTimeOfDayGreeting(new Date(2026, 0, 16, 0, 0))).toBe(
        "Late night"
      );
    });
  });

  describe("string date input", () => {
    it.each<[string, string]>([
      ["2026-01-15T09:30:00", "Good morning"],
      ["2026-01-15T13:00:00", "Good afternoon"],
      ["2026-01-15T18:45:00", "Good evening"],
      ["2026-01-15T02:15:00", "Late night"],
    ])("parses %s as %s", (input, expected) => {
      expect(getTimeOfDayGreeting(input)).toBe(expected);
    });

    it("matches the equivalent Date instance", () => {
      const iso = "2026-01-15T17:00:00";
      expect(getTimeOfDayGreeting(iso)).toBe(
        getTimeOfDayGreeting(new Date(iso))
      );
    });
  });
});

describe("getGreeting", () => {
  it("returns both salutation and timeOfDay", () => {
    expect(getGreeting("Kevin Roan", at(9))).toEqual({
      salutation: "Hi, Kevin Roan",
      timeOfDay: "Good morning",
    });
  });

  it("formats the salutation with the username", () => {
    expect(getGreeting("Ada", at(9)).salutation).toBe("Hi, Ada");
    expect(getGreeting("Ada Lovelace", at(9)).salutation).toBe(
      "Hi, Ada Lovelace"
    );
  });

  it("keeps the salutation stable across time buckets", () => {
    const hours = [2, 9, 14, 19];
    const salutations = hours.map((h) => getGreeting("Ada", at(h)).salutation);
    expect(new Set(salutations).size).toBe(1);
  });

  it("handles an empty username without throwing", () => {
    expect(getGreeting("", at(9)).salutation).toBe("Hi, ");
  });

  it("accepts a string date input", () => {
    expect(getGreeting("Ada", "2026-01-15T13:00:00")).toEqual({
      salutation: "Hi, Ada",
      timeOfDay: "Good afternoon",
    });
  });
});
