import { useMemo } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { ArrowCounterClockwiseIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import CellMatrix from "@/components/cell-matrix";
import CornerReticle from "@/components/corner-reticle";
import DataCard from "@/components/data-card";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { ScannerPermission } from "../../hooks/use-qr-scanner";
import { QR_PLACEHOLDER_LEVELS, QR_SCANNER, STATUS_PROMPT, scannerChip } from "../../utils/pair-content";
import createStyles from "./styles";

export type QrScannerProps = {
  permission: ScannerPermission;
  onRequestPermission: () => void;
  onScanned: (result: BarcodeScanningResult) => void;
  paused: boolean;
  onRescan?: () => void;
  title?: string;
  footer?: string;
  promptMessage?: string;
  index?: number;
};

const openSettings = () => void Linking.openSettings().catch(() => undefined);

const QrScanner = ({
  permission,
  onRequestPermission,
  onScanned,
  paused,
  onRescan,
  title = QR_SCANNER.title,
  footer = QR_SCANNER.footer,
  promptMessage = QR_SCANNER.promptMessage,
  index = 0,
}: QrScannerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chip = scannerChip(permission, paused);
  const granted = permission === "granted";
  const blocked = permission === "blocked";

  return (
    <DataCard
      title={title}
      index={index}
      aside={<TagChip label={chip.message} tone={chip.tone} dot />}
      footer={
        granted ? (
          <>
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.footerText}>
              {`${STATUS_PROMPT} ${footer}`}
            </ThemedText>
            {onRescan ? <TagChip label={QR_SCANNER.rescan} icon={ArrowCounterClockwiseIcon} onPress={onRescan} /> : null}
          </>
        ) : undefined
      }
    >
      <View style={styles.viewport}>
        {granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={paused ? undefined : onScanned}
          />
        ) : permission === "unknown" ? (
          <ActivityIndicator color={theme.colors.textSecondary} />
        ) : (
          <CellMatrix levels={QR_PLACEHOLDER_LEVELS} cellSize={theme.spacing.md} />
        )}
        <CornerReticle />
      </View>
      {granted || permission === "unknown" ? null : (
        <View style={styles.prompt}>
          <ThemedText variant="bodySmall" color="textSecondary">
            {blocked ? QR_SCANNER.blockedMessage : promptMessage}
          </ThemedText>
          {blocked ? (
            <ActionButton label={QR_SCANNER.openSettings} variant="secondary" onPress={openSettings} stretch />
          ) : (
            <ActionButton label={QR_SCANNER.allow} onPress={onRequestPermission} stretch />
          )}
        </View>
      )}
    </DataCard>
  );
};

export default QrScanner;
