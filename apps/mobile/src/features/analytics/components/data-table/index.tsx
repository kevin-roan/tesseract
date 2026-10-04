import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type DataTableRow = {
  id: string;
  cells: string[];
};

export type DataTableProps = {
  columns: string[];
  rows: DataTableRow[];
  testID?: string;
};

const DataTable = ({ columns, rows, testID }: DataTableProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.table} testID={testID}>
      <View style={styles.row} accessibilityRole="header">
        {columns.map((column, index) => (
          <ThemedText
            key={column}
            variant="caption"
            color="textTertiary"
            numberOfLines={1}
            style={index === 0 ? styles.first : styles.cell}
          >
            {column}
          </ThemedText>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.id} style={styles.row} accessible accessibilityLabel={row.cells.join(", ")}>
          {row.cells.map((cell, index) => (
            <ThemedText
              key={`${row.id}-${columns[index] ?? index}`}
              variant="caption"
              color={index === 0 ? "textSecondary" : "text"}
              numberOfLines={1}
              style={index === 0 ? styles.first : styles.cell}
            >
              {cell}
            </ThemedText>
          ))}
        </View>
      ))}
    </View>
  );
};

export default DataTable;
