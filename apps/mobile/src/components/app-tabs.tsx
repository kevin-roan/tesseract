import { router, type Href } from "expo-router";
import { TrayIcon } from "phosphor-react-native";

import FloatingTabBar from "@/components/floating-tab-bar";
import { inboxBadgeLabel } from "@/components/home-header/utils/labels";
import NativeTabBar from "@/components/native-tab-bar";
import { AppTabRoutes } from "@/constants/tabs";
import { useInbox } from "@/features/inbox/hooks/use-inbox";
import { INBOX_ROUTE } from "@/features/inbox/utils/constants";
import { useNativeTabs } from "@/hooks/use-native-tabs";

export default function AppTabs() {
  const native = useNativeTabs();
  const inbox = useInbox();
  const unreadCount = inbox.data?.unreadCount ?? 0;

  if (native) {
    return <NativeTabBar tabs={AppTabRoutes} badges={{ index: inboxBadgeLabel(unreadCount) }} />;
  }

  return (
    <FloatingTabBar
      tabs={AppTabRoutes}
      accessory={{ label: "Inbox", icon: TrayIcon, badge: unreadCount > 0, onPress: () => router.push(INBOX_ROUTE as Href) }}
    />
  );
}
