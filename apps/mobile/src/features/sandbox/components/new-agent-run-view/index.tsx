import { useMemo } from "react";
import { View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";

import Reveal from "@/components/reveal";
import ScreenScaffold from "@/components/screen-scaffold";
import HeaderButton from "@/components/screen-header/header-button";
import { useAppTheme } from "@/hooks/use-app-theme";
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
          <HeaderButton icon={ArrowLeftIcon} label="Go back" onPress={nav.back} size="md" />
        </View>
      }
      footer={
        <View style={styles.footer}>
          {suggestions.visible ? (
            <Reveal>
              <PromptSuggestions suggestions={suggestions.items} onSelect={suggestions.select} />
            </Reveal>
          ) : null}
          <ChatComposer composer={composer} placeholder="How can I help you today?" testID="new-run-composer" />
        </View>
      }
    >
      <View style={styles.hero}>
        <ChatHero title={greeting} subtitle="Plan, edit, debug and ship code with Claude in your sandbox." />
      </View>
    </ScreenScaffold>
  );
};

export default NewAgentRunView;
