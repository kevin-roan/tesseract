import { Icon } from "../../components/Icon";
import { KeyedList } from "../../components/KeyedList";
import { Row } from "../../components/Row";
import { Text } from "../../components/Text";
import type { CountTarget } from "../../features/overview/constants";
import type { ActivityItem } from "../../features/overview/model";
import styles from "./Overview.module.css";

export interface ActivityListProps {
  items: readonly ActivityItem[];
  onOpen: (target: CountTarget) => void;
  label?: string;
}

const keyOf = (item: ActivityItem) => item.id;

export function ActivityList({ items, onOpen, label }: ActivityListProps) {
  return (
    <KeyedList
      items={items}
      getKey={keyOf}
      label={label}
      className={styles.flatList}
      renderItem={(item) => (
        <Row className={styles.activityRow} label={item.label} onActivate={() => onOpen(item.target)}>
          <Icon name={item.icon} color="text-secondary" />
          <Text className={styles.grow}>{item.label}</Text>
          <Text color="text-secondary" tabular>
            {item.value}
          </Text>
        </Row>
      )}
    />
  );
}
