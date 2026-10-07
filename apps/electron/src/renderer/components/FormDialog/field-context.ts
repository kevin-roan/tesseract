import { createContext, useContext } from "react";

export const FieldIdContext = createContext<string | undefined>(undefined);

export const useFieldId = (): string | undefined => useContext(FieldIdContext);
