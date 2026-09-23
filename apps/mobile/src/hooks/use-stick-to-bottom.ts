import { useCallback, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const DEFAULT_THRESHOLD = 48;

type Scrollable = { scrollToEnd: (options?: { animated?: boolean }) => void };

/** Keeps a scroll view pinned to its end while the user is already there, and lets go once they scroll up. */
export function useStickToBottom(getScrollable: () => Scrollable | null, threshold: number = DEFAULT_THRESHOLD) {
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);

  const setFollow = useCallback((next: boolean) => {
    if (followingRef.current === next) return;
    followingRef.current = next;
    setFollowing(next);
  }, []);

  const onScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      setFollow(contentSize.height - layoutMeasurement.height - contentOffset.y <= threshold);
    },
    [setFollow, threshold],
  );

  const onContentSizeChange = useCallback(() => {
    if (followingRef.current) getScrollable()?.scrollToEnd({ animated: false });
  }, [getScrollable]);

  const jumpToEnd = useCallback(() => {
    setFollow(true);
    getScrollable()?.scrollToEnd({ animated: true });
  }, [getScrollable, setFollow]);

  return { following, onScroll, onContentSizeChange, jumpToEnd };
}
