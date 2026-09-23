export type Greeting = {
  salutation: string;
  timeOfDay: string;
};

const getTimeOfDayGreeting = (dateInput: Date | string): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const hours = date.getHours();

  if (hours >= 5 && hours < 12) return "Good morning";
  if (hours >= 12 && hours < 17) return "Good afternoon";
  if (hours >= 17 && hours < 22) return "Good evening";
  return "Late night";
};

const getGreeting = (username: string, dateInput: Date | string): Greeting => ({
  salutation: `Hi, ${username}`,
  timeOfDay: getTimeOfDayGreeting(dateInput),
});

export { getGreeting, getTimeOfDayGreeting };
