import { AppWindowIcon, WarningIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import GlassSheet from "@/components/glass-sheet";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import { Surface } from "@/components/surface";

import { useWindowsSheet } from "../../hooks/use-windows-sheet";
import { WINDOWS_COPY } from "../../utils/windows";
import DisplayWindowRow from "../display-window-row";

export type WindowsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const WindowsSheet = ({ visible, onClose }: WindowsSheetProps) => {
  const sheet = useWindowsSheet(visible, onClose);
  const { windows } = sheet;

  return (
    <GlassSheet visible={visible} onClose={onClose} title={WINDOWS_COPY.title} subtitle={WINDOWS_COPY.subtitle}>
      {sheet.error && !windows ? (
        <EmptyState
          icon={WarningIcon}
          title={WINDOWS_COPY.errorTitle}
          message={sheet.error}
          actionLabel="Try again"
          onAction={sheet.refresh}
        />
      ) : !windows ? (
        <EmptyState loading title={WINDOWS_COPY.loading} />
      ) : windows.length === 0 ? (
        <EmptyState
          icon={AppWindowIcon}
          loading={sheet.refreshing}
          title={WINDOWS_COPY.emptyTitle}
          message={WINDOWS_COPY.emptyMessage}
          actionLabel="Refresh"
          onAction={sheet.refresh}
        />
      ) : (
        <>
          {sheet.actionError ? (
            <MotionItem>
              <Notice tone="danger" message={sheet.actionError} />
            </MotionItem>
          ) : null}
          <MotionItem index={0}>
            <Surface>
              {windows.map((window) => (
                <DisplayWindowRow
                  key={window.id}
                  window={window}
                  busy={sheet.busyId === window.id}
                  onActivate={sheet.activate}
                  onClose={sheet.close}
                  onForceQuit={sheet.forceQuit}
                />
              ))}
            </Surface>
          </MotionItem>
        </>
      )}
    </GlassSheet>
  );
};

export default WindowsSheet;
