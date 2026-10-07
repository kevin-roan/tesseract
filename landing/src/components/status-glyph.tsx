import styles from "./status-glyph.module.css";

export type GlyphState = "done" | "running" | "queued";

export default function StatusGlyph({ state }: { state: GlyphState }) {
  return (
    <span className={`${styles.root} ${styles[state]}`} aria-label={state}>
      {state === "done" ? (
        <svg viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="7" />
          <path d="M4.2 7.2l1.9 1.9 3.8-4" fill="none" stroke="#08090a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : state === "running" ? (
        <svg viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.6" fill="none" strokeWidth="1.6" stroke="currentColor" strokeOpacity="0.25" />
          <path d="M7 1.4A5.6 5.6 0 0 1 12.6 7" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.6" fill="none" strokeWidth="1.4" stroke="currentColor" strokeDasharray="2 2.2" />
        </svg>
      )}
    </span>
  );
}
