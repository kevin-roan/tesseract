import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

/**
 * How far the iOS keyboard covers the bottom of the window, animated in step with it; 0 elsewhere.
 * Reads the keyboard's own frame instead of measuring the screen, so it stays right
 * inside nested navigators where KeyboardAvoidingView over-pads.
 */
export function useKeyboardHeight(enabled = true): number {
  const [height, setHeight] = useState(0);
  const active = enabled && Platform.OS === 'ios';

  useEffect(() => {
    if (!active) {
      setHeight(0);
      return;
    }

    const apply = (next: number, event: KeyboardEvent) => {
      if (event.duration) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { duration: event.duration, type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next);
    };
    const change = Keyboard.addListener('keyboardWillChangeFrame', (event) =>
      apply(Math.max(Dimensions.get('window').height - event.endCoordinates.screenY, 0), event),
    );
    const hide = Keyboard.addListener('keyboardWillHide', (event) => apply(0, event));

    return () => {
      change.remove();
      hide.remove();
    };
  }, [active]);

  return height;
}
