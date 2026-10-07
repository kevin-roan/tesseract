import { motion } from "motion/react";
import { cx } from "../../lib/cx";
import { rise } from "../../theme/motion";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { Spinner } from "../Spinner";
import { Tooltip } from "../Tooltip";
import { ATTACHMENT_EXIT, ATTACHMENT_KIND_ICONS, ATTACHMENT_NAME_CHARS } from "./constants";
import { COMPOSER_LABELS, formatLabel } from "./labels";
import { middleEllipsis } from "./model";
import styles from "./Attachment.module.css";

export type AttachmentKind = keyof typeof ATTACHMENT_KIND_ICONS;
export type AttachmentStatus = "uploading" | "ready" | "error";

export interface AttachmentChipProps {
  name: string;
  kind: AttachmentKind;
  meta?: string | null;
  status?: AttachmentStatus;
  error?: string | null;
  thumbnailUrl?: string | null;
  large?: boolean;
  onRemove?: () => void;
  onRetry?: () => void;
}

export function AttachmentChip({ name, kind, meta, status = "ready", error, thumbnailUrl, large = false, onRemove, onRetry }: AttachmentChipProps) {
  const failed = status === "error";
  const tooltip = failed && error ? `${name}. ${error}` : meta ? `${name} · ${meta}` : name;
  const removeLabel = formatLabel(COMPOSER_LABELS.remove, { name });
  const retryLabel = formatLabel(COMPOSER_LABELS.retry, { name });
  const statusNode =
    status === "uploading" ? (
      <Spinner size={16} className={styles.status} />
    ) : failed && onRetry ? (
      <IconButton icon="refresh" label={retryLabel} size={22} variant="round" className={cx(styles.action, styles.retry)} onClick={onRetry} />
    ) : null;

  if (kind === "image" && thumbnailUrl) {
    return (
      <Tooltip label={tooltip} placement="top">
        <motion.div
          layout
          className={cx(styles.chip, styles.thumb, large && styles.large, failed && styles.failed)}
          aria-label={name}
          variants={rise}
          initial="initial"
          animate="animate"
          exit={ATTACHMENT_EXIT}
        >
          <img src={thumbnailUrl} alt="" className={styles.image} draggable={false} />
          {statusNode ? <span className={styles.overlay}>{statusNode}</span> : null}
          {onRemove ? (
            <IconButton icon="close" label={removeLabel} size={22} variant="round" className={cx(styles.action, styles.floating)} onClick={onRemove} />
          ) : null}
        </motion.div>
      </Tooltip>
    );
  }

  const caption = failed && error ? error : meta;
  return (
    <Tooltip label={tooltip} placement="top">
      <motion.div
        layout
        className={cx(styles.chip, styles.pill, failed && styles.failed)}
        aria-label={name}
        variants={rise}
        initial="initial"
        animate="animate"
        exit={ATTACHMENT_EXIT}
      >
        <span className={styles.tile}>
          <Icon name={ATTACHMENT_KIND_ICONS[kind]} />
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{middleEllipsis(name, ATTACHMENT_NAME_CHARS)}</span>
          {caption ? <span className={cx(styles.meta, failed && error && styles.metaError)}>{caption}</span> : null}
        </span>
        {statusNode}
        {onRemove ? <IconButton icon="close" label={removeLabel} size={22} variant="round" className={styles.action} onClick={onRemove} /> : null}
      </motion.div>
    </Tooltip>
  );
}
