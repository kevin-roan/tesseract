import DataCard from "@/components/data-card";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import PairingForm from "@/features/sandbox/components/pairing-form";
import QrScanner from "@/features/sandbox/components/qr-scanner";
import { usePairScreen } from "@/features/sandbox/hooks/use-pair-screen";
import { PAIR_SCREEN } from "@/features/sandbox/utils/pair-content";

export default function PairScreen() {
  const { nav, form, scanner, pair, fromLink, canRescan } = usePairScreen();

  return (
    <ScreenScaffold
      avoidKeyboard
      header={
        <ScreenHeader
          title={PAIR_SCREEN.title}
          subtitle={PAIR_SCREEN.subtitle}
          onBack={nav.back}
          dismissible
        />
      }
    >
      {fromLink ? (
        <DataCard
          index={0}
          title={PAIR_SCREEN.linkTitle}
          aside={<TagChip label={PAIR_SCREEN.linkChip} tone="warning" dot />}
        >
          <ThemedText variant="bodySmall" color="textSecondary">
            {PAIR_SCREEN.linkMessage}
          </ThemedText>
        </DataCard>
      ) : (
        <QrScanner
          permission={scanner.permission}
          onRequestPermission={() => void scanner.requestPermission()}
          onScanned={scanner.onBarcodeScanned}
          paused={form.status === "validating"}
          onRescan={canRescan ? scanner.rescan : undefined}
        />
      )}

      <DataCard
        index={1}
        title={fromLink ? PAIR_SCREEN.linkFormTitle : PAIR_SCREEN.manualTitle}
        aside={
          <TagChip
            label={fromLink ? PAIR_SCREEN.linkFormChip : PAIR_SCREEN.manualChip}
          />
        }
      >
        <PairingForm
          draft={form.draft}
          errors={form.errors}
          message={form.message}
          status={form.status}
          onChange={form.setField}
          onSubmit={pair}
        />
      </DataCard>
    </ScreenScaffold>
  );
}
