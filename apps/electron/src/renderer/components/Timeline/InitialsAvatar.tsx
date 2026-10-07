import { initialsOf } from "./initials";
import styles from "./Timeline.module.css";

export interface InitialsAvatarProps {
  name: string;
  image?: string;
}

export function InitialsAvatar({ name, image }: InitialsAvatarProps) {
  return (
    <span className={styles.initials} aria-hidden>
      {image ? <img className={styles.initialsImage} src={image} alt="" /> : initialsOf(name)}
    </span>
  );
}
