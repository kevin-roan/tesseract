export interface LegendItem {
  key: string;
  label: string;
  color: number;
  dash?: readonly number[];
  value?: string | null;
  caption?: string | null;
}
