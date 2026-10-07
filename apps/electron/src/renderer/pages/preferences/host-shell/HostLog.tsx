import { useLayoutEffect, useRef } from "react";
import { LOG_MAX_HEIGHT_PX } from "./constants";
import styles from "./HostShellPreferences.module.css";

export function HostLog({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [text]);
  return (
    <div ref={ref} className={styles.log} style={{ maxHeight: LOG_MAX_HEIGHT_PX }}>
      {text}
    </div>
  );
}
