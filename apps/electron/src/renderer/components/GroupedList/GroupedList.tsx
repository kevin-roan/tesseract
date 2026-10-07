import { useMemo, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { AnimatedList, AnimatedListItem } from "../AnimatedList";
import { ListGroup } from "../GroupBand";
import { RowListContext } from "../Row";
import { GROUPED_LIST_GAP } from "./constants";
import type { ListGroupData } from "./types";
import styles from "./GroupedList.module.css";

export interface GroupedListProps<T> {
  groups: readonly ListGroupData<T>[];
  getKey(item: T): string;
  renderItem(item: T): ReactNode;
  icon?: IconName | null;
  divided?: boolean;
  className?: string;
}

export function GroupedList<T>({ groups, getKey, renderItem, icon, divided = false, className }: GroupedListProps<T>) {
  const context = useMemo(() => ({ divided }), [divided]);
  let index = 0;
  return (
    <RowListContext.Provider value={context}>
      <AnimatedList gap={GROUPED_LIST_GAP} animateOnMount className={cx(styles.groups, className)}>
        {groups.map((group) => (
          <AnimatedListItem key={group.key}>
            <ListGroup title={group.title} icon={icon} count={group.items.length}>
              <AnimatedList animateOnMount role="list" label={group.title} className={cx(styles.rows, divided && styles.divided)}>
                {group.items.map((item) => (
                  <AnimatedListItem key={getKey(item)} index={index++} role="listitem">
                    {renderItem(item)}
                  </AnimatedListItem>
                ))}
              </AnimatedList>
            </ListGroup>
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </RowListContext.Provider>
  );
}
