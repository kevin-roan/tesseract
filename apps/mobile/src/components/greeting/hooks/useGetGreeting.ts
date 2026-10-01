import { useMemo, useState } from "react";

import { getGreeting, type Greeting } from "../utils/getGreeting";

const useGetGreeting = (username: string, dateInput?: Date): Greeting => {
  const [now] = useState(() => new Date());
  const date = dateInput ?? now;
  return useMemo(() => getGreeting(username, date), [username, date]);
};

export default useGetGreeting;
