import { motion } from "motion/react";
import { IconButton } from "../../components/IconButton";
import { PropertyRow, SettingsGroup } from "../../components/PreferenceRows";
import { SkeletonRows } from "../../components/Skeleton";
import { Text } from "../../components/Text";
import { rise, stagger, STAGGER_MS } from "../../theme/motion";
import { SKELETON_ROWS } from "./constants";
import { CLAUDE_LABELS } from "./labels";
import type { ClaudeAccountView } from "./model";
import styles from "./ClaudeStep.module.css";

export interface AccountGroupProps {
  account: ClaudeAccountView | null;
  more: string | null;
  loading: boolean;
  checking: boolean;
  onCheck(): void;
}

export function AccountGroup({ account, more, loading, checking, onCheck }: AccountGroupProps) {
  if (!loading && !account) return null;
  return (
    <div className={styles.accounts}>
      <SettingsGroup
        title={CLAUDE_LABELS.group}
        description={account ? `${account.id} · ${account.configDir}` : undefined}
        headerSuffix={
          <IconButton icon="refresh" label={CLAUDE_LABELS.checkAgain} onClick={onCheck} disabled={checking} />
        }
      >
        {account ? (
          account.properties.map((property, index) => (
            <motion.div
              key={property.key}
              variants={rise}
              initial="initial"
              animate="animate"
              transition={stagger(index, STAGGER_MS.checks)}
            >
              <PropertyRow title={property.title} value={property.value} selectable />
            </motion.div>
          ))
        ) : (
          <SkeletonRows rows={SKELETON_ROWS} icon={false} meta={false} label={CLAUDE_LABELS.loading} />
        )}
      </SettingsGroup>
      {more ? (
        <Text variant="caption" color="text-tertiary">
          {more}
        </Text>
      ) : null}
    </div>
  );
}
