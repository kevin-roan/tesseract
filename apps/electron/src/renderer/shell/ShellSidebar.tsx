import { useRef } from "react";
import { useLocation } from "react-router";
import { ROUTE } from "../../shared/routes";
import { useConnectionView } from "../app/connection";
import { useNavigateTo, usePreferencesRoute } from "../app/navigation";
import { pagesBySection } from "../app/registry/pages";
import { ActionMenu } from "../components/ActionMenu";
import { IconButton } from "../components/IconButton";
import {
  Sidebar,
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
import { useMainMenu } from "./hooks/use-main-menu";
import { useSidebarComposer } from "./hooks/use-sidebar-composer";
import { useSidebarProjects } from "./hooks/use-sidebar-projects";
import { SHELL_LABELS } from "./labels";

export interface ShellSidebarProps {
  collapsed: boolean;
}

function SidebarHeader({ collapsed }: ShellSidebarProps) {
  const navigateTo = useNavigateTo();
  const menu = useMainMenu();
  const switcher = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Titlebar
        variant="sidebar"
        divider={collapsed}
        controls={collapsed}
        start={
          <WorkspaceSwitcher
            ref={switcher}
            open={menu.open}
            onClick={(event) => (menu.open ? menu.close() : menu.openBelow(event.currentTarget))}
          />
        }
        end={
          <>
            <IconButton icon="search" label={SHELL_LABELS.search} onClick={() => navigateTo("agents", { search: true })} />
            <IconButton icon="compose" label={SHELL_LABELS.compose} variant="filled" onClick={() => navigateTo("agents", { new: true })} />
          </>
        }
      />
      <ActionMenu anchor={menu.anchor} sections={menu.sections} onClose={menu.close} ariaLabel={SHELL_LABELS.menu.label} ignoreRef={switcher} />
    </>
  );
}

function SidebarFooter() {
  const composer = useSidebarComposer();
  const view = useConnectionView();
  const { projects } = useSidebarProjects();
  const { openPreferences } = usePreferencesRoute();
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
        indicator={<ToneDot tone={view.dotTone} />}
        title={view.title}
        detail={view.detail}
        tooltip={view.tooltip}
        onClick={() => openPreferences("connection")}
      />
    </>
  );
}

export function ShellSidebar({ collapsed }: ShellSidebarProps) {
  const navigateTo = useNavigateTo();
  const current = pageKeyOf(useLocation().pathname);
  const sidebar = useSidebarProjects();
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
                count={page.id === "agents" ? sidebar.agentsCount : null}
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
    </Sidebar>
  );
}
