import { ShieldCheckIcon } from "phosphor-react-native";

import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import PairingForm from "@/features/sandbox/components/pairing-form";
import QrScanner from "@/features/sandbox/components/qr-scanner";
import { usePairScreen } from "@/features/sandbox/hooks/use-pair-screen";

export default function PairScreen() {
  const { nav, form, scanner, pair, fromLink, canRescan } = usePairScreen();

  return (
    <ScreenScaffold
      avoidKeyboard
      header={<ScreenHeader title="Pair a sandbox" subtitle="Connect over your tailnet" onBack={nav.back} dismissible />}
    >
      {fromLink ? (
        <Notice
          tone="info"
          icon={ShieldCheckIcon}
          title="Opened from a pairing link"
          message="Only pair with a sandbox you run yourself. The token gives full control of it."
        />
      ) : (
        <Section title="Scan the pairing code">
          <QrScanner
            permission={scanner.permission}
            onRequestPermission={() => void scanner.requestPermission()}
            onScanned={scanner.onBarcodeScanned}
            paused={form.status === "validating"}
            onRescan={canRescan ? scanner.rescan : undefined}
          />
        </Section>
      )}

      <Section title={fromLink ? "Check the details" : "Or enter it by hand"}>
        <PairingForm
          draft={form.draft}
          errors={form.errors}
          message={form.message}
          status={form.status}
          onChange={form.setField}
          onSubmit={pair}
        />
      </Section>
    </ScreenScaffold>
  );
}
