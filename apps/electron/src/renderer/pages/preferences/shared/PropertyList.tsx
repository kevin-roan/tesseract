import { PropertyRow } from "../../../components/PreferenceRows";

export interface PropertyListItem {
  key: string;
  value: string;
}

export function PropertyList({ items, nested = false }: { items: readonly PropertyListItem[]; nested?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <PropertyRow key={item.key} title={item.key} value={item.value} selectable nested={nested} />
      ))}
    </>
  );
}
