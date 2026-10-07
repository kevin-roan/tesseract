import { useState } from "react";
import { defineGalleryEntry } from "../app/define";
import { ActionButton } from "../components/ActionButton";
import { ChoiceDropdown } from "../components/ChoiceDropdown";
import { EmptyState } from "../components/EmptyState";
import { EMPTY_STATE_SAMPLES } from "../components/EmptyState/gallery-samples";
import { GroupBand, ListGroup } from "../components/GroupBand";
import { GROUP_BAND_SAMPLES } from "../components/GroupBand/gallery-samples";
import styles from "../components/GroupBand/gallery.module.css";
import { IconButton } from "../components/IconButton";
import { KeyedList } from "../components/KeyedList";
import { KEYED_LIST_SAMPLE } from "../components/KeyedList/gallery-samples";
import { PageBody } from "../components/PageBody";
import { PAGE_BODY_SAMPLE } from "../components/PageBody/gallery-samples";
import { PillTabs } from "../components/PillTabs";
import { PILL_TABS_SAMPLE, PILL_TABS_SAMPLE_DEFAULT, PILL_TABS_SAMPLE_LABEL } from "../components/PillTabs/gallery-samples";
import { RecordRow } from "../components/RecordRow";
import { RECORD_ROW_EXTRA_SAMPLES, RECORD_ROW_SAMPLES, type RecordRowSample } from "../components/RecordRow/gallery-samples";
import { Row } from "../components/Row";
import { ROW_SAMPLE } from "../components/Row/gallery-samples";
import { Section } from "../components/Section";
import { SECTION_SAMPLES } from "../components/Section/gallery-samples";
import { Skeleton, SkeletonRows } from "../components/Skeleton";
import { SKELETON_SAMPLE } from "../components/Skeleton/gallery-samples";
import { Text } from "../components/Text";
import { GALLERY_GROUPS, noop, recordRowSampleKey } from "./gallery-samples";

const renderSample = ({ key: _key, ...props }: RecordRowSample) => <RecordRow {...props} />;

function PillTabsDemo() {
  const [selected, setSelected] = useState<string>(PILL_TABS_SAMPLE_DEFAULT);
  return <PillTabs tabs={PILL_TABS_SAMPLE} selected={selected} onChange={setSelected} label={PILL_TABS_SAMPLE_LABEL} />;
}

function ReferenceDemo() {
  const { processes, commits, toggles, projectFilter } = GROUP_BAND_SAMPLES;
  return (
    <div className={styles.reference}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          <PillTabsDemo />
        </div>
        <div className={styles.toolbarEnd}>
          {toggles.map((toggle, index) => (
            <IconButton key={toggle.id} icon={toggle.icon} label={toggle.label} variant="bordered" size={28} checked={index === 1} />
          ))}
          <ChoiceDropdown variant="toolbar" options={projectFilter.options} value={projectFilter.value} tooltip={projectFilter.label} />
        </div>
      </div>
      <ListGroup title={processes.title} icon={processes.icon} count={processes.count} actionLabel={processes.actionLabel} onAction={noop}>
        <KeyedList items={RECORD_ROW_SAMPLES} getKey={recordRowSampleKey} renderItem={renderSample} />
      </ListGroup>
      <ListGroup title={commits.title} icon={commits.icon} count={commits.count} empty emptyLabel={commits.emptyLabel} />
    </div>
  );
}

function GroupStatesDemo() {
  const { ports, builds, commits } = GROUP_BAND_SAMPLES;
  return (
    <div className={styles.stack}>
      <GroupBand title={ports.title} icon={ports.icon} subtitle={ports.subtitle} actionLabel={ports.title} onAction={noop} />
      <ListGroup title={builds.title} icon={builds.icon} count={0} loading loadingLabel={builds.loadingLabel} />
      <ListGroup title={commits.title} icon={commits.icon} count={commits.count} empty emptyLabel={commits.emptyLabel} />
    </div>
  );
}

function KeyedListDemo() {
  const [names, setNames] = useState<string[]>(KEYED_LIST_SAMPLE.names.slice(0, 3));
  const add = () => setNames((current) => [...current, `${KEYED_LIST_SAMPLE.names[current.length % KEYED_LIST_SAMPLE.names.length] ?? ""}${current.length}`]);
  const remove = () => setNames((current) => current.slice(0, -1));
  const shuffle = () => setNames((current) => [...current].reverse());
  return (
    <div className={styles.stack}>
      <div className={styles.controls}>
        <ActionButton size="sm" label={KEYED_LIST_SAMPLE.addLabel} onClick={add} />
        <ActionButton size="sm" label={KEYED_LIST_SAMPLE.removeLabel} onClick={remove} />
        <ActionButton size="sm" label={KEYED_LIST_SAMPLE.shuffleLabel} onClick={shuffle} />
      </div>
      <KeyedList
        divided
        label={KEYED_LIST_SAMPLE.label}
        items={names}
        getKey={(name) => name}
        renderItem={(name) => <RecordRow icon="file" title={name} meta={KEYED_LIST_SAMPLE.meta} onActivate={noop} />}
      />
    </div>
  );
}

