import { View } from "react-native";
import { LinkSimpleBreakIcon, LinkSimpleIcon } from "phosphor-react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { IconSize } from "@/theme";

export type LinkStatusProps = {
  tone: Tone;
  /** Announced in place of the icon, e.g. "Online". */
  label: string;
  /** Draws the broken link, for a sandbox that is not connected. */
  broken?: boolean;
};

/** Quiet link glyph that leads a sandbox name: whole when linked, broken when not. */
const LinkStatus = ({ tone, label, broken = false }: LinkStatusProps) => {
  const theme = useAppTheme();
  const Glyph = broken ? LinkSimpleBreakIcon : LinkSimpleIcon;

  return (
    <View accessible accessibilityLabel={label}>
      <Glyph size={IconSize.sm} weight="bold" color={theme.colors[ToneColors[tone].foreground]} />
    </View>
  );
};

export default LinkStatus;
