import { useEffect, useRef } from "react";
import { PillTabs, type PillTab } from "../../../components/PillTabs";
import { DETAIL_LABELS } from "../../../features/projects/labels";
import type { ProjectTabId } from "../../../features/projects/types";
import styles from "./ProjectDetail.module.css";

export interface DetailTabsProps {
  tabs: readonly PillTab[];
  selected: ProjectTabId;
  onChange(id: ProjectTabId): void;
}

export function DetailTabs({ tabs, selected, onChange }: DetailTabsProps) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected]);
  return (
    <div ref={strip} className={styles.tabsStrip}>
      <PillTabs tabs={tabs} selected={selected} onChange={(id) => onChange(id as ProjectTabId)} label={DETAIL_LABELS.sections} />
    </div>
  );
}
