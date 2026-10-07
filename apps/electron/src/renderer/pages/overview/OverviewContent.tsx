import { AnimatePresence, motion } from "motion/react";
import { KeyValueList } from "../../components/KeyValueList";
import { Notice } from "../../components/Notice";
import { OVERVIEW_GAP, PageBody } from "../../components/PageBody";
import { Section } from "../../components/Section";
import type { OverviewModel } from "../../features/overview/hooks/use-overview";
import { OVERVIEW_LABELS, SECTION_LABELS } from "../../features/overview/labels";
import { reveal } from "../../theme/motion";
import { ActivityList } from "./ActivityList";
import { OverviewHeader } from "./OverviewHeader";
import { ResourceGrid } from "./ResourceGrid";
import { ResourceHistory } from "./ResourceHistory";
import styles from "./Overview.module.css";

export interface OverviewContentProps {
  overview: OverviewModel;
  content: NonNullable<OverviewModel["content"]>;
}

export function OverviewContent({ overview, content }: OverviewContentProps) {
  const { notice } = overview;
  return (
    <PageBody gap={OVERVIEW_GAP} label={OVERVIEW_LABELS.title}>
      <OverviewHeader title={overview.title} meta={overview.meta} badge={overview.badge} onRefresh={overview.refresh} />
      <AnimatePresence initial={false}>
        {notice ? (
          <motion.div key="attention" className={styles.notice} variants={reveal} initial="initial" animate="animate" exit="exit">
            <Notice title={notice.title} message={notice.message} tone={notice.tone} actionLabel={notice.actionLabel} onAction={overview.openInbox} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Section title={SECTION_LABELS.resources} variant="overview" className={styles.section}>
        <ResourceGrid items={content.resources} />
      </Section>
      <ResourceHistory />
      <div className={styles.columns}>
        <Section title={SECTION_LABELS.activity} variant="overview" className={styles.section}>
          <ActivityList items={content.activity} onOpen={overview.openTarget} label={SECTION_LABELS.activity} />
        </Section>
        <Section title={SECTION_LABELS.display} variant="overview" className={styles.section}>
          <KeyValueList rows={content.display} flat />
        </Section>
      </div>
      <Section title={SECTION_LABELS.tools} variant="overview" className={styles.section} empty={content.tools.length === 0} emptyLabel={SECTION_LABELS.toolsEmpty}>
        <KeyValueList rows={content.tools} monospace flat />
      </Section>
    </PageBody>
  );
}
