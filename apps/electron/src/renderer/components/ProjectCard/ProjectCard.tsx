import { Icon } from "../Icon";
import { IconBadge } from "../IconBadge";
import { IconButton } from "../IconButton";
import { StatusBadge } from "../StatusBadge";
import { formatLabel } from "../Composer";
import { cx } from "../../lib/cx";
import { PROJECT_CARD_ICONS } from "./constants";
import { PROJECT_CARD_LABELS } from "./labels";
import type { ProjectCardModel } from "./model";
import styles from "./ProjectCard.module.css";

export interface ProjectCardProps {
  model: ProjectCardModel;
  onOpen(id: string): void;
  onAsk?: (id: string) => void;
  className?: string;
}

export function ProjectCard({ model, onOpen, onAsk, className }: ProjectCardProps) {
  const askLabel = formatLabel(PROJECT_CARD_LABELS.ask, { title: model.title });
  return (
    <div className={cx(styles.card, className)} data-project-id={model.id}>
      <button type="button" className={styles.pressable} aria-label={model.title} onClick={() => onOpen(model.id)}>
        <div className={styles.surface}>
          <div className={styles.top}>
            <IconBadge icon={PROJECT_CARD_ICONS.badge} size="card" />
            <span className={styles.titles}>
              <span className={styles.title}>{model.title}</span>
              {model.subtitle ? <span className={styles.subtitle}>{model.subtitle}</span> : null}
            </span>
          </div>
          <div className={styles.badges}>
            {model.confidential ? <StatusBadge icon={PROJECT_CARD_ICONS.confidential} {...model.confidential} /> : null}
            <StatusBadge {...model.activity} />
            {model.branch ? <StatusBadge icon={PROJECT_CARD_ICONS.branch} label={model.branch} /> : null}
            {model.sync ? <StatusBadge icon={PROJECT_CARD_ICONS.sync} label={model.sync} /> : null}
            {model.dirty ? <StatusBadge {...model.dirty} /> : null}
          </div>
          <span className={styles.spacer} />
          {model.commit ? (
            <div className={styles.commit}>
              <Icon name={PROJECT_CARD_ICONS.commit} color="text-tertiary" />
              <span className={styles.commitMessage}>{model.commit}</span>
              {model.commitWhen ? <span className={styles.commitWhen}>{model.commitWhen}</span> : null}
            </div>
          ) : null}
          {model.tags.length > 0 ? (
            <div className={styles.tags}>
              {model.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
      {onAsk ? (
        <IconButton icon={PROJECT_CARD_ICONS.ask} label={askLabel} className={styles.ask} onClick={() => onAsk(model.id)} />
      ) : null}
    </div>
  );
}
