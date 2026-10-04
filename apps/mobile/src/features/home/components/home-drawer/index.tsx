import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretRightIcon, ChatCircleIcon, PlusIcon } from "phosphor-react-native";

import Avatar from "@/components/avatar";
import PressableScale from "@/components/pressable-scale";
import SideDrawer from "@/components/side-drawer";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { AvatarSize, HitSlop, IconSize } from "@/theme";

import DrawerRow from "../drawer-row";
import {
  DRAWER_ALL_CHATS_LABEL,
  DRAWER_NEW_CHAT_LABEL,
  DRAWER_PROFILE_LABEL,
  DRAWER_RECENTS_TITLE,
  DRAWER_TITLE,
} from "./constants";
import createStyles from "./styles";
import { useHomeDrawer } from "./use-home-drawer";

export type HomeDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

const HomeDrawer = ({ visible, onClose }: HomeDrawerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const drawer = useHomeDrawer(onClose);
  const recentsStart = drawer.items.length;
  const allChatsEntering = useEntrance(recentsStart + drawer.recents.length, "tight");

  return (
    <SideDrawer visible={visible} onClose={onClose} onClosed={drawer.onClosed} testID="home-drawer">
      <ThemedText variant="h1" numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header" style={styles.title}>
        {DRAWER_TITLE}
      </ThemedText>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          {drawer.items.map((item, index) => (
            <DrawerRow
              key={item.id}
              index={index}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              size="large"
              onPress={item.onPress}
              testID={`drawer-${item.id}`}
            />
          ))}
        </View>

        {drawer.recents.length > 0 ? (
          <View style={styles.group}>
            <ThemedText variant="bodySmall" color="textSecondary" accessibilityRole="header" style={styles.groupTitle}>
              {DRAWER_RECENTS_TITLE}
            </ThemedText>
            {drawer.recents.map((chat, index) => (
              <DrawerRow
                key={chat.id}
                index={recentsStart + index}
                icon={ChatCircleIcon}
                label={chat.title}
                onPress={chat.onPress}
              />
            ))}
          </View>
        ) : null}

        <Animated.View entering={allChatsEntering}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={DRAWER_ALL_CHATS_LABEL}
            onPress={drawer.allChats}
            style={styles.allChats}
          >
            <ThemedText variant="label" color="textSecondary">
              {DRAWER_ALL_CHATS_LABEL}
            </ThemedText>
            <CaretRightIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="light" />
          </PressableScale>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={DRAWER_PROFILE_LABEL}
          hitSlop={HitSlop.sm}
          onPress={drawer.openProfile}
        >
          <Avatar name={drawer.user.name} photo={drawer.user.photo} size={AvatarSize.lg} initialsVariant="bodyStrong" />
        </PressableScale>

        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={DRAWER_NEW_CHAT_LABEL}
          onPress={drawer.newChat}
          style={styles.newChat}
          testID="drawer-new-chat"
        >
          <PlusIcon size={IconSize.sm} color={theme.colors.accentInk} weight="regular" />
          <ThemedText variant="button" color="accentInk">
            {DRAWER_NEW_CHAT_LABEL}
          </ThemedText>
        </PressableScale>
      </View>
    </SideDrawer>
  );
};

export default HomeDrawer;
