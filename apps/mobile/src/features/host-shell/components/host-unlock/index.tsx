import { useMemo } from "react";
import { View } from "react-native";
import { LockKeyIcon } from "phosphor-react-native";

import DataCard from "@/components/data-card";
import Notice from "@/components/notice";
import PinPad, { type PinKey } from "@/components/pin-pad";
import StatusLine from "@/components/status-line";
import TagChip from "@/components/tag-chip";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { LockLine, PinState } from "../../types";
import { HOST_SCREEN } from "../../utils/content";
import { PIN_MIN_LENGTH } from "../../utils/constants";
import createStyles from "./styles";

export type HostUnlockProps = {
  hostName: string;
  pin: PinState;
  onPress: (key: PinKey) => void;
  canSubmit: boolean;
  submitting: boolean;
  disabled: boolean;
  line: LockLine | null;
  rejectedMessage: string | null;
  pinMissing: boolean;
  message: string | null;
  onRetry: () => void;
};

const HostUnlock = ({
  hostName,
  pin,
  onPress,
  canSubmit,
  submitting,
  disabled,
  line,
  rejectedMessage,
  pinMissing,
  message,
  onRetry,
}: HostUnlockProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.stack}>
      {pinMissing ? <Notice tone="warning" icon={LockKeyIcon} message={HOST_SCREEN.pinMissing} actionLabel={HOST_SCREEN.retry} onAction={onRetry} /> : null}
      {message ? <Notice tone="danger" message={message} actionLabel={HOST_SCREEN.retry} onAction={onRetry} /> : null}
      <DataCard index={0} title={HOST_SCREEN.pinTitle} icon={LockKeyIcon} aside={<TagChip label={hostName} dot />}>
        <View style={styles.body}>
          <PinPad
            entered={pin.digits.length}
            minLength={PIN_MIN_LENGTH}
            onPress={onPress}
            canSubmit={canSubmit}
            submitLabel={HOST_SCREEN.pinTitle}
            loading={submitting}
            disabled={disabled}
            error={pin.error}
          />
          {rejectedMessage ? <StatusLine tone="danger" message={rejectedMessage} /> : null}
          {line ? <StatusLine tone={line.tone} message={line.message} /> : null}
        </View>
      </DataCard>
    </View>
  );
};

export default HostUnlock;
