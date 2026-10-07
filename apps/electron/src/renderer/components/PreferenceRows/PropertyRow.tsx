import type { ReactNode } from "react";
import { PreferenceRow } from "./PreferenceRow";

export interface PropertyRowProps {
  title: string;
  value: ReactNode;
  selectable?: boolean;
  suffix?: ReactNode;
  nested?: boolean;
}

export function PropertyRow({ title, value, selectable = false, suffix, nested }: PropertyRowProps) {
  return <PreferenceRow property title={title} subtitle={value} selectable={selectable} suffix={suffix} nested={nested} />;
}
