import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { ListGroup } from "../../components/GroupBand";
import { Section } from "../../components/Section";
import { SegmentedControl } from "../../components/SegmentedControl";
import { DEVICE_SEGMENTS } from "../../components/SegmentedControl/gallery-samples";
import { ResourceHistoryDemo } from "../../components/TimeSeriesChart/ResourceHistoryDemo";
import { CHART_REFERENCE, REFERENCE_GROUP, REFERENCE_WIDTH } from "./reference-samples";
import styles from "./reference.module.css";

function ChartReference() {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const { builds, toolchain } = CHART_REFERENCE;
  return (
    <div className={styles.frame}>
      <div className={styles.row}>
        <div className={styles.centered}>
          <SegmentedControl options={DEVICE_SEGMENTS} value={device} onChange={setDevice} ariaLabel={CHART_REFERENCE.deviceLabel} />
        </div>
        <ListGroup className={styles.group} title={builds.title} icon={builds.icon} loading loadingLabel={builds.loadingLabel} />
        <Section className={styles.fill} title={toolchain.title} loading loadingLabel={toolchain.loadingLabel} />
      </div>
      <ResourceHistoryDemo />
    </div>
  );
}

export default defineGalleryEntry({
  id: CHART_REFERENCE.id,
  title: CHART_REFERENCE.title,
  group: REFERENCE_GROUP,
  width: REFERENCE_WIDTH,
  render: () => <ChartReference />,
});
