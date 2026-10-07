import { createContext, useContext } from "react";

export interface RowListContextValue {
  divided: boolean;
}

export const RowListContext = createContext<RowListContextValue>({ divided: false });

export const useRowList = (): RowListContextValue => useContext(RowListContext);
