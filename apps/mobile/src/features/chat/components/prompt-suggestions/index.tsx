import { useMemo } from "react";
import { ScrollView } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import type { PromptSuggestion } from "../../utils/suggestions";
import SuggestionCard from "../suggestion-card";
import createStyles from "./styles";

export type PromptSuggestionsProps = {
  suggestions: PromptSuggestion[];
  onSelect: (suggestion: PromptSuggestion) => void;
};

const PromptSuggestions = ({ suggestions, onSelect }: PromptSuggestionsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {suggestions.map((suggestion, index) => (
        <SuggestionCard key={suggestion.id} label={suggestion.label} index={index} onPress={() => onSelect(suggestion)} />
      ))}
    </ScrollView>
  );
};

export default PromptSuggestions;
