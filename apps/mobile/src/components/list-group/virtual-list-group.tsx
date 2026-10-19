import { useCallback, useMemo, type ReactElement } from "react";
import { FlatList, View, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import { VIRTUAL_LIST_INITIAL_ROWS, VIRTUAL_LIST_WINDOW } from "./constants";
import createStyles, { type ListDividerInset } from "./styles";

export type VirtualListGroupProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T) => ReactElement;
  dividerInset?: ListDividerInset;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A ListGroup card that only mounts the rows on screen, for lists that can run into thousands. */
const VirtualListGroup = <T,>({ data, keyExtractor, renderItem, dividerInset = "icon", style, testID }: VirtualListGroupProps<T>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const divider = useMemo(() => [styles.divider, { marginLeft: styles.dividerInsets[dividerInset] }], [styles, dividerInset]);
  const Separator = useCallback(() => <View style={divider} />, [divider]);
  const render = useCallback<ListRenderItem<T>>(({ item }) => renderItem(item), [renderItem]);

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={render}
      ItemSeparatorComponent={Separator}
      style={[styles.card, style]}
      initialNumToRender={VIRTUAL_LIST_INITIAL_ROWS}
      windowSize={VIRTUAL_LIST_WINDOW}
      removeClippedSubviews
      testID={testID}
    />
  );
};

export default VirtualListGroup;
