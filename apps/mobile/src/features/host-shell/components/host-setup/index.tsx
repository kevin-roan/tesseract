import type { BarcodeScanningResult } from "expo-camera";

import DataCard from "@/components/data-card";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import PairingForm from "@/features/sandbox/components/pairing-form";
import QrScanner from "@/features/sandbox/components/qr-scanner";
import type { ScannerPermission } from "@/features/sandbox/hooks/use-qr-scanner";
import type { PairingDraft, PairingErrors, PairingField, PairingStatus } from "@/features/sandbox/types";

import { HOST_PAIRING_FIELDS, HOST_PAIRING_SUBMIT, HOST_PAIRING_VALIDATING, HOST_QR, HOST_SCREEN } from "../../utils/content";

export type HostSetupProps = {
  fromLink: boolean;
  scanner: {
    permission: ScannerPermission;
    requestPermission: () => Promise<unknown>;
    onBarcodeScanned: (result: BarcodeScanningResult) => void;
    rescan: () => void;
  };
  form: {
    draft: PairingDraft;
    errors: PairingErrors;
    message: string | null;
    status: PairingStatus;
    setField: (field: PairingField, value: string) => void;
    submit: () => void;
  };
};

const HostSetup = ({ fromLink, scanner, form }: HostSetupProps) => (
  <>
    {fromLink ? (
      <DataCard index={0} title={HOST_SCREEN.linkTitle} aside={<TagChip label={HOST_SCREEN.linkChip} tone="warning" dot />}>
        <ThemedText variant="bodySmall" color="textSecondary">
          {HOST_SCREEN.linkMessage}
        </ThemedText>
      </DataCard>
    ) : (
      <QrScanner
        title={HOST_QR.title}
        footer={HOST_QR.footer}
        promptMessage={HOST_QR.promptMessage}
        permission={scanner.permission}
        onRequestPermission={() => void scanner.requestPermission()}
        onScanned={scanner.onBarcodeScanned}
        paused={form.status === "validating"}
        onRescan={form.status === "error" ? scanner.rescan : undefined}
      />
    )}
    <DataCard
      index={1}
      title={fromLink ? HOST_SCREEN.linkFormTitle : HOST_SCREEN.manualTitle}
      aside={<TagChip label={fromLink ? HOST_SCREEN.linkFormChip : HOST_SCREEN.manualChip} />}
    >
      <PairingForm
        draft={form.draft}
        errors={form.errors}
        message={form.message}
        status={form.status}
        onChange={form.setField}
        onSubmit={form.submit}
        fields={HOST_PAIRING_FIELDS}
        submitLabel={HOST_PAIRING_SUBMIT}
        validatingMessage={HOST_PAIRING_VALIDATING}
      />
    </DataCard>
  </>
);

export default HostSetup;
