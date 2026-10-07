import type { ReactNode } from "react";
import { Crossfade } from "../../components/Presence";
import { useInstantSwaps } from "../../features/display/hooks/use-instant-swaps";
import { cx } from "../../lib/cx";
import styles from "./Swap.module.css";

export interface SwapProps {
  id: string;
  children: ReactNode;
  className?: string;
  layerClassName?: string;
}

export function Swap({ id, children, className, layerClassName }: SwapProps) {
  const instant = useInstantSwaps();
  if (instant) {
    return (
      <div className={cx(styles.stack, className)}>
        <div key={id} className={cx(styles.layer, layerClassName)}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <Crossfade id={id} className={className} layerClassName={layerClassName}>
      {children}
    </Crossfade>
  );
}
