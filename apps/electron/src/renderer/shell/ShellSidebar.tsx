import { useRef } from "react";
import { useLocation } from "react-router";
import { ROUTE } from "../../shared/routes";
import { useConnectionView } from "../app/connection";
import { useNavigateTo, usePreferencesRoute } from "../app/navigation";
import { pagesBySection } from "../app/registry/pages";
import { ActionMenu, useActionMenu } from "../components/ActionMenu";
import { IconButton } from "../components/IconButton";
import {
  Sidebar,
  SidebarContainers,
  SidebarNav,
  SidebarNavRow,
  SidebarProjects,
  SidebarSection,
  SidebarStatusRow,
  WorkspaceSwitcher,
} from "../components/Sidebar";
import { SidebarComposer } from "../components/SidebarComposer";
import { Titlebar } from "../components/Titlebar";
import { ToneDot } from "../components/ToneDot";
import { pageKeyOf } from "../app/feedback";
import { AttachmentChip, AttachmentTray } from "../components/Composer";
import { useComposerProject } from "./hooks/use-composer-project";
import { useAccountMenu } from "./hooks/use-account-menu";
import { useHistoryNav } from "./hooks/use-history-nav";
import { useMainMenu } from "./hooks/use-main-menu";
import { useSidebarComposer } from "./hooks/use-sidebar-composer";
import { useSidebarContainers } from "./hooks/use-sidebar-containers";
import { useSidebarProjects } from "./hooks/use-sidebar-projects";
import { openShellDialog } from "./hooks/use-shell-dialogs";
import { SHELL_LABELS } from "./labels";
import { MACHINE_LABELS } from "../features/machines";
import { useSlashCommands } from "../features/agents/hooks/use-slash-commands";
import { useProcessesCount } from "../features/processes/hooks/use-processes-count";
import { MachineMenu } from "./machines/MachineMenu";
import styles from "./Shell.module.css";

export interface ShellSidebarProps {
  collapsed: boolean;
}

function SidebarHeader({ collapsed }: ShellSidebarProps) {
  const navigateTo = useNavigateTo();
  const menu = useMainMenu();
  const history = useHistoryNav();
  const recentMenu = useActionMenu();
  const switcher = useRef<HTMLButtonElement>(null);
  const recentButton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Titlebar
        variant="sidebar"
        divider={collapsed}
        controls={collapsed}
        start={
          <div className={styles.historyNav}>
            <IconButton icon="back" label={SHELL_LABELS.history.back} size={24} disabled={!history.canGoBack} onClick={history.back} />
            <IconButton icon="forward" label={SHELL_LABELS.history.forward} size={24} disabled={!history.canGoForward} onClick={history.forward} />
            <IconButton
              ref={recentButton}
              icon="history"
              label={SHELL_LABELS.history.recent}
              size={24}
              checked={recentMenu.open}
              disabled={!history.hasRecent}
              onClick={(event) => (recentMenu.open ? recentMenu.close() : recentMenu.openBelow(event.currentTarget))}
            />
          </div>
        }
      />
      <div className={styles.workspaceRow}>
        <WorkspaceSwitcher
          ref={switcher}
          name={menu.name ?? undefined}
          tooltip={menu.tooltip}
          open={menu.menu.open}
          onClick={(event) => menu.toggle(event.currentTarget)}
        />
        <div className={styles.workspaceActions}>
          <IconButton icon="smartphone" label={SHELL_LABELS.pairPhone} onClick={() => openShellDialog("pair")} />
          <IconButton icon="search" label={SHELL_LABELS.search} onClick={() => navigateTo("agents", { search: true })} />
          <IconButton icon="compose" label={SHELL_LABELS.compose} variant="filled" onClick={() => navigateTo("agents", { new: true })} />
        </div>
      </div>
      <ActionMenu
        anchor={recentMenu.anchor}
        sections={history.sections}
        onClose={recentMenu.close}
        ariaLabel={SHELL_LABELS.history.recent}
        ignoreRef={recentButton}
      />
      <MachineMenu
        anchor={menu.menu.anchor}
        machines={menu.machines}
        sections={menu.sections}
        onSwitch={menu.switchTo}
        onClose={menu.menu.close}
        ariaLabel={SHELL_LABELS.menu.label}
        ignoreRef={switcher}
      />
    </>
  );
}