function RowDemo() {
  const actions = (
    <>
      <IconButton icon="copy" label={ROW_SAMPLE.copyLabel} size={24} />
      <IconButton icon="delete" label={ROW_SAMPLE.deleteLabel} size={24} />
    </>
  );
  return (
    <KeyedList
      items={[ROW_SAMPLE.title, ROW_SAMPLE.selectedTitle, ROW_SAMPLE.plainTitle]}
      getKey={(title) => title}
      renderItem={(title) => (
        <Row onActivate={title === ROW_SAMPLE.plainTitle ? undefined : noop} selected={title === ROW_SAMPLE.selectedTitle} hoverActions={actions}>
          <RecordRow title={title} icon="file" />
        </Row>
      )}
    />
  );
}

function SectionDemo() {
  const { resources, toolchain, activity, rows } = SECTION_SAMPLES;
  return (
    <div className={styles.stack}>
      <Section title={resources.title} subtitle={resources.subtitle} actionLabel={resources.actionLabel} onAction={noop}>
        {rows.map(([label, value]) => (
          <Text key={label} variant="bodySmall" color="text-secondary">
            {`${label}: ${value}`}
          </Text>
        ))}
      </Section>
      <Section title={toolchain.title} empty emptyLabel={toolchain.emptyLabel} />
      <Section title={activity.title} loading loadingLabel={activity.loadingLabel} />
    </div>
  );
}

function PageBodyDemo() {
  return (
    <div className={styles.frame} style={{ height: PAGE_BODY_SAMPLE.height }}>
      <PageBody maxWidth={PAGE_BODY_SAMPLE.maxWidth}>
        <Text variant="bodySmall" color="text-secondary" wrap>
          {PAGE_BODY_SAMPLE.body}
        </Text>
        {PAGE_BODY_SAMPLE.sections.map((title) => (
          <Section key={title} title={title}>
            <div className={styles.placeholder} />
          </Section>
        ))}
      </PageBody>
    </div>
  );
}

function SkeletonDemo() {
  return (
    <div className={styles.stack}>
      <ListGroup title={SKELETON_SAMPLE.bandTitle} icon="smartphone">
        <SkeletonRows rows={SKELETON_SAMPLE.rows} />
      </ListGroup>
      <Skeleton shape="block" height={SKELETON_SAMPLE.blockHeight} />
    </div>
  );
}

export const listsReferenceEntry = defineGalleryEntry({
  id: "lists-reference",
  title: "Toolbar, groups and rows (reference)",
  group: GALLERY_GROUPS.lists,
  width: GROUP_BAND_SAMPLES.referenceWidth,
  render: () => <ReferenceDemo />,
});

export const pillTabsEntry = defineGalleryEntry({ id: "pill-tabs", title: "PillTabs", group: GALLERY_GROUPS.lists, render: () => <PillTabsDemo /> });

export const groupBandEntry = defineGalleryEntry({
  id: "group-band",
  title: "GroupBand / ListGroup",
  group: GALLERY_GROUPS.lists,
  width: 720,
  render: () => <GroupStatesDemo />,
});

export const rowEntry = defineGalleryEntry({ id: "row", title: "Row (HoverRow)", group: GALLERY_GROUPS.lists, width: 720, render: () => <RowDemo /> });

export const recordRowEntry = defineGalleryEntry({
  id: "record-row",
  title: "RecordRow",
  group: GALLERY_GROUPS.lists,
  width: 720,
  render: () => (
    <KeyedList items={[...RECORD_ROW_SAMPLES, ...RECORD_ROW_EXTRA_SAMPLES]} getKey={recordRowSampleKey} renderItem={renderSample} divided />
  ),
});

export const keyedListEntry = defineGalleryEntry({
  id: "keyed-list",
  title: "KeyedList",
  group: GALLERY_GROUPS.lists,
  width: 720,
  render: () => <KeyedListDemo />,
});

export const sectionEntry = defineGalleryEntry({ id: "section", title: "Section", group: GALLERY_GROUPS.lists, width: 720, render: () => <SectionDemo /> });

export const pageBodyEntry = defineGalleryEntry({ id: "page-body", title: "PageBody", group: GALLERY_GROUPS.lists, width: 720, render: () => <PageBodyDemo /> });

export const emptyStateEntry = defineGalleryEntry({
  id: "empty-state",
  title: "EmptyState",
  group: GALLERY_GROUPS.lists,
  width: 720,
  render: () => (
    <div className={styles.stack}>
      {EMPTY_STATE_SAMPLES.map(({ key, ...props }) => (
        <div key={key} className={styles.frame}>
          <EmptyState {...props} />
        </div>
      ))}
    </div>
  ),
});

export const skeletonEntry = defineGalleryEntry({ id: "skeleton", title: "Skeleton", group: GALLERY_GROUPS.lists, width: 720, render: () => <SkeletonDemo /> });

export const GROUP_1_ENTRIES = [
  listsReferenceEntry,
  pillTabsEntry,
  groupBandEntry,
  rowEntry,
  recordRowEntry,
  keyedListEntry,
  sectionEntry,
  pageBodyEntry,
  emptyStateEntry,
  skeletonEntry,
] as const;
