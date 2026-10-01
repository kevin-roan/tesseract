import { useMemo, useState } from "react";
import { View } from "react-native";
import { CheckIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type TextConfirmStepProps = {
  initialText: string;
  onConfirm: (text: string) => void;
};

const TextConfirmStep = ({ initialText, onConfirm }: TextConfirmStepProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [text, setText] = useState(initialText);

  return (
    <View style={styles.step}>
      <TextField
        label="Recognized text"
        hint="Fix anything the recognizer got wrong before attaching it."
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        spellCheck
        testID="recognized-text"
      />
      <ActionButton label="Use text" icon={CheckIcon} disabled={!text.trim()} onPress={() => onConfirm(text)} stretch />
    </View>
  );
};

export default TextConfirmStep;
