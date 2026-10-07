import { toolchain } from "@/content/site";

import styles from "./toolchain.module.css";

export default function Toolchain() {
  const items = [...toolchain, ...toolchain];
  return (
    <section className={styles.root} aria-label="Works with your toolchain">
      <p className={styles.caption}>
        Works with the stack you already ship. <span>Android, Electron, web and more.</span>
      </p>
      <div className={styles.marquee}>
        <div className={styles.track}>
          {items.map((name, i) => (
            <span key={i} aria-hidden={i >= toolchain.length}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
