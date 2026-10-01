import {
  CubeIcon,
  QrCodeIcon,
  RobotIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  type Icon,
} from "phosphor-react-native";

export type OnboardingSlide = {
  id: string;
  icon: Icon;
  eyebrow: string;
  title: string;
  message: string;
};

export type SetupStep = {
  id: string;
  icon: Icon;
  title: string;
  message: string;
  command?: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "sandbox",
    icon: CubeIcon,
    eyebrow: "Welcome to Monolith",
    title: "Your dev machine, in your pocket",
    message: "A full development sandbox runs on your own hardware. Follow projects, builds and processes from your phone.",
  },
  {
    id: "claude",
    icon: RobotIcon,
    eyebrow: "Autonomous",
    title: "Claude does the work",
    message: "Start Claude runs and watch them stream live. Open a terminal or the sandbox display whenever you want a closer look.",
  },
  {
    id: "private",
    icon: ShieldCheckIcon,
    eyebrow: "Private by default",
    title: "Only over your tailnet",
    message: "The app talks to your sandbox over Tailscale and nothing else. No cloud account, no relay in between.",
  },
];

export const SETUP_STEPS: SetupStep[] = [
  {
    id: "start",
    icon: CubeIcon,
    title: "Start the sandbox",
    message: "On the host, from the Monolith repository.",
    command: "bun run sandbox up",
  },
  {
    id: "code",
    icon: TerminalWindowIcon,
    title: "Show the pairing code",
    message: "It prints a QR code and a theone://pair link. Inside the sandbox, run theone-controller pair.",
    command: "bun run sandbox pair",
  },
  {
    id: "scan",
    icon: QrCodeIcon,
    title: "Scan it with this phone",
    message: "Your phone must be on the same tailnet. You can also enter the URL and token by hand.",
  },
];

export const ONBOARDING_LABELS = {
  brand: "Monolith",
  skip: "Skip",
  next: "Next",
  start: "Get started",
  setupTitle: "Pair your sandbox",
  setupSubtitle: "Three steps, about a minute",
  scan: "Scan pairing code",
  footnote: "The token gives full control of the sandbox. Only pair with one you run yourself.",
} as const;
