import { cx } from "../../lib/cx";
import { Text } from "../Text";
import { Tooltip } from "../Tooltip";
import { AVATAR_SIZE, type AvatarSize } from "./constants";
import { initialsOf } from "./initials";
import { useImageStatus } from "./use-image-status";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  name: string;
  size?: AvatarSize | number;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, size = "md", src, className }: AvatarProps) {
  const pixels = typeof size === "number" ? size : AVATAR_SIZE[size];
  const image = useImageStatus(src);
  const showImage = src && image.status !== "failed";
  return (
    <Tooltip label={name}>
      <span className={cx(styles.avatar, className)} style={{ width: pixels, height: pixels }} role="img" aria-label={name}>
        <Text variant="caption" color="text-secondary" center className={styles.initials}>
          {initialsOf(name)}
        </Text>
        {showImage ? (
          <img
            className={cx(styles.image, image.status === "loaded" && styles.loaded)}
            src={src}
            alt=""
            draggable={false}
            onLoad={image.onLoad}
            onError={image.onError}
          />
        ) : null}
      </span>
    </Tooltip>
  );
}
