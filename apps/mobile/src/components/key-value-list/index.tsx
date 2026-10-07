import { Fragment, useMemo } from "react";
import { View } from "react-native";

import KeyValueRow from "@/components/key-value-row";
import { Surface } from "@/components/surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type KeyValueItem = {
  id: string;
  label: string;
  value: string;
  monospace?: boolean;
  tone?: Tone;
};

export type KeyValueListProps = {
  items: readonly KeyValueItem[];
  testID?: string;
};

/** Card of label/value rows split by hairlines, for read-only details. */
const KeyValueList = ({ items, testID }: KeyValueListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Surface style={styles.card} testID={testID}>
      {items.map(({ id, ...row }, index) => (
        <Fragment key={id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row} testID={testID ? `${testID}-${id}` : undefined}>
            <KeyValueRow {...row} />
          </View>
        </Fragment>
      ))}
    </Surface>
  );
};

export default KeyValueList;
