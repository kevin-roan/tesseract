export type Greeting = {
  salutation: string;
  timeOfDay: string;
};

export type SalutationParts = {
  lead: string;
  name: string;
};

const LATE_NIGHT = "Late night";
const LATE_NIGHT_LEAD = "Working late";

const getTimeOfDayGreeting = (dateInput: Date | string): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const hours = date.getHours();

  if (hours >= 5 && hours < 12) return "Good morning";
  if (hours >= 12 && hours < 17) return "Good afternoon";
  if (hours >= 17 && hours < 22) return "Good evening";
  return LATE_NIGHT;
};

const getSalutationParts = (username: string, dateInput: Date | string): SalutationParts => {
  const timeOfDay = getTimeOfDayGreeting(dateInput);
  return { lead: timeOfDay === LATE_NIGHT ? LATE_NIGHT_LEAD : timeOfDay, name: username.trim() };
};

const getGreeting = (username: string, dateInput: Date | string): Greeting => {
  const { lead, name } = getSalutationParts(username, dateInput);
  return {
    salutation: name ? `${lead}, ${name}` : lead,
    timeOfDay: getTimeOfDayGreeting(dateInput),
  };
};

export { getGreeting, getSalutationParts, getTimeOfDayGreeting };
