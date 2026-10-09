import { BroomIcon, CheckCircleIcon, HardDrivesIcon, WarningIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import EmptyState from "@/components/empty-state";
import GlassSheet from "@/components/glass-sheet";
import Notice from "@/components/notice";
import ResourceCard from "@/components/resource-card";
import { formatBytes } from "@/features/sandbox/utils/format";

import type { ProjectStorageState } from "../../hooks/use-project-storage";
import { storageRowSubtitle, STORAGE_COPY } from "../../utils/content";

export type StorageSheetProps = {
  state: ProjectStorageState;
};

const StorageSheet = ({ state }: StorageSheetProps) => (
  <GlassSheet visible={state.open} onClose={state.close} title={STORAGE_COPY.title} subtitle={state.subtitle} testID="storage-sheet">
    {state.clearError ? <Notice tone="danger" icon={WarningIcon} message={state.clearError} /> : null}
    {state.clearedMessage ? <Notice tone="success" icon={CheckCircleIcon} message={state.clearedMessage} /> : null}
    {state.rows.length === 0 ? (
      state.error ? (
        <EmptyState
          icon={HardDrivesIcon}
          title={STORAGE_COPY.failedTitle}
          message={state.error}
          actionLabel={STORAGE_COPY.retry}
          onAction={state.retry}
        />
      ) : (
        <EmptyState loading title={STORAGE_COPY.loading} />
      )
    ) : (
      <>
        {state.rows.map((row) => (
          <ResourceCard
            key={row.id}
            icon={row.icon}
            title={row.label}
            subtitle={storageRowSubtitle(row)}
            meta={formatBytes(row.sizeBytes)}
            footer={
              row.clearable ? (
                <ActionButton
                  label={STORAGE_COPY.clear}
                  icon={BroomIcon}
                  variant="secondary"
                  size="sm"
                  loading={state.clearingCategory === row.id}
                  disabled={state.clearingCategory !== null}
                  onPress={() => state.clear(row.id)}
                  accessibilityLabel={`${STORAGE_COPY.clear} ${row.label}`}
                />
              ) : undefined
            }
          />
        ))}
        {state.canClearAll ? (
          <ActionButton
            label={STORAGE_COPY.clearAll}
            icon={BroomIcon}
            variant="danger"
            stretch
            loading={state.clearingCategory === "all"}
            disabled={state.clearingCategory !== null}
            onPress={state.clearAll}
          />
        ) : (
          <Notice message={STORAGE_COPY.nothingToClear} />
        )}
      </>
    )}
  </GlassSheet>
);

export default StorageSheet;
