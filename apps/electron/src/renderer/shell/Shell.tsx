import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useAppCommands } from "../app/commands";
import { ConnectionBanner, GlobalLayer, PageOutlet } from "../app/feedback";
import { ResizeHandle } from "../components/ResizeHandle";
import { SplitView } from "../components/SplitView";
import { ToastHost } from "../components/Toast";
import { PreferencesDialog } from "../pages/preferences/PreferencesDialog";
import { useBackdrop } from "./hooks/use-backdrop";
import { useCollapsed, useForcedPane } from "./hooks/use-collapsed";
import { useShellCommands } from "./hooks/use-shell-commands";
import { useSidebarWidth } from "./hooks/use-sidebar-width";
import { ShellDialogs } from "./ShellDialogs";
import { ShellPageHeader } from "./ShellPageHeader";
import { ShellSidebar } from "./ShellSidebar";
import styles from "./Shell.module.css";

export function Shell() {
  useAppCommands();
  useShellCommands();
  const backdrop = useBackdrop();
  const collapsed = useCollapsed();
  const sidebar = useSidebarWidth();
  const forcedPane = useForcedPane();
  const { key } = useLocation();
  const [showContent, setShowContent] = useState(forcedPane !== "sidebar");
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    setShowContent(true);
  }, [key]);
  return (
    <>
      <SplitView
        sidebar={<ShellSidebar collapsed={collapsed} />}
        sidebarWidth={sidebar.width}
        collapsed={collapsed}
        showContent={showContent}
        resizeHandle={<ResizeHandle width={sidebar.width} onResize={sidebar.onResize} onCommit={sidebar.onCommit} />}
      >
        <ShellPageHeader
          backdrop={backdrop}
          trafficLightInset={collapsed}
          onBack={collapsed ? () => setShowContent(false) : undefined}
        />
        <ConnectionBanner />
        <div className={styles.page}>
          <PageOutlet />
        </div>
      </SplitView>
      <PreferencesDialog />
      <ShellDialogs />
      <GlobalLayer />
      <ToastHost />
    </>
  );
}
