import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn } from "../../gallery/group-0";
import { ChoiceDropdown } from "../ChoiceDropdown";
import { PillTabs } from "../PillTabs";
import { ListToolbar } from "./ListToolbar";
import { ToolbarToggle } from "./ToolbarToggle";
import { LIST_TOOLBAR_FILTERS, LIST_TOOLBAR_SAMPLES as S, LIST_TOOLBAR_TABS } from "./gallery-samples";

function ListToolbarDemo() {
  const [tab, setTab] = useState<string>(LIST_TOOLBAR_TABS[0].id);
  const [search, setSearch] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [filter, setFilter] = useState("all");
  return (
    <GalleryColumn>
      <ListToolbar
        start={<PillTabs tabs={LIST_TOOLBAR_TABS} selected={tab} onChange={setTab} label={S.tabs} />}
        end={
          <>
            <ToolbarToggle icon="filter" label={S.search} active={search} onToggle={setSearch} />
            <ToolbarToggle icon="display-options" label={S.group} active={grouped} onToggle={setGrouped} />
          </>
        }
      />
      <ListToolbar
        start={<PillTabs tabs={LIST_TOOLBAR_TABS} selected={tab} onChange={setTab} label={S.tabs} />}
        end={<ChoiceDropdown variant="toolbar" options={LIST_TOOLBAR_FILTERS} value={filter} onChange={setFilter} tooltip={S.filter} />}
      />
    </GalleryColumn>
  );
}

export default defineGalleryEntry({
  id: "list-toolbar",
  title: "ListToolbar",
  group: "Layout",
  width: 720,
  render: () => <ListToolbarDemo />,
});
