import { useState } from "react";
import { defineGalleryEntry } from "../app/define";
import { ActionButton } from "../components/ActionButton";
import { AnimatedList, AnimatedListItem } from "../components/AnimatedList";
import { IconButton } from "../components/IconButton";
import { HeaderTitle, PageHeader } from "../components/PageHeader";
import { PAGE_HEADER_SAMPLES } from "../components/PageHeader/gallery-samples";
import { Crossfade, Presence } from "../components/Presence";
import { Reveal } from "../components/Reveal";
import {
  Sidebar,
  SidebarNav,
  SidebarNavRow,
  SidebarProjects,
  SidebarSection,
  SidebarStatusRow,
  WorkspaceSwitcher,
  type SidebarProjectItem,
} from "../components/Sidebar";
import {
  ACTIVE_PROJECT_SAMPLES,
  EXTRA_PROJECT_SAMPLE,
  MOTION_SAMPLE,
  NAV_COUNT_SAMPLES,
  NAV_SAMPLES,
  PROJECT_SAMPLES,
  PROJECT_STATE_SAMPLES,
  PROJECTS_LABEL_SAMPLE,
  SIDEBAR_SAMPLE,
} from "../components/Sidebar/gallery-samples";
import styles from "../components/Sidebar/gallery.module.css";
import { SidebarComposer } from "../components/SidebarComposer";
import { SplitView } from "../components/SplitView";
import { Text } from "../components/Text";
import { Titlebar } from "../components/Titlebar";
import { ToneDot } from "../components/ToneDot";
import { useViewDirection, ViewTransition } from "../components/ViewTransition";
import { WindowControlsView } from "../components/WindowControls";
import { COMPOSER_PROJECT_SAMPLES, GALLERY_GROUPS, NO_NAV_COUNTS, noop } from "./gallery-samples";
import { GalleryColumn, GalleryRow, GalleryStage } from "./group-0";


function SampleSidebarHeader({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Titlebar
      variant="sidebar"
      controls={collapsed ? <WindowControlsView /> : false}
      start={<WorkspaceSwitcher open={open} onClick={() => setOpen((value) => !value)} />}
      end={
        <>
          <IconButton icon="search" label={SIDEBAR_SAMPLE.search} />
          <IconButton icon="compose" label={SIDEBAR_SAMPLE.compose} variant="filled" />
        </>
      }
    />
  );
}

function SampleFooter() {
  const [value, setValue] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <>
      <SidebarComposer
        value={value}
        onChange={setValue}
        onSend={noop}
        online
        projects={COMPOSER_PROJECT_SAMPLES}
        projectId={projectId}
        onProjectChange={setProjectId}
      />
      <SidebarStatusRow
        indicator={<ToneDot tone="success" />}
        title={SIDEBAR_SAMPLE.statusTitle}
        detail={SIDEBAR_SAMPLE.statusDetail}
        tooltip={SIDEBAR_SAMPLE.statusTooltip}
      />
    </>
  );
}

interface SampleSidebarProps {
  collapsed?: boolean;
  items?: readonly SidebarProjectItem[];
  counts?: Readonly<Record<string, number>>;
}

function SampleSidebar({ collapsed = false, items = PROJECT_SAMPLES, counts = NAV_COUNT_SAMPLES }: SampleSidebarProps) {
  const [selected, setSelected] = useState<string>(SIDEBAR_SAMPLE.selected);
  return (
    <Sidebar header={<SampleSidebarHeader collapsed={collapsed} />} footer={<SampleFooter />}>
      <SidebarNav>
        <SidebarSection title={SIDEBAR_SAMPLE.sandboxTitle}>
          {NAV_SAMPLES.map((nav) => (
            <SidebarNavRow
              key={nav.id}
              label={nav.label}
              icon={nav.icon}
              count={counts[nav.id]}
              selected={nav.id === selected}
              onClick={() => setSelected(nav.id)}
            />
          ))}
        </SidebarSection>
      </SidebarNav>
      <SidebarSection
        title={SIDEBAR_SAMPLE.projectsTitle}
        actions={<IconButton icon="add" label={SIDEBAR_SAMPLE.newProject} size={22} />}
      >
        <SidebarProjects state="ready" items={items} labels={PROJECTS_LABEL_SAMPLE} onOpenProject={noop} onNewConversation={noop} onOpenRun={noop} />
      </SidebarSection>
    </Sidebar>
  );
}

function SidebarDemo() {
  return (
    <div className={styles.frame} style={{ width: SIDEBAR_SAMPLE.width }}>
      <SampleSidebar />
    </div>
  );
}

