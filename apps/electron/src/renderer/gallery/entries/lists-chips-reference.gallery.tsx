import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { Avatar } from "../../components/Avatar";
import { DotSphere } from "../../components/DotSphere";
import { KeyValueList } from "../../components/KeyValueList";
import { ListCard } from "../../components/ListCard";
import { ProgressBar } from "../../components/ProgressBar";
import { ProgressRing } from "../../components/ProgressRing";
import { PropertyChip } from "../../components/PropertyChip";
import { Section } from "../../components/Section";
import { SegmentedControl } from "../../components/SegmentedControl";
import { DEVICE_SEGMENTS } from "../../components/SegmentedControl/gallery-samples";
import { SeriesLegend } from "../../components/SeriesLegend";
import { STAT_SAMPLES } from "../../components/StatCard/gallery-samples";
import { StatGrid } from "../../components/StatCard/StatGrid";
import { CHIPS_REFERENCE, REFERENCE_GROUP, REFERENCE_WIDTH } from "./reference-samples";
import styles from "./reference.module.css";

const noop = (): void => undefined;

function ChipsReference() {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [hidden, setHidden] = useState<string[]>([...CHIPS_REFERENCE.legendHidden]);
  const { branch, confidential, section, card } = CHIPS_REFERENCE;
  return (
    <div className={styles.frame}>
      <div className={styles.chips}>
        <PropertyChip label={branch.label} icon={branch.icon} />
        <PropertyChip label={confidential.label} icon={confidential.icon} color={confidential.color} />
        <SegmentedControl options={DEVICE_SEGMENTS} value={device} onChange={setDevice} ariaLabel={CHIPS_REFERENCE.deviceLabel} />
        <ProgressBar progress={CHIPS_REFERENCE.progress} className={styles.bar} />
        <ProgressRing progress={CHIPS_REFERENCE.ring} />
        <Avatar name={CHIPS_REFERENCE.avatar} />
        <DotSphere size={CHIPS_REFERENCE.sphereSize} />
      </div>
      <Section title={section.title} subtitle={section.subtitle} actionLabel={section.actionLabel} onAction={noop}>
        <KeyValueList rows={CHIPS_REFERENCE.rows} />
      </Section>
      <div className={styles.stats}>
        <StatGrid items={STAT_SAMPLES} />
      </div>
      <SeriesLegend items={CHIPS_REFERENCE.legend} hidden={hidden} onChange={setHidden} />
      <ListCard title={card.title} subtitle={card.subtitle} icon={card.icon} value={card.value} valueLabel={card.valueLabel} />
    </div>
  );
}

export default defineGalleryEntry({
  id: CHIPS_REFERENCE.id,
  title: CHIPS_REFERENCE.title,
  group: REFERENCE_GROUP,
  width: REFERENCE_WIDTH,
  render: () => <ChipsReference />,
});
