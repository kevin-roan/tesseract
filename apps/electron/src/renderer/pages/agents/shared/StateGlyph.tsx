import { Icon } from "../../../components/Icon";
import { Spinner } from "../../../components/Spinner";
import { stateGlyph } from "../../../features/agents/model";
import { cx } from "../../../lib/cx";
import { GLYPH_SIZE, ROW_SPINNER_SIZE } from "./constants";
import styles from "./shared.module.css";

export interface StateGlyphProps {
  state: string;
  className?: string;
}

export function StateGlyph({ state, className }: StateGlyphProps) {
  const glyph = stateGlyph(state);
  return (
    <span className={cx(styles.glyph, className)} data-state={state}>
      {glyph.kind === "spinner" ? <Spinner size={ROW_SPINNER_SIZE} /> : <Icon name={glyph.icon} size={GLYPH_SIZE} color={glyph.color} />}
    </span>
  );
}
