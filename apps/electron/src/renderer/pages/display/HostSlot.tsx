import { useLayoutEffect, useRef } from "react";
import styles from "./DisplayStage.module.css";

export interface HostSlotProps {
  host: HTMLElement;
}

export function HostSlot({ host }: HostSlotProps) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = slot.current;
    if (!element) return;
    element.appendChild(host);
    return () => {
      if (host.parentElement === element) element.removeChild(host);
    };
  }, [host]);
  return <div ref={slot} className={styles.slot} />;
}
