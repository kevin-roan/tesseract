import type { IconName } from "../../theme/icons";
import { Icon } from "../../components/Icon";
import { Text } from "../../components/Text";
import styles from "./StepHero.module.css";

export interface StepHeroProps {
  icon: IconName;
  title: string;
  description?: string;
}

export function StepHero({ icon, title, description }: StepHeroProps) {
  return (
    <div className={styles.hero}>
      <span className={styles.badge}>
        <Icon name={icon} color="text-secondary" />
      </span>
      <div className={styles.copy}>
        <Text variant="h2">{title}</Text>
        <Text variant="body" color="text-secondary" wrap lines={null}>
          {description}
        </Text>
      </div>
    </div>
  );
}
