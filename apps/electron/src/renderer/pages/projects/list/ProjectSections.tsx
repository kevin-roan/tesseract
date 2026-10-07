import { ProjectGrid } from "../../../components/ProjectCard";
import { Text } from "../../../components/Text";
import type { CardGroup } from "../../../features/projects/types";
import styles from "./ProjectsList.module.css";

export interface ProjectSectionsProps {
  groups: readonly CardGroup[];
  showHeadings: boolean;
  onOpen(id: string): void;
  onAsk(id: string): void;
}

export function ProjectSections({ groups, showHeadings, onOpen, onAsk }: ProjectSectionsProps) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.id} className={styles.section} aria-label={group.title}>
          {showHeadings ? (
            <div className={styles.sectionHeading}>
              <Text variant="label">{group.title}</Text>
              <Text variant="label" color="text-tertiary">
                {String(group.cards.length)}
              </Text>
            </div>
          ) : null}
          <ProjectGrid items={group.cards} onOpen={onOpen} onAsk={onAsk} />
        </section>
      ))}
    </>
  );
}
