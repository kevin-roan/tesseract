import { EmptyState } from "../../components/EmptyState";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useDeviceKind } from "../../features/emulator/hooks/use-device-kind";
import { EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";
import { useHostGate } from "../../features/host-shell/hooks/use-host-gate";
import { useHostLockHeader } from "../shell/HostLockAction";
import { HostUnlock } from "../shell/HostUnlock";
import { DevicePanel } from "./DevicePanel";
import styles from "./EmulatorPage.module.css";

export default function EmulatorPage() {
  const host = useHostGate();
  const kinds = useDeviceKind();
  useHostLockHeader({ title: EMULATOR_PAGE_LABELS.title, visible: host.access === "ready", onLock: host.lock });
  const { gate } = host;
  return (
    <div className={styles.page}>
      {gate ? (
        <EmptyState
          icon={gate.icon}
          loading={gate.loading}
          title={gate.title}
          message={gate.message}
          actionLabel={gate.actionLabel ?? undefined}
          onAction={gate.action ? host.onAction : undefined}
          secondaryLabel={gate.secondaryLabel ?? undefined}
          onSecondary={gate.secondary ? host.onSecondary : undefined}
        />
      ) : (
        <>
          {kinds.switchable ? (
            <div className={styles.kinds}>
              <SegmentedControl options={kinds.options} value={kinds.kind.id} onChange={kinds.select} ariaLabel={EMULATOR_PAGE_LABELS.kinds} />
            </div>
          ) : null}
          <DevicePanel key={kinds.kind.id} kind={kinds.kind} />
        </>
      )}
      <HostUnlock dialog={host.unlockDialog} />
    </div>
  );
}
