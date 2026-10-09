import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import SetupScreen from "@/app/(onboarding)/setup";
import WelcomeScreen from "@/app/(onboarding)/welcome";
import BarStrip from "@/components/bar-strip";
import CellMatrix from "@/components/cell-matrix";
import OnboardingSlide from "@/features/onboarding/components/onboarding-slide";
import PageDots from "@/features/onboarding/components/page-dots";
import SetupStep from "@/features/onboarding/components/setup-step";
import { useOnboardingPager } from "@/features/onboarding/hooks/use-onboarding-pager";
import { useSetupScreen } from "@/features/onboarding/hooks/use-setup-screen";
import { useWelcomeScreen } from "@/features/onboarding/hooks/use-welcome-screen";
import { ONBOARDING_LABELS, ONBOARDING_SLIDES, SETUP_STEPS, formatPage } from "@/features/onboarding/utils/content";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useIsFocused: () => true,
}));

const settle = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 } } }) as NativeSyntheticEvent<NativeScrollEvent>;

beforeEach(() => {
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockRouter.canGoBack.mockReturnValue(true);
});

describe("onboarding content", () => {
  it("has three slides and three setup steps with unique ids", () => {
    expect(ONBOARDING_SLIDES).toHaveLength(3);
    expect(SETUP_STEPS.desktop).toHaveLength(3);
    expect(SETUP_STEPS.cli).toHaveLength(3);
    expect(new Set(ONBOARDING_SLIDES.map((slide) => slide.id)).size).toBe(3);
    expect(SETUP_STEPS.desktop.some((step) => step.command)).toBe(false);
    expect(SETUP_STEPS.cli.filter((step) => step.command).map((step) => step.command)).toEqual([
      "bun run sandbox up",
      "bun run sandbox pair",
    ]);
  });
});

describe("useOnboardingPager", () => {
  it("advances until the last page, then refuses", async () => {
    const { result } = await renderHook(() => useOnboardingPager(3));
    expect(result.current.index).toBe(0);
    expect(result.current.isLast).toBe(false);

    await act(async () => void expect(result.current.next()).toBe(true));
    expect(result.current.index).toBe(1);
    await act(async () => void expect(result.current.next()).toBe(true));
    expect(result.current.isLast).toBe(true);

    let moved = true;
    await act(async () => {
      moved = result.current.next();
    });
    expect(moved).toBe(false);
    expect(result.current.index).toBe(2);
  });

  it("takes the index from where a swipe settles", async () => {
    const { result } = await renderHook(() => useOnboardingPager(3));
    await act(async () => result.current.onSettle(settle(result.current.width * 2)));
    expect(result.current.index).toBe(2);
    expect(result.current.isLast).toBe(true);
  });
});

describe("useWelcomeScreen", () => {
  it("steps through the slides and then opens the setup", async () => {
    const { result } = await renderHook(() => useWelcomeScreen());
    expect(result.current.ctaLabel).toBe(ONBOARDING_LABELS.next);

    await act(async () => result.current.advance());
    await act(async () => result.current.advance());
    expect(result.current.ctaLabel).toBe(ONBOARDING_LABELS.start);
    expect(mockRouter.push).not.toHaveBeenCalled();

    await act(async () => result.current.advance());
    expect(mockRouter.push).toHaveBeenCalledWith("/setup");
  });

  it("skips straight to the setup", async () => {
    const { result } = await renderHook(() => useWelcomeScreen());
    await act(async () => result.current.skip());
    expect(mockRouter.push).toHaveBeenCalledWith("/setup");
  });
});

describe("useSetupScreen", () => {
  it("opens the pair screen", async () => {
    const { result } = await renderHook(() => useSetupScreen());
    expect(result.current.mode).toBe("desktop");
    expect(result.current.steps).toBe(SETUP_STEPS.desktop);
    await act(async () => result.current.setMode("cli"));
    expect(result.current.steps).toBe(SETUP_STEPS.cli);
    result.current.pair();
    expect(mockRouter.push).toHaveBeenCalledWith("/pair");
  });

  it("goes back, or to the welcome page when there is no history", async () => {
    const { result } = await renderHook(() => useSetupScreen());
    result.current.back();
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    result.current.back();
    expect(mockRouter.replace).toHaveBeenCalledWith("/welcome");
  });
});

function SlideHarness() {
  const progress = useSharedValue(0);
  return (
    <>
      <OnboardingSlide slide={ONBOARDING_SLIDES[0]} position={0} progress={progress} width={390} />
      <PageDots count={3} progress={progress} />
    </>
  );
}

