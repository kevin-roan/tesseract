import { Kbd } from "../../components/Kbd";
import { PALETTE_FOOTER_HINTS } from "./hints";
import styles from "./CommandPalette.module.css";

export function PaletteFooter() {
  return (
    <footer className={styles.footer} aria-hidden>
      {PALETTE_FOOTER_HINTS.map((hint) => (
        <span key={hint.label} className={styles.hint}>
          {hint.keys.map((key) => (
            <Kbd key={key} keys={[key]} size="sm" />
          ))}
          <span>{hint.label}</span>
        </span>
      ))}
    </footer>
  );
}
