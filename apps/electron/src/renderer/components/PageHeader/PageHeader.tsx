import type { ReactNode } from "react";
import { IconButton } from "../IconButton";
import { Presence } from "../Presence";
import { Titlebar } from "../Titlebar";
import { HeaderTitle } from "./HeaderTitle";
import { PAGE_HEADER_LABELS } from "./labels";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  title: string;
  parent?: string | null;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  onParentClick?: () => void;
  controls?: boolean | ReactNode;
  backdrop?: boolean;
  trafficLightInset?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  parent = null,
  actions,
  onBack,
  backLabel = PAGE_HEADER_LABELS.back,
  onParentClick,
  controls = true,
  backdrop = false,
  trafficLightInset = false,
  className,
}: PageHeaderProps) {
  return (
    <Titlebar
      divider
      variant="page"
      controls={controls}
      backdrop={backdrop}
      trafficLightInset={trafficLightInset}
      className={className}
      start={
        <div className={styles.start}>
          <Presence show={Boolean(onBack)} as="span" className={styles.back}>
            <IconButton icon="chevron-left" label={backLabel} onClick={onBack} />
          </Presence>
          <HeaderTitle title={title} parent={parent} onParentClick={onParentClick} />
        </div>
      }
      end={actions}
    />
  );
}