function ProjectsDemo() {
  const [items, setItems] = useState<readonly SidebarProjectItem[]>(ACTIVE_PROJECT_SAMPLES);
  const hasExtra = items.some((item) => item.id === EXTRA_PROJECT_SAMPLE.id);
  return (
    <GalleryColumn>
      <GalleryRow>
        <ActionButton
          variant="secondary"
          label={hasExtra ? MOTION_SAMPLE.remove : MOTION_SAMPLE.add}
          onClick={() =>
            setItems((current) => (hasExtra ? current.filter((item) => item.id !== EXTRA_PROJECT_SAMPLE.id) : [EXTRA_PROJECT_SAMPLE, ...current]))
          }
        />
      </GalleryRow>
      <div className={styles.stack}>
        <SidebarProjects state="ready" items={items} labels={PROJECTS_LABEL_SAMPLE} onOpenProject={noop} onNewConversation={noop} onOpenRun={noop} />
        {PROJECT_STATE_SAMPLES.map((state) => (
          <SidebarProjects key={state} state={state} items={[]} labels={PROJECTS_LABEL_SAMPLE} onCreateProject={noop} />
        ))}
      </div>
    </GalleryColumn>
  );
}

function TitlebarDemo() {
  return (
    <GalleryColumn>
      <div className={styles.panelBox}>
        <Titlebar
          divider
          controls={<WindowControlsView />}
          start={<HeaderTitle title={PAGE_HEADER_SAMPLES.rootTitle} />}
          end={<IconButton icon="refresh" label={PAGE_HEADER_SAMPLES.refresh} />}
        />
      </div>
      <div className={styles.panelBox}>
        <Titlebar
          variant="sidebar"
          controls={<WindowControlsView backdrop />}
          backdrop
          start={<WorkspaceSwitcher />}
          end={<IconButton icon="search" label={PAGE_HEADER_SAMPLES.sidebarSearch} />}
        />
      </div>
    </GalleryColumn>
  );
}

function WindowControlsDemo() {
  const [maximized, setMaximized] = useState(false);
  return (
    <GalleryColumn>
      <GalleryRow caption={SIDEBAR_SAMPLE.captions.default}>
        <WindowControlsView maximized={maximized} onToggleMaximize={() => setMaximized((value) => !value)} />
      </GalleryRow>
      <GalleryRow caption={SIDEBAR_SAMPLE.captions.maximized}>
        <WindowControlsView maximized />
      </GalleryRow>
      <GalleryRow caption={SIDEBAR_SAMPLE.captions.backdrop}>
        <WindowControlsView backdrop />
      </GalleryRow>
    </GalleryColumn>
  );
}

function PageHeaderDemo() {
  const [child, setChild] = useState<string | null>(null);
  return (
    <GalleryColumn>
      <div className={styles.panelBox}>
        <PageHeader
          title={child ?? PAGE_HEADER_SAMPLES.parent}
          parent={child ? PAGE_HEADER_SAMPLES.parent : null}
          onParentClick={child ? () => setChild(null) : undefined}
          controls={<WindowControlsView />}
          actions={
            <>
              <IconButton
                icon="forward"
                label={PAGE_HEADER_SAMPLES.child}
                onClick={() => setChild((value) => (value === PAGE_HEADER_SAMPLES.child ? PAGE_HEADER_SAMPLES.childAlt : PAGE_HEADER_SAMPLES.child))}
              />
              <IconButton icon="more" label={PAGE_HEADER_SAMPLES.more} />
            </>
          }
        />
      </div>
      <div className={styles.panelBox}>
        <PageHeader title={PAGE_HEADER_SAMPLES.child} parent={PAGE_HEADER_SAMPLES.parent} onBack={noop} controls={<WindowControlsView />} />
      </div>
    </GalleryColumn>
  );
}

