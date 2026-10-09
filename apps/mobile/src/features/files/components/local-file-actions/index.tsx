import { CheckCircleIcon, DownloadSimpleIcon, PaperPlaneTiltIcon, ShareNetworkIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ProgressBar from "@/components/progress-bar";

import type { LocalFileStatus } from "../../hooks/use-local-downloads";
import { downloadLabel } from "../../utils/describe";

export type LocalFileActionsProps = {
  fileName: string;
  status: LocalFileStatus;
  onDownload: () => void;
  onShare: () => void;
  onTaildrop?: () => void;
};

const LocalFileActions = ({ fileName, status, onDownload, onShare, onTaildrop }: LocalFileActionsProps) => {
  const downloading = status.progress !== undefined;
  return (
    <>
      <ActionButton
        label={downloadLabel(status)}
        icon={status.downloaded ? CheckCircleIcon : DownloadSimpleIcon}
        variant="secondary"
        size="sm"
        disabled={status.downloaded || downloading}
        onPress={onDownload}
        accessibilityLabel={status.downloaded ? `${fileName} is saved on this device` : `Download ${fileName}`}
      />
      <ActionButton
        label="Share"
        icon={ShareNetworkIcon}
        variant="secondary"
        size="sm"
        loading={status.sharing}
        onPress={onShare}
        accessibilityLabel={`Share ${fileName}`}
      />
      {onTaildrop ? (
        <ActionButton
          label="Taildrop"
          icon={PaperPlaneTiltIcon}
          variant="secondary"
          size="sm"
          onPress={onTaildrop}
          accessibilityLabel={`Send ${fileName} with Taildrop`}
        />
      ) : null}
    </>
  );
};

export const LocalFileProgress = ({ fileName, status }: Pick<LocalFileActionsProps, "fileName" | "status">) =>
  status.progress === undefined ? null : <ProgressBar progress={status.progress} label={`Downloading ${fileName}`} />;

export default LocalFileActions;
