import { View, type ViewProps } from "react-native";

export type BarcodeScanningResult = { type: string; data: string };

let permission = { granted: true, canAskAgain: true, status: "granted", expires: "never" };

export const requestPermission = jest.fn(async () => permission);
export const getPermission = jest.fn(async () => permission);

export function __setPermission(next: Partial<typeof permission>): void {
  permission = { ...permission, ...next };
}

export const useCameraPermissions = () => [permission, requestPermission, getPermission] as const;

export function CameraView(props: ViewProps & { onBarcodeScanned?: (result: BarcodeScanningResult) => void }) {
  return <View testID="camera" {...props} />;
}
