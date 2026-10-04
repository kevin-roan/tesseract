import { useMemo } from "react";
import { View } from "react-native";
import { CheckCircleIcon, CloudSlashIcon, DesktopIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { ListGroup, ListRow } from "@/components/list-group";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import Section from "@/components/section";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { SyncBackState } from "../../hooks/use-sync-back";
import { SYNC_ACTIONS } from "../../utils/actions";
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
    <Section title="Sync" loading={sync.loading} testID="project-sync">
      <View style={styles.stack}>
        {sync.loadError ? (
          <MotionItem>
            <Notice tone="danger" message={sync.loadError} />
          </MotionItem>
        ) : null}
        {sync.actionError && !sync.sheetOpen ? (
          <MotionItem>
            <Notice tone="danger" message={sync.actionError} />
          </MotionItem>
        ) : null}
        {sync.notice ? (
          <MotionItem>
            <Notice {...sync.notice} actionLabel="Dismiss" onAction={sync.dismissNotice} />
          </MotionItem>
        ) : null}

        {sync.host ? (
          <MotionItem>
            <ListGroup>
              <ListRow icon={DesktopIcon} label="Host" detail={sync.host} />
            </ListGroup>
          </MotionItem>
        ) : null}

        {sync.empty === "never-pushed" ? (
          <MotionItem>
            <ListGroup>
              <ListRow icon={CloudSlashIcon} label="Not pushed yet" detail={SYNC_COPY.neverPushed} />
            </ListGroup>
          </MotionItem>
        ) : null}

        {sync.empty === "up-to-date" ? (
          <MotionItem>
            <ListGroup>
              <ListRow icon={CheckCircleIcon} label={SYNC_COPY.upToDate} />
            </ListGroup>
          </MotionItem>
        ) : null}

        {sync.files.length > 0 ? (
          <MotionItem>
            <ListGroup title={sync.summary} dividerInset="text" testID="sync-files">
              {sync.files.map((change) => (
                <SyncFileRow key={change.path} change={change} />
              ))}
              {sync.fileToggleLabel ? <ListRow label={sync.fileToggleLabel} onPress={sync.toggleExpanded} /> : null}
            </ListGroup>
          </MotionItem>
        ) : null}

        {sync.empty === null && !sync.loadError ? (
          <MotionItem>
            <ActionButton
              label={SYNC_ACTIONS.pull.label}
              icon={SYNC_ACTIONS.pull.icon}
              onPress={() => sync.openSheet("pull")}
              disabled={!sync.canSync}
              loading={sync.syncing}
              stretch
            />
          </MotionItem>
        ) : null}

        {!sync.loading && !sync.loadError ? (
          <MotionItem>
            <ListGroup testID="sync-actions">
              {sync.actions.map((action) => (
                <ListRow
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  detail={action.detail}
                  destructive={action.tone === "danger"}
                  disabled={action.disabled}
                  onPress={action.onPress}
                  testID={`sync-action-${action.id}`}
                />
              ))}
            </ListGroup>
          </MotionItem>
        ) : null}

        {sync.requests.length > 0 ? (
          <MotionItem>
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
          </MotionItem>
        ) : null}
      </View>

      <SyncConfirmSheet
        visible={sync.sheetOpen}
        view={sync.sheet}
        selected={sync.selected}
        onToggleFile={sync.toggleFile}
        force={sync.force}
        onForceChange={sync.setForce}
        onConfirm={sync.submit}
        onClose={sync.closeSheet}
        submitting={sync.submitting}
        disabled={!sync.canSubmit}
        error={sync.actionError}
      />
    </Section>
  );
};

export default SyncSection;
