import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

const coverOf = (screenY: number) => Math.max(Dimensions.get('window').height - screenY, 0);

// Where the keyboard is heading, tracked app-wide. Keyboard.metrics() keeps the old frame until keyboardDidHide,
// so a sheet opening while the keyboard hides would otherwise start lifted above a keyboard that is gone.
let currentCover = 0;
if (Platform.OS === 'ios') {
  Keyboard.addListener('keyboardWillChangeFrame', (event) => {
    currentCover = coverOf(event.endCoordinates.screenY);
  });
  Keyboard.addListener('keyboardWillHide', () => {
    currentCover = 0;
  });
}

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
      apply(coverOf(event.endCoordinates.screenY), event),
    );
    const hide = Keyboard.addListener('keyboardWillHide', (event) => apply(0, event));
    // An autofocused field can raise the keyboard before these listeners exist (a sheet opening), so start from its current frame.
    setHeight(currentCover);

    return () => {
      change.remove();
      hide.remove();
    };
  }, [active]);

  return height;
}
