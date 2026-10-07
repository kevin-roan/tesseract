import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Checkbox } from "../../../components/Checkbox";
import { Icon } from "../../../components/Icon";
import { Notice } from "../../../components/Notice";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { SkeletonRows } from "../../../components/Skeleton";
import { StatusBadge } from "../../../components/StatusBadge";
import { cx } from "../../../lib/cx";
import { reveal, rise, stagger, STAGGER_MS } from "../../../theme/motion";
import { CHEVRON_OPEN_DEG, SKELETON_ROWS, VISIBLE_IMAGE_LIMIT } from "../constants";
import { ANDROID_LABELS } from "../labels";
import { formatBytes, selectionState, visibleImages, type PackageRow } from "../model";
import { STATUS_TONES } from "./package-status";
import styles from "./PackageTable.module.css";

export interface PackageTableProps {
  tools: readonly PackageRow[];
  images: readonly PackageRow[];
  selected: ReadonlySet<string>;
  onToggle(path: string, on: boolean): void;
  onToggleAll(on: boolean): void;
  loading: boolean;
  error: string | null;
  onRetry(): void;
  disabled?: boolean;
}

const COLUMNS = ANDROID_LABELS.packages.columns;

function HeaderRow() {
  return (
    <div role="row" className={cx(styles.grid, styles.header)}>
      <span role="columnheader" />
      <span role="columnheader">{COLUMNS.name}</span>
      <span role="columnheader" className={styles.numeric}>
        {COLUMNS.api}
      </span>
      <span role="columnheader">{COLUMNS.abi}</span>
      <span role="columnheader">{COLUMNS.variant}</span>
      <span role="columnheader" className={styles.numeric}>
        {COLUMNS.size}
      </span>
      <span role="columnheader">{COLUMNS.status}</span>
    </div>
  );
}

interface SectionRowProps {
  title: string;
  checked?: boolean | "mixed";
  onToggle?(on: boolean): void;
  disabled?: boolean;
}

function SectionRow({ title, checked, onToggle, disabled }: SectionRowProps) {
  return (
    <div role="row" className={cx(styles.grid, styles.section)}>
      <span role="cell" className={styles.check}>
        {checked !== undefined ? (
          <Checkbox checked={checked} ariaLabel={ANDROID_LABELS.packages.selectAll} disabled={disabled} onChange={onToggle} />
        ) : null}
      </span>
      <span role="cell" className={styles.sectionTitle}>
        {title}
      </span>
    </div>
  );
}

interface PackageLineProps {
  row: PackageRow;
  checked: boolean;
  onToggle(on: boolean): void;
  disabled: boolean;
  index: number;
}

function PackageLine({ row, checked, onToggle, disabled, index }: PackageLineProps) {
  const locked = row.required || row.status === "installed";
  const interactive = !locked && !disabled;
  const status = STATUS_TONES[row.status];
  return (
    <motion.div
      role="row"
      className={cx(styles.grid, styles.row, interactive && styles.interactive)}
      data-selected={checked || undefined}
      variants={rise}
      initial="initial"
      animate="animate"
      transition={stagger(index, STAGGER_MS.rows)}
      onClick={interactive ? () => onToggle(!checked) : undefined}
    >
      <span role="cell" className={styles.check}>
        <Checkbox
          checked={locked ? true : checked}
          disabled={locked || disabled}
          ariaLabel={ANDROID_LABELS.packages.select(row.name)}
          title={row.required ? ANDROID_LABELS.packages.alwaysIncluded : undefined}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
        />
      </span>
      <span role="cell" className={styles.name}>
        <span className={styles.nameText}>{row.name}</span>
        <span className={styles.revision}>{row.revision}</span>
      </span>
      <span role="cell" className={cx(styles.cell, styles.numeric)}>
        {row.api ?? ""}
      </span>
      <span role="cell" className={cx(styles.cell, styles.mono)}>
        {row.abi ?? ""}
      </span>
      <span role="cell" className={styles.cell}>
        {row.variant ?? ""}
      </span>
      <span role="cell" className={cx(styles.cell, styles.numeric)}>
        {formatBytes(row.size)}
      </span>
      <span role="cell" className={styles.status}>
        <StatusBadge label={ANDROID_LABELS.packages.status[row.status]} tone={status} />
      </span>
    </motion.div>
  );
}

export function PackageTable({ tools, images, selected, onToggle, onToggleAll, loading, error, onRetry, disabled = false }: PackageTableProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = visibleImages(images, showAll, selected);
  const hidden = images.length - VISIBLE_IMAGE_LIMIT;
  const ready = tools.length > 0;

  if (error && !ready) {
    return (
      <SettingsGroup
        title={ANDROID_LABELS.packages.title}
        description={ANDROID_LABELS.packages.description}
        actions={<Notice tone="danger" message={ANDROID_LABELS.packages.loadError(error)} actionLabel={ANDROID_LABELS.packages.retry} onAction={onRetry} />}
      />
    );
  }

  return (
    <SettingsGroup title={ANDROID_LABELS.packages.title} description={ANDROID_LABELS.packages.description}>
      <div role="table" aria-label={ANDROID_LABELS.packages.title} aria-busy={loading || undefined} className={styles.table}>
        <HeaderRow />
        {!ready ? (
          <SkeletonRows rows={SKELETON_ROWS} icon={false} label={ANDROID_LABELS.packages.loading} className={styles.skeleton} />
        ) : (
          <>
            <SectionRow title={ANDROID_LABELS.packages.tools} />
            {tools.map((row, index) => (
              <PackageLine key={row.path} row={row} index={index} checked disabled={disabled} onToggle={() => undefined} />
            ))}
            <SectionRow
              title={ANDROID_LABELS.packages.images}
              checked={selectionState(images, selected)}
              disabled={disabled || images.every((row) => row.status === "installed")}
              onToggle={onToggleAll}
            />
            {images.length === 0 ? <p className={styles.empty}>{ANDROID_LABELS.packages.none}</p> : null}
            <AnimatePresence initial={false}>
              {shown.map((row, index) => (
                <motion.div key={row.path} variants={reveal} initial="initial" animate="animate" exit="exit" className={styles.revealRow}>
                  <PackageLine
                    row={row}
                    index={index + tools.length}
                    checked={selected.has(row.path)}
                    disabled={disabled}
                    onToggle={(on) => onToggle(row.path, on)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {hidden > 0 ? (
              <button type="button" className={styles.more} aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
                <motion.span className={styles.moreIcon} animate={{ rotate: showAll ? CHEVRON_OPEN_DEG : 0 }}>
                  <Icon name="expand" />
                </motion.span>
                {showAll ? ANDROID_LABELS.packages.showLess : ANDROID_LABELS.packages.showAll(images.length)}
              </button>
            ) : null}
          </>
        )}
      </div>
    </SettingsGroup>
  );
}
