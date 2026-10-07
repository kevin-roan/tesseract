import { DotSphere } from "../../../components/DotSphere";
import { AGENT_SPHERE_DOTS, AGENT_SPHERE_SIZE } from "./constants";
import styles from "./RunTimeline.module.css";

export interface AgentAvatarProps {
  working?: boolean;
}

export function AgentAvatar({ working = false }: AgentAvatarProps) {
  return (
    <span className={styles.agentAvatar} aria-hidden data-working={working || undefined}>
      <DotSphere size={AGENT_SPHERE_SIZE} dots={AGENT_SPHERE_DOTS} color="text-on-accent" spinning={working} />
    </span>
  );
}
