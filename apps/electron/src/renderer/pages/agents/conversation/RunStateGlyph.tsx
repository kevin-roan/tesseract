import { Icon } from "../../../components/Icon";
import { Spinner } from "../../../components/Spinner";
import { STATE_GLYPH_SPINNER } from "./constants";
import styles from "./Conversation.module.css";

export interface RunStateGlyphProps {
  state: string;
}

function Glyph({ state }: RunStateGlyphProps) {
  if (state === "running") return <Spinner size={STATE_GLYPH_SPINNER} />;
  if (state === "succeeded") return <Icon name="status-done-all" color="text-secondary" />;
  if (state === "failed") return <Icon name="failed" color="danger" />;
  return <Icon name="failed" color="text-tertiary" />;
}

export function RunStateGlyph({ state }: RunStateGlyphProps) {
  return (
    <span className={styles.glyph} data-state={state}>
      <Glyph state={state} />
    </span>
  );
}
