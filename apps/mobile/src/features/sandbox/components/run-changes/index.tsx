import { useMemo } from "react";
import { FlatList } from "react-native";
import { GitDiffIcon } from "phosphor-react-native";
import type { SyncFileChange } from "@theone/protocol";

import EmptyState from "@/components/empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";

import SyncFileRow from "../sync-file-row";
import createStyles from "./styles";

export type RunChangesProps = {
  changes: SyncFileChange[];
};

const keyOf = (change: SyncFileChange) => change.path;

/** Files changed in the run's project since its last push from the host. */
const RunChanges = ({ changes }: RunChangesProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (changes.length === 0) {
    return <EmptyState icon={GitDiffIcon} title="No changes" message="Files Claude changes in this project show up here." />;
  }

  return (
    <FlatList
      data={changes}
      keyExtractor={keyOf}
      renderItem={({ item }) => <SyncFileRow change={item} />}
      contentContainerStyle={styles.list}
      testID="run-changes"
    />
  );
};

export default RunChanges;
