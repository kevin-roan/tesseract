import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CaretRightIcon, ChatCircleIcon, PlusIcon } from "phosphor-react-native";

import Avatar from "@/components/avatar";
import { ListGroup, ListRow } from "@/components/list-group";
import SideDrawer from "@/components/side-drawer";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize, HitSlop, IconSize } from "@/theme";

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

  return (
    <SideDrawer visible={visible} onClose={onClose} onClosed={drawer.onClosed} testID="home-drawer">
      <ThemedText variant="h1" accessibilityRole="header" style={styles.title}>
        {DRAWER_TITLE}
      </ThemedText>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ListGroup plain>
          {drawer.items.map((item) => (
            <ListRow
              key={item.id}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              size="large"
              onPress={item.onPress}
              testID={`drawer-${item.id}`}
            />
          ))}
        </ListGroup>

        {drawer.recents.length > 0 ? (
          <ListGroup plain title={DRAWER_RECENTS_TITLE}>
            {drawer.recents.map((chat) => (
              <ListRow key={chat.id} icon={ChatCircleIcon} label={chat.title} onPress={chat.onPress} />
            ))}
          </ListGroup>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={DRAWER_ALL_CHATS_LABEL}
          onPress={drawer.allChats}
          style={({ pressed }) => [styles.allChats, pressed && styles.pressed]}
        >
          <ThemedText variant="body" color="textSecondary">
            {DRAWER_ALL_CHATS_LABEL}
          </ThemedText>
          <CaretRightIcon size={IconSize.sm} color={theme.colors.textSecondary} />
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={DRAWER_PROFILE_LABEL}
          hitSlop={HitSlop.sm}
          onPress={drawer.openProfile}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={drawer.user.name} photo={drawer.user.photo} size={AvatarSize.lg} initialsVariant="bodyStrong" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={DRAWER_NEW_CHAT_LABEL}
          onPress={drawer.newChat}
          style={({ pressed }) => [styles.newChat, pressed && styles.newChatPressed]}
          testID="drawer-new-chat"
        >
          <PlusIcon size={IconSize.md} color={theme.colors.accentInk} weight="bold" />
          <ThemedText variant="button" color="accentInk">
            {DRAWER_NEW_CHAT_LABEL}
          </ThemedText>
        </Pressable>
      </View>
    </SideDrawer>
  );
};

export default HomeDrawer;