function MotionDemo() {
  const [shown, setShown] = useState(true);
  const [revealed, setRevealed] = useState(true);
  const [swapped, setSwapped] = useState(false);
  const [rows, setRows] = useState<number[]>([1, 2, 3]);
  const [depth, setDepth] = useState(0);
  const viewKey = String(depth);
  const direction = useViewDirection(viewKey, depth);
  return (
    <GalleryColumn>
      <GalleryRow caption="Presence">
        <ActionButton variant="flat" label={MOTION_SAMPLE.toggle} onClick={() => setShown((value) => !value)} />
        <Presence show={shown}>
          <Text variant="bodySmall" color="text-secondary">
            {MOTION_SAMPLE.presenceBody}
          </Text>
        </Presence>
      </GalleryRow>
      <GalleryRow caption="Crossfade">
        <ActionButton variant="flat" label={MOTION_SAMPLE.swap} onClick={() => setSwapped((value) => !value)} />
        <Crossfade id={swapped ? "b" : "a"} inline>
          <Text variant="label">{swapped ? MOTION_SAMPLE.crossfadeB : MOTION_SAMPLE.crossfadeA}</Text>
        </Crossfade>
      </GalleryRow>
      <GalleryColumn>
        <GalleryRow caption="Reveal">
          <ActionButton variant="flat" label={MOTION_SAMPLE.toggle} onClick={() => setRevealed((value) => !value)} />
        </GalleryRow>
        <Reveal open={revealed}>
          <div className={styles.demoBox}>
            <Text variant="bodySmall" color="text-secondary">
              {MOTION_SAMPLE.revealBody}
            </Text>
          </div>
        </Reveal>
      </GalleryColumn>
      <GalleryColumn>
        <GalleryRow caption="AnimatedList">
          <ActionButton variant="flat" icon="add" label={MOTION_SAMPLE.add} onClick={() => setRows((current) => [Math.max(0, ...current) + 1, ...current])} />
          <ActionButton variant="flat" label={MOTION_SAMPLE.remove} onClick={() => setRows((current) => current.slice(1))} />
        </GalleryRow>
        <div className={styles.stack}>
          <AnimatedList gap={1}>
            {rows.map((row) => (
              <AnimatedListItem key={row}>
                <SidebarNavRow icon="chat" label={`${MOTION_SAMPLE.rowPrefix} ${row}`} />
              </AnimatedListItem>
            ))}
          </AnimatedList>
        </div>
      </GalleryColumn>
      <GalleryColumn>
        <GalleryRow caption="ViewTransition">
          <ActionButton variant="flat" label={MOTION_SAMPLE.push} onClick={() => setDepth((value) => value + 1)} />
          <ActionButton variant="flat" label={MOTION_SAMPLE.pop} disabled={depth === 0} onClick={() => setDepth((value) => Math.max(0, value - 1))} />
        </GalleryRow>
        <div className={styles.viewBox}>
          <ViewTransition viewKey={viewKey} direction={direction}>
            <div className={styles.view}>
              <Text variant="h3">{`${MOTION_SAMPLE.viewPrefix} ${depth}`}</Text>
              <Text variant="caption" color="text-tertiary">
                {direction}
              </Text>
            </div>
          </ViewTransition>
        </div>
      </GalleryColumn>
    </GalleryColumn>
  );
}

function ShellChromeDemo({ collapsed = false }: { collapsed?: boolean }) {
  const [showContent, setShowContent] = useState(!collapsed);
  return (
    <div
      className={styles.fill}
      style={{ width: collapsed ? SIDEBAR_SAMPLE.collapsedWidth : SIDEBAR_SAMPLE.windowWidth, height: SIDEBAR_SAMPLE.windowHeight }}
    >
      <SplitView
        sidebarWidth={SIDEBAR_SAMPLE.width}
        collapsed={collapsed}
        showContent={showContent}
        sidebar={<SampleSidebar collapsed={collapsed} counts={NO_NAV_COUNTS} />}
      >
        <PageHeader
          title={SIDEBAR_SAMPLE.pageTitle}
          controls={<WindowControlsView />}
          onBack={collapsed ? () => setShowContent(false) : undefined}
        />
        <div className={styles.pageBody} />
      </SplitView>
    </div>
  );
}

export const titlebarEntry = defineGalleryEntry({ id: "titlebar", title: "Titlebar", group: GALLERY_GROUPS.appChrome, width: 720, render: () => <TitlebarDemo /> });

export const windowControlsEntry = defineGalleryEntry({
  id: "window-controls",
  title: "WindowControls",
  group: GALLERY_GROUPS.appChrome,
  render: () => <WindowControlsDemo />,
});

export const pageHeaderEntry = defineGalleryEntry({
  id: "page-header",
  title: "PageHeader (HeaderTitle)",
  group: GALLERY_GROUPS.appChrome,
  width: 720,
  render: () => <PageHeaderDemo />,
});

export const sidebarEntry = defineGalleryEntry({ id: "sidebar", title: "Sidebar", group: GALLERY_GROUPS.appChrome, render: () => <SidebarDemo /> });

export const sidebarProjectsEntry = defineGalleryEntry({
  id: "sidebar-projects",
  title: "SidebarProjects",
  group: GALLERY_GROUPS.appChrome,
  render: () => <ProjectsDemo />,
});

export const motionEntry = defineGalleryEntry({
  id: "motion",
  title: "Motion (Presence, Crossfade, Reveal, AnimatedList, ViewTransition)",
  group: GALLERY_GROUPS.appChrome,
  width: 560,
  render: () => (
    <GalleryStage>
      <MotionDemo />
    </GalleryStage>
  ),
});

export const shellChromeEntry = defineGalleryEntry({
  id: "shell-chrome",
  title: "SplitView (shell chrome)",
  group: GALLERY_GROUPS.appChrome,
  render: () => <ShellChromeDemo />,
});

export const shellChromeCollapsedEntry = defineGalleryEntry({
  id: "shell-chrome-collapsed",
  title: "SplitView (collapsed)",
  group: GALLERY_GROUPS.appChrome,
  render: () => <ShellChromeDemo collapsed />,
});

export const GROUP_7_ENTRIES = [
  titlebarEntry,
  windowControlsEntry,
  pageHeaderEntry,
  sidebarEntry,
  sidebarProjectsEntry,
  motionEntry,
  shellChromeEntry,
  shellChromeCollapsedEntry,
] as const;
