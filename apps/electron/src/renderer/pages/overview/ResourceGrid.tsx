import { StatGrid, type StatItem } from "../../components/StatCard";
import { useResourceColumns } from "../../features/overview/hooks/use-resource-columns";

export interface ResourceGridProps {
  items: readonly StatItem[];
}

export function ResourceGrid({ items }: ResourceGridProps) {
  const { ref, columns } = useResourceColumns();
  return (
    <div ref={ref}>
      <StatGrid items={items} minColumns={columns} maxColumns={columns} />
    </div>
  );
}
