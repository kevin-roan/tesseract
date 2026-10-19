import { ActionButton } from "../../../components/ActionButton";
import { ActionMenu } from "../../../components/ActionMenu";
import { PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { RefreshButton } from "../shared/RefreshButton";
import { SECTION_LABELS as L } from "./labels";
import { MachineListRow } from "./MachineListRow";
import { useMachinesGroup } from "./use-machines-group";

export function MachinesGroup() {
  const group = useMachinesGroup();
  return (
    <>
      <SettingsGroup
        title={L.machinesGroup}
        description={L.machinesDescription}
        headerSuffix={<RefreshButton disabled={group.refreshing} onClick={() => group.refreshStatus()} />}
        actions={
          <SettingsActions>
            <ActionButton icon="add" label={L.machineAdd} onClick={group.openAdd} />
          </SettingsActions>
        }
      >
        {group.machines.length === 0 ? <PreferenceRow title={L.machinesEmpty} /> : null}
        {group.machines.map((machine) => (
          <MachineListRow
            key={machine.id}
            machine={machine}
            subtitle={group.subtitle(machine)}
            activeLabel={L.machineActive}
            switchLabel={L.machineSwitch}
            moreLabel={L.machineMore(machine.label)}
            menuOpen={group.menu.open && group.menuTarget?.id === machine.id}
            disabled={group.connecting}
            onSwitch={() => group.switchTo(machine.id)}
            onMore={(element) => group.openMenu(machine.id, element)}
          />
        ))}
      </SettingsGroup>
      <ActionMenu anchor={group.menu.anchor} sections={group.sections} onClose={group.menu.close} ariaLabel={L.machinesGroup} />
    </>
  );
}
