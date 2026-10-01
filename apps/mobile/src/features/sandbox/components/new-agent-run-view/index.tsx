import { useMemo } from "react";
import { View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";

import { GlassButton } from "@/components/glass";
import ScreenScaffold from "@/components/screen-scaffold";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";
import ChatComposer from "@/features/chat/components/chat-composer";
import ChatHero from "@/features/chat/components/chat-hero";
import PromptSuggestions from "@/features/chat/components/prompt-suggestions";

import { useNewAgentRun } from "../../hooks/use-new-agent-run";
import createStyles from "./styles";

export type NewAgentRunViewProps = {
  projectId: string | null;
};

const NewAgentRunView = ({ projectId }: NewAgentRunViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { nav, composer, greeting, suggestions } = useNewAgentRun(projectId);

  return (
    <ScreenScaffold
      scroll={false}
      avoidKeyboard
      header={
        <View style={styles.header}>
          <GlassButton accessibilityLabel="Go back" onPress={nav.back} style={styles.headerButton}>
            <ArrowLeftIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
          </GlassButton>
        </View>
      }
      footer={
        <View style={styles.footer}>
          {suggestions.visible ? <PromptSuggestions suggestions={suggestions.items} onSelect={suggestions.select} /> : null}
          <ChatComposer composer={composer} placeholder="How can I help you today?" noProjectLabel="New project" testID="new-run-composer" />
        </View>
      }
    >
      <ChatHero title={greeting} subtitle="Plan, edit, debug and ship code with Claude in your sandbox." />
    </ScreenScaffold>
  );
};

export default NewAgentRunView;
