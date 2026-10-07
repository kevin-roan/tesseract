import { Crossfade } from "../../components/Presence";
import { useOverview } from "../../features/overview/hooks/use-overview";
import { OverviewContent } from "./OverviewContent";
import { OverviewEmpty } from "./OverviewEmpty";
import styles from "./Overview.module.css";

export default function OverviewPage() {
  const overview = useOverview();
  const view = overview.content ? "content" : "empty";
  return (
    <Crossfade id={view} className={styles.root} layerClassName={styles.layer}>
      {overview.content ? <OverviewContent overview={overview} content={overview.content} /> : null}
      {!overview.content && overview.empty ? <OverviewEmpty model={overview.empty} onAction={overview.runAction} /> : null}
    </Crossfade>
  );
}