function SlideAt({ position }: { position: number }) {
  const progress = useSharedValue(position);
  return <OnboardingSlide slide={ONBOARDING_SLIDES[position]} position={position} progress={progress} width={390} />;
}

describe("onboarding components", () => {
  it("renders a slide with its copy and the page dots", async () => {
    await render(<SlideHarness />);
    const [slide] = ONBOARDING_SLIDES;
    expect(screen.getByTestId(`onboarding-slide-${slide.id}`)).toBeOnTheScreen();
    expect(screen.getByText(slide.title)).toBeOnTheScreen();
    expect(screen.getByText(slide.message)).toBeOnTheScreen();
    expect(screen.getByLabelText("3 pages")).toBeOnTheScreen();
    expect(screen.getByText(formatPage(1, 3))).toBeOnTheScreen();
  });

  it("renders a setup step with its number and command", async () => {
    const [step] = SETUP_STEPS.cli;
    await render(<SetupStep step={step} position={0} />);
    expect(screen.getByTestId(`setup-step-${step.id}`)).toBeOnTheScreen();
    expect(screen.getByText("Step 1")).toBeOnTheScreen();
    expect(screen.getByText(step.title)).toBeOnTheScreen();
    expect(screen.getByText(`$ ${step.command}`)).toBeOnTheScreen();
  });

  it("leaves out the command chip when a step has none", async () => {
    const step = SETUP_STEPS.cli[2];
    await render(<SetupStep step={step} position={2} last />);
    expect(screen.getByText("Step 3")).toBeOnTheScreen();
    expect(screen.queryByText(/^\$ /)).toBeNull();
  });

  it("renders every slide's dashboard panel", async () => {
    for (const [position, slide] of ONBOARDING_SLIDES.entries()) {
      await render(<SlideAt position={position} />);
      const hidden = { includeHiddenElements: true };
      expect(screen.queryByText(slide.panel.title)).toBeNull();
      expect(screen.getByText(slide.panel.title, hidden)).toBeOnTheScreen();
      for (const stat of slide.panel.stats) expect(screen.getByText(stat.value, hidden)).toBeOnTheScreen();
      for (const tick of slide.panel.axis) expect(screen.getByText(tick, hidden)).toBeOnTheScreen();
    }
  });

  it("hides slides that are not current from accessibility", async () => {
    const progress = { value: 0 } as SharedValue<number>;
    await render(<OnboardingSlide slide={ONBOARDING_SLIDES[1]} position={1} progress={progress} width={390} active={false} />);
    expect(screen.queryByText(ONBOARDING_SLIDES[1].title)).toBeNull();
    expect(screen.getByText(ONBOARDING_SLIDES[1].title, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("renders the matrix and bar visuals", async () => {
    const { toJSON } = await render(
      <>
        <CellMatrix levels={[[0, 1], [2, 3]]} live={[[1, 1]]} shape="dot" />
        <BarStrip values={[0.2, 0.8, 0.5]} emphasis={0.5} stream />
      </>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("formats the page counter", () => {
    expect(formatPage(1, 3)).toBe("01 / 03");
  });
});

describe("onboarding screens", () => {
  it("walks the welcome pager to the setup", async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByTestId("onboarding-welcome")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("onboarding-skip"));
    expect(mockRouter.push).toHaveBeenCalledWith("/setup");
    mockRouter.push.mockClear();

    await fireEvent.press(screen.getByTestId("onboarding-next"));
    await fireEvent.press(screen.getByTestId("onboarding-next"));
    expect(screen.getByText(ONBOARDING_LABELS.start)).toBeOnTheScreen();
    expect(screen.queryByTestId("onboarding-skip")).toBeNull();
    await fireEvent.press(screen.getByTestId("onboarding-next"));
    expect(mockRouter.push).toHaveBeenCalledWith("/setup");
  });

  it("lists the setup steps and opens pairing", async () => {
    await render(<SetupScreen />);
    expect(screen.getByTestId("onboarding-setup")).toBeOnTheScreen();
    for (const step of SETUP_STEPS.desktop) expect(screen.getByTestId(`setup-step-${step.id}`)).toBeOnTheScreen();
    expect(screen.queryByText(/^\$ /)).toBeNull();

    await fireEvent.press(screen.getByLabelText("CLI only"));
    for (const step of SETUP_STEPS.cli) expect(screen.getByTestId(`setup-step-${step.id}`)).toBeOnTheScreen();
    expect(screen.getByText("$ bun run sandbox up")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("onboarding-pair"));
    expect(mockRouter.push).toHaveBeenCalledWith("/pair");
  });
});
