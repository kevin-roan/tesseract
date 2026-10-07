import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { LockKeyIcon } from "phosphor-react-native";

import Notice from "@/components/notice";
import PinPad, { type PinKey } from "@/components/pin-pad";
import StatusLine from "@/components/status-line";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { usePulse } from "@/hooks/use-pulse";
import { IconSize } from "@/theme";

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
  const badgeEntrance = useEntrance(0);
  const titleEntrance = useEntrance(1);
  const statusEntrance = useEntrance(0, "tight");
  const pulse = usePulse(submitting);

  return (
    <View style={styles.screen}>
      {pinMissing ? <Notice tone="warning" icon={LockKeyIcon} message={HOST_SCREEN.pinMissing} actionLabel={HOST_SCREEN.retry} onAction={onRetry} /> : null}
      {message ? <Notice tone="danger" message={message} actionLabel={HOST_SCREEN.retry} onAction={onRetry} /> : null}
      <View style={styles.center}>
        <Animated.View entering={badgeEntrance}>
          <Animated.View style={[styles.badge, pin.error && styles.badgeError, pulse]}>
            <LockKeyIcon size={IconSize.xl} color={pin.error ? theme.colors.danger : theme.colors.text} />
          </Animated.View>
        </Animated.View>
        <Animated.View entering={titleEntrance} style={styles.heading}>
          <ThemedText variant="title">{HOST_SCREEN.pinTitle}</ThemedText>
          <TagChip label={hostName} dot />
        </Animated.View>
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
        <View style={styles.status}>
          {rejectedMessage ? (
            <Animated.View entering={statusEntrance}>
              <StatusLine tone="danger" message={rejectedMessage} />
            </Animated.View>
          ) : null}
          {line ? (
            <Animated.View entering={statusEntrance}>
              <StatusLine tone={line.tone} message={line.message} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default HostUnlock;
