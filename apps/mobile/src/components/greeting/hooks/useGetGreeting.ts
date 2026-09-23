import { useMemo } from "react";

import { getGreeting, type Greeting } from "../utils/getGreeting";

const useGetGreeting = (username: string, dateInput: Date): Greeting => {
  return useMemo(() => getGreeting(username, dateInput), [username, dateInput]);
};

export default useGetGreeting;
