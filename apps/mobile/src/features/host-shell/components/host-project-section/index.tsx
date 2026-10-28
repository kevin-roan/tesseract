import { useMemo } from "react";
import { View } from "react-native";

import ActionButton from "@/components/action-button";
import ActionTileRow from "@/components/action-tile-row";
import BottomSheet from "@/components/bottom-sheet";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import Section from "@/components/section";
import TextField from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { HostProjectState } from "../../hooks/use-host-project";
import { HOST_PROJECT_COPY as COPY, HOST_PROJECT_ICONS as ICONS } from "../../utils/content";
import createStyles from "./styles";

export type HostProjectSectionProps = {
  state: HostProjectState;
  testID?: string;
};

/** "This computer": Claude chat, a shell and git on the project's copy on the paired host. */
const HostProjectSection = ({ state, testID = "host-project" }: HostProjectSectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (state.kind === "hidden") return null;

  return (
    <Section title={COPY.title} testID={testID}>
      {state.kind === "connect" ? (
        <Notice tone="warning" message={COPY.connect} actionLabel={COPY.connectAction} onAction={state.connect} />
      ) : null}
      {state.kind === "missing" ? <Notice message={COPY.missing} /> : null}
      {state.kind === "ready" ? (
        <View style={styles.body}>
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1} style={styles.path}>
            {state.path}
          </ThemedText>
          <ActionTileRow
            items={[
              { id: "claude", icon: ICONS.claude, label: COPY.claude, tone: "yellow", onPress: state.claude },
              { id: "shell", icon: ICONS.shell, label: COPY.shell, onPress: state.shell },
              {
                id: "git",
                icon: ICONS.git,
                label: COPY.git,
                onPress: state.git.openMenu,
                disabled: state.git.pending !== null,
              },
            ]}
          />
          <ThemedText variant="caption" color="textTertiary">
            {COPY.warning}
          </ThemedText>
          {state.notice ? <Notice tone={state.notice.tone} message={state.notice.message} actionLabel={COPY.dismiss} onAction={state.dismissNotice} /> : null}
          <MenuSheet
            visible={state.git.menuVisible}
            title={COPY.gitTitle}
            options={state.git.options}
            onSelect={state.git.select}
            onClose={state.git.closeMenu}
            testID={`${testID}-git`}
          />
          <BottomSheet visible={state.git.commitVisible} onClose={state.git.closeCommit} title={COPY.commitTitle} avoidKeyboard>
            <TextField
              label={COPY.commitLabel}
              value={state.git.message}
              onChangeText={state.git.setMessage}
              autoCapitalize="sentences"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={state.git.commit}
              editable={state.git.pending === null}
              testID={`${testID}-commit-message`}
            />
            <ActionButton
              label={COPY.commitSave}
              icon={ICONS.commit}
              onPress={state.git.commit}
              loading={state.git.pending === "commit"}
              disabled={!state.git.message.trim()}
              stretch
              testID={`${testID}-commit`}
            />
          </BottomSheet>
        </View>
      ) : null}
    </Section>
  );
};

export default HostProjectSection;
