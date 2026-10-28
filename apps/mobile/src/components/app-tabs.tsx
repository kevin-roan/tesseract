import { router, type Href } from "expo-router";
import { TrayIcon } from "phosphor-react-native";

import FloatingTabBar from "@/components/floating-tab-bar";
import { AppTabRoutes } from "@/constants/tabs";
import { useInbox } from "@/features/inbox/hooks/use-inbox";
import { INBOX_ROUTE } from "@/features/inbox/utils/constants";

export default function AppTabs() {
  const inbox = useInbox();
  const unread = (inbox.data?.unreadCount ?? 0) > 0;

  return (
    <FloatingTabBar
      tabs={AppTabRoutes}
      accessory={{ label: "Inbox", icon: TrayIcon, badge: unread, onPress: () => router.push(INBOX_ROUTE as Href) }}
    />
  );
}
