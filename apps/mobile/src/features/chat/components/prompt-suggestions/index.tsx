import { useMemo } from "react";
import { Pressable, ScrollView } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { PromptSuggestion } from "../../utils/suggestions";
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
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.id}
          accessibilityRole="button"
          accessibilityLabel={suggestion.label}
          onPress={() => onSelect(suggestion)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <ThemedText variant="bodySmall" numberOfLines={2}>
            {suggestion.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
};

export default PromptSuggestions;
