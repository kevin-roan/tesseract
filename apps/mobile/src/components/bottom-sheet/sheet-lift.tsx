import { useContext, type ComponentProps, type ReactNode } from "react";
import Animated from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

type SheetLiftProps = {
  keyboardHeight: number;
  entering: ComponentProps<typeof Animated.View>["entering"];
  children: ReactNode;
};

/** Raises the sheet to the keyboard's top, less the bottom safe area its SafeAreaView already pads. */
export const SheetLift = ({ keyboardHeight, entering, children }: SheetLiftProps) => {
  const insets = useContext(SafeAreaInsetsContext);
  const keyboardInset = Math.max(keyboardHeight - (insets?.bottom ?? 0), 0);

  return (
    <Animated.View entering={entering} style={{ marginBottom: keyboardInset }}>
      {children}
    </Animated.View>
  );
};
