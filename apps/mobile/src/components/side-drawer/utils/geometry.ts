export const DRAWER_WIDTH_RATIO = 0.86;
export const DRAWER_MAX_WIDTH = 400;
export const DRAWER_CLOSE_PROGRESS = 0.6;
export const DRAWER_CLOSE_VELOCITY = 600;
export const DRAWER_PAN_SLOP = 12;

export function drawerWidth(windowWidth: number): number {
  return Math.min(Math.round(windowWidth * DRAWER_WIDTH_RATIO), DRAWER_MAX_WIDTH);
}

export function dragProgress(translationX: number, width: number): number {
  "worklet";
  if (width <= 0) return 1;
  return Math.min(1, Math.max(0, 1 + translationX / width));
}

export function shouldCloseDrawer(progress: number, velocityX: number): boolean {
  "worklet";
  return velocityX < -DRAWER_CLOSE_VELOCITY || (progress < DRAWER_CLOSE_PROGRESS && velocityX <= DRAWER_CLOSE_VELOCITY);
}
