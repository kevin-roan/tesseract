import { useMemo } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { CameraIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import type { ScannerPermission } from "../../hooks/use-qr-scanner";
import createStyles from "./styles";

export type QrScannerProps = {
  permission: ScannerPermission;
  onRequestPermission: () => void;
  onScanned: (result: BarcodeScanningResult) => void;
  paused: boolean;
  onRescan?: () => void;
};

const QrScanner = ({ permission, onRequestPermission, onScanned, paused, onRescan }: QrScannerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (permission === "granted") {
    return (
      <View style={styles.frame}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={paused ? undefined : onScanned}
        />
        <View style={styles.reticle} pointerEvents="none" />
        {onRescan ? (
          <View style={styles.overlayAction}>
            <ActionButton label="Scan again" variant="secondary" size="sm" onPress={onRescan} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.frame, styles.placeholder]}>
      {permission === "unknown" ? (
        <ActivityIndicator color={theme.colors.textSecondary} />
      ) : (
        <>
          <CameraIcon size={IconSize.xl} color={theme.colors.textSecondary} weight="duotone" />
          <ThemedText variant="bodySmall" color="textSecondary" style={styles.centered}>
            {permission === "blocked"
              ? "Camera access is turned off for TheOne. Allow it in Settings to scan the pairing code."
              : "Scan the QR code printed by `theone-controller pair` to connect in one step."}
          </ThemedText>
          {permission === "blocked" ? (
            <ActionButton label="Open Settings" variant="secondary" size="sm" onPress={() => void Linking.openSettings().catch(() => undefined)} />
          ) : (
            <ActionButton label="Allow camera" size="sm" onPress={onRequestPermission} />
          )}
        </>
      )}
    </View>
  );
};

export default QrScanner;
