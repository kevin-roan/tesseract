import { motion } from "motion/react";
import { Tooltip } from "../../../components/Tooltip";
import { SUGGESTIONS } from "../../../features/agents/labels";
import { rise, stagger, STAGGER_MS } from "../../../theme/motion";
import styles from "./NewConversationView.module.css";

export interface SuggestionChipsProps {
  onPick(prompt: string): void;
}

export function SuggestionChips({ onPick }: SuggestionChipsProps) {
  return (
    <div className={styles.suggestions}>
      {SUGGESTIONS.map((suggestion, index) => (
        <Tooltip key={suggestion.label} label={suggestion.prompt}>
          <motion.button
            type="button"
            className={styles.suggestion}
            variants={rise}
            initial="initial"
            animate="animate"
            transition={stagger(index, STAGGER_MS.rows)}
            onClick={() => onPick(suggestion.prompt)}
          >
            {suggestion.label}
          </motion.button>
        </Tooltip>
      ))}
    </div>
  );
}
