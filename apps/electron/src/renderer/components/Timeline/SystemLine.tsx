import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { ActivityRow } from "./ActivityRow";
import styles from "./Timeline.module.css";

export interface SystemLineProps {
  text: string;
}

export function SystemLine({ text }: SystemLineProps) {
  return (
    <ActivityRow inset glyph={<Icon name="info" color="text-tertiary" />} className={styles.system}>
      <Text variant="caption" color="text-tertiary" wrap lines={null} selectable className={cx(styles.grow, styles.preWrap)}>
        {text}
      </Text>
    </ActivityRow>
  );
}
