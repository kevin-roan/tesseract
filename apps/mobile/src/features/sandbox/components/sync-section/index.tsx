import { useMemo } from "react";
import { View } from "react-native";
import { ArrowCounterClockwiseIcon, ArrowLineUpIcon, CheckCircleIcon, CloudSlashIcon, DesktopIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { ListGroup, ListRow } from "@/components/list-group";
import Notice from "@/components/notice";
import Section from "@/components/section";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { SyncBackState } from "../../hooks/use-sync-back";
import { SYNC_COPY } from "../../utils/sync";
import SyncConfirmSheet from "../sync-confirm-sheet";
import SyncFileRow from "../sync-file-row";
import SyncRequestRow from "../sync-request-row";
import createStyles from "./styles";

export type SyncSectionProps = {
  sync: SyncBackState;
};

const SyncSection = ({ sync }: SyncSectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Section title="Sync to host" loading={sync.loading} testID="project-sync">
      <View style={styles.stack}>
        {sync.loadError ? <Notice tone="danger" message={sync.loadError} /> : null}
        {sync.actionError && !sync.sheetOpen ? <Notice tone="danger" message={sync.actionError} /> : null}

        {sync.host ? (
          <ListGroup>
            <ListRow icon={DesktopIcon} label="Host" detail={sync.host} />
          </ListGroup>
        ) : null}

        {sync.empty === "never-pushed" ? (
          <ListGroup>
            <ListRow icon={CloudSlashIcon} label="Not pushed yet" detail={SYNC_COPY.neverPushed} />
          </ListGroup>
        ) : null}

        {sync.empty === "up-to-date" ? (
          <ListGroup>
            <ListRow icon={CheckCircleIcon} label={SYNC_COPY.upToDate} />
          </ListGroup>
        ) : null}

        {sync.files.length > 0 ? (
          <ListGroup title={sync.summary} dividerInset="text" testID="sync-files">
            {sync.files.map((change) => (
              <SyncFileRow key={change.path} change={change} />
            ))}
            {sync.fileToggleLabel ? <ListRow label={sync.fileToggleLabel} onPress={sync.toggleExpanded} /> : null}
          </ListGroup>
        ) : null}

        {sync.empty === null && !sync.loadError ? (
          <ActionButton
            label="Sync to host"
            icon={ArrowLineUpIcon}
            onPress={sync.openSheet}
            disabled={!sync.canSync}
            loading={sync.syncing}
            stretch
          />
        ) : null}

        {sync.canRevert || sync.reverting ? (
          <ListGroup>
            <ListRow
              icon={ArrowCounterClockwiseIcon}
              label="Revert last sync"
              destructive
              disabled={sync.reverting}
              onPress={sync.revert}
            />
          </ListGroup>
        ) : null}

        {sync.requests.length > 0 ? (
          <ListGroup title="Recent syncs" dividerInset="text">
            {sync.requests.map(({ id, view }) => (
              <SyncRequestRow
                key={id}
                view={view}
                onCancel={() => sync.cancel(id)}
                cancelling={sync.cancellingId === id}
                testID={`sync-request-${id}`}
              />
            ))}
          </ListGroup>
        ) : null}
      </View>

      <SyncConfirmSheet
        visible={sync.sheetOpen}
        changes={sync.changes}
        message={sync.confirmMessage}
        showForce={sync.showForce}
        force={sync.force}
        onForceChange={sync.setForce}
        onConfirm={sync.submit}
        onClose={sync.closeSheet}
        submitting={sync.syncing}
        error={sync.actionError}
      />
    </Section>
  );
};

export default SyncSection;
