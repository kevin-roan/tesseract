import { Children, Fragment, isValidElement, useMemo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles, { type ListDividerInset } from "./styles";

export type ListGroupProps = {
  children: ReactNode;
  title?: string;
  footnote?: string;
  plain?: boolean;
  dividerInset?: ListDividerInset;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ListGroup = ({ children, title, footnote, plain = false, dividerInset = "icon", style, testID }: ListGroupProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rows = Children.toArray(children).filter(isValidElement);
  const divider = [styles.divider, { marginLeft: styles.dividerInsets[dividerInset] }];

  return (
    <View style={[styles.group, style]} testID={testID}>
      {title ? (
        <ThemedText variant="bodySmall" color="textSecondary" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
      ) : null}

      <View style={plain ? null : styles.card}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 && !plain ? <View style={divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>

      {footnote ? (
        <ThemedText variant="caption" color="textTertiary" style={styles.footnote}>
          {footnote}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default ListGroup;
