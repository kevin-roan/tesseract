import Image from "next/image";
import type { CSSProperties } from "react";

import type { Shot } from "@/content/site";

import styles from "./device.module.css";

type DeviceProps = { shot: Shot; width: number | string; priority?: boolean; className?: string; style?: CSSProperties };

export default function Device({ shot, width, priority, className, style }: DeviceProps) {
  return (
    <div className={`${styles.wrap} ${className ?? ""}`} style={{ width, ...style }}>
      <div className={styles.frame}>
        <span className={`${styles.button} ${styles.action}`} />
        <span className={`${styles.button} ${styles.volUp}`} />
        <span className={`${styles.button} ${styles.volDown}`} />
        <span className={`${styles.button} ${styles.power}`} />
        <div className={styles.screen}>
          <Image src={shot.src} alt={shot.alt} fill priority={priority} sizes="(max-width: 800px) 60vw, 420px" className={styles.image} />
          <div className={`${styles.status} ${styles[shot.tone]}`} aria-hidden>
            <span className={styles.time}>9:41</span>
            <span className={styles.island} />
            <span className={styles.icons}>
              <svg viewBox="0 0 18 12">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                <rect x="10" y="3" width="3" height="9" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" />
              </svg>
              <svg viewBox="0 0 17 12">
                <path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8.5.6 10.2 10.2 0 0 0 1.3 3.5l1.2 1.2a8.5 8.5 0 0 1 6-2.4Zm0 3.3c1.4 0 2.6.5 3.6 1.4l1.2-1.2a6.8 6.8 0 0 0-9.6 0L4.9 7a5.1 5.1 0 0 1 3.6-1.4Zm0 3.3c-.5 0-1 .2-1.3.6l1.3 1.3 1.3-1.3c-.3-.4-.8-.6-1.3-.6Z" />
              </svg>
              <svg viewBox="0 0 27 13">
                <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" strokeOpacity="0.4" />
                <rect x="2" y="2" width="20" height="9" rx="2.5" />
                <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" opacity="0.45" />
              </svg>
            </span>
          </div>
          <span className={styles.glare} />
        </div>
      </div>
    </div>
  );
}
