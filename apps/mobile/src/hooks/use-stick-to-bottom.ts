import { useCallback, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const DEFAULT_THRESHOLD = 48;

type Scrollable = { scrollToEnd: (options?: { animated?: boolean }) => void };
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * Keeps a scroll view pinned to its end while the user is already there, and lets go once they scroll up.
 * Never scrolls while a finger or a fling is moving the list: snapping to the end mid-drag would undo the gesture.
 */
export function useStickToBottom(getScrollable: () => Scrollable | null, threshold: number = DEFAULT_THRESHOLD) {
  const followingRef = useRef(true);
  const touchingRef = useRef(false);
  const flingingRef = useRef(false);
  const [following, setFollowing] = useState(true);

  const setFollow = useCallback((next: boolean) => {
    if (followingRef.current === next) return;
    followingRef.current = next;
    setFollowing(next);
  }, []);

  const followFrom = useCallback(
    ({ nativeEvent }: ScrollEvent) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      setFollow(contentSize.height - layoutMeasurement.height - contentOffset.y <= threshold);
    },
    [setFollow, threshold],
  );

  const onScroll = useCallback(
    (event: ScrollEvent) => {
      // Scrolls the user didn't make (content growing, scrollToEnd) can't decide whether to follow.
      if (touchingRef.current || flingingRef.current) followFrom(event);
    },
    [followFrom],
  );

  const onScrollBeginDrag = useCallback(() => {
    touchingRef.current = true;
  }, []);

  const onScrollEndDrag = useCallback(
    (event: ScrollEvent) => {
      touchingRef.current = false;
      followFrom(event);
    },
    [followFrom],
  );

  const onMomentumScrollBegin = useCallback(() => {
    flingingRef.current = true;
  }, []);

  const onMomentumScrollEnd = useCallback(
    (event: ScrollEvent) => {
      flingingRef.current = false;
      followFrom(event);
    },
    [followFrom],
  );

  const onContentSizeChange = useCallback(() => {
    if (followingRef.current && !touchingRef.current && !flingingRef.current) {
      getScrollable()?.scrollToEnd({ animated: false });
    }
  }, [getScrollable]);

  const jumpToEnd = useCallback(() => {
    setFollow(true);
    getScrollable()?.scrollToEnd({ animated: true });
  }, [getScrollable, setFollow]);

  const scrollProps = useMemo(
    () => ({ onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd, onContentSizeChange }),
    [onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd, onContentSizeChange],
  );

  return { following, scrollProps, jumpToEnd };
}