function SidebarFooter() {
  const composer = useSidebarComposer();
  const slashCommands = useSlashCommands(composer.projectId);
  const view = useConnectionView();
  const { projects } = useSidebarProjects();
  const account = useAccountMenu();
  const statusRow = useRef<HTMLButtonElement>(null);
  return (
    <>
      <SidebarComposer
        value={composer.value}
        onChange={composer.setValue}
        onSend={composer.send}
        online={view.online}
        projects={projects}
        projectId={composer.projectId}
        onProjectChange={composer.setProjectId}
        onAttach={composer.attachments.attach}
        hasAttachments={composer.attachments.items.length > 0}
        attachmentsBlocked={composer.attachments.blocked}
        slashCommands={slashCommands}
        tray={
          <AttachmentTray>
            {composer.attachments.items.map((item) => (
              <AttachmentChip
                key={item.key}
                name={item.name}
                kind={item.kind}
                status={item.status}
                error={item.error}
                onRemove={() => composer.attachments.remove(item.key)}
                onRetry={() => composer.attachments.retry(item.key)}
              />
            ))}
          </AttachmentTray>
        }
      />
      <SidebarStatusRow
        ref={statusRow}
        indicator={<ToneDot tone={view.dotTone} />}
        title={view.title}
        detail={view.detail}
        tooltip={view.tooltip}
        open={account.open}
        onClick={(event) => (account.open ? account.close() : account.openBelow(event.currentTarget))}
      />
      <ActionMenu anchor={account.anchor} sections={account.sections} onClose={account.close} ariaLabel={MACHINE_LABELS.menuLabel} ignoreRef={statusRow} />
    </>
  );
}

export function ShellSidebar({ collapsed }: ShellSidebarProps) {
  const navigateTo = useNavigateTo();
  const current = pageKeyOf(useLocation().pathname);
  const sidebar = useSidebarProjects();
  const processesCount = useProcessesCount();
  const setComposerProject = useComposerProject((store) => store.setProjectId);
  const openProject = (id: string) => {
    setComposerProject(id);
    navigateTo("projects", { projectId: id }, id);
  };
  const newConversation = (id: string | null) => {
    setComposerProject(id);
    navigateTo("agents", id ? { new: true, projectId: id } : { new: true });
  };
  const createProject = () => navigateTo("projects", { create: true });
  const containers = useSidebarContainers();
  const { openPreferences } = usePreferencesRoute();
  const createContainer = () => navigateTo("containers", { create: true });
  return (
    <Sidebar header={<SidebarHeader collapsed={collapsed} />} footer={<SidebarFooter />}>
      <SidebarNav>
        {pagesBySection().map((group) => (
          <SidebarSection key={group.section} title={SHELL_LABELS.sections[group.section]}>
            {group.pages.map((page) => (
              <SidebarNavRow
                key={page.id}
                label={page.title}
                icon={page.icon}
                href={`#${ROUTE.page(page.id)}`}
                selected={page.id === current}
                count={page.id === "agents" ? sidebar.agentsCount : page.id === "processes" ? processesCount : null}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo(page.id);
                }}
              />
            ))}
          </SidebarSection>
        ))}
      </SidebarNav>
      <SidebarSection
        title={SHELL_LABELS.projects}
        actions={<IconButton icon="add" label={SHELL_LABELS.newProject} size={22} disabled={!sidebar.online} onClick={createProject} />}
      >
        <SidebarProjects
          state={sidebar.state}
          items={sidebar.items}
          labels={SHELL_LABELS.projectStates}
          onOpenProject={openProject}
          onNewConversation={newConversation}
          onOpenRun={(runId) => navigateTo("agents", { runId })}
          onCreateProject={createProject}
        />
      </SidebarSection>
      <SidebarSection
        title={SHELL_LABELS.containers}
        actions={<IconButton icon="add" label={SHELL_LABELS.newContainer} size={22} onClick={createContainer} />}
      >
        <SidebarContainers
          state={containers.state}
          items={containers.items}
          selected={containers.selected}
          labels={SHELL_LABELS.containerStates}
          onOpen={(name) => navigateTo("containers", undefined, encodeURIComponent(name))}
          onOpenRequest={() => navigateTo("containers")}
          onStart={containers.start}
          onStop={containers.stop}
          onCreate={createContainer}
          onSetUp={() => openPreferences("containers")}
        />
      </SidebarSection>
    </Sidebar>
  );
}
