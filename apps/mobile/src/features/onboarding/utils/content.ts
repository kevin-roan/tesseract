import {
  CubeIcon,
  QrCodeIcon,
  RobotIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
  type Icon,
} from "phosphor-react-native";

import type { MatrixCell } from "@/components/cell-matrix";

export type MatrixPattern = {
  levels: number[][];
  live: MatrixCell[];
};

export type PanelStat = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  trend?: "up" | "down";
};

export type PanelChart =
  | ({ kind: "matrix"; shape: "dot" | "square" } & MatrixPattern)
  | { kind: "bars"; values: number[]; emphasis: number; stream: boolean };

export type PanelLegend = {
  start: string;
  end: string;
  levels: number[][];
};

export type OnboardingPanel = {
  title: string;
  chip: string;
  caret: boolean;
  stats: PanelStat[];
  chart: PanelChart;
  axis: string[];
  legend?: PanelLegend;
};

export type OnboardingSlide = {
  id: string;
  icon: Icon;
  eyebrow: string;
  title: string;
  message: string;
  panel: OnboardingPanel;
};

export type SetupStep = {
  id: string;
  icon: Icon;
  title: string;
  message: string;
  command?: string;
};

export type SetupStat = { id: string; label: string; value: string };

export type SetupSegment = { id: string; label: string; active: boolean };

export type SetupSummary = { title: string; chip: string; stats: SetupStat[]; segments: SetupSegment[] };

export const MATRIX_MAX_LEVEL = 3;

const LIVE = "*";

function grid(rows: string[]): MatrixPattern {
  const live: MatrixCell[] = [];
  const levels = rows.map((row, r) =>
    [...row].map((cell, c) => {
      if (cell !== LIVE) return Number(cell);
      live.push([r, c]);
      return MATRIX_MAX_LEVEL;
    }),
  );
  return { levels, live };
}

function columns(heights: string, rows: number): MatrixPattern {
  const tops = [...heights].map(Number);
  const levels = Array.from({ length: rows }, (_, r) =>
    tops.map((top) => {
      const fromBottom = rows - r;
      if (fromBottom > top) return 0;
      return fromBottom === top ? MATRIX_MAX_LEVEL : MATRIX_MAX_LEVEL - 1;
    }),
  );
  const last = tops.length - 1;
  return { levels, live: [[rows - tops[last], last]] };
}

const bars = (digits: string) => [...digits].map((digit) => (Number(digit) + 1) / 10);

export const BRAND_MARK = grid(["30", "13"]);

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "sandbox",
    icon: CubeIcon,
    eyebrow: "Welcome to Monolith",
    title: "Your dev machine, in your pocket",
    message: "A full sandbox runs on your own hardware. Follow projects, builds and processes from your phone.",
    panel: {
      title: "Machine",
      chip: "1H",
      caret: true,
      stats: [
        { label: "cpu", value: "12", unit: "%" },
        { label: "mem", value: "3.1", unit: "GB" },
        { label: "procs", value: "48" },
      ],
      chart: { kind: "matrix", shape: "dot", ...columns("23434565432345434323", 7) },
      axis: ["-60m", "-45m", "-30m", "-15m", "now"],
    },
  },
  {
    id: "claude",
    icon: RobotIcon,
    eyebrow: "Autonomous",
    title: "Claude does the work",
    message: "Start runs and watch them stream live. Open a terminal or the display whenever you want a closer look.",
    panel: {
      title: "Run #0142",
      chip: "Live",
      caret: false,
      stats: [
        { label: "output", value: "3,585", unit: "tok", delta: "↑ 25.50%", trend: "up" },
        { label: "tests", value: "48", unit: "/ 48" },
      ],
      chart: {
        kind: "bars",
        values: bars(
          "372581649273815627493816253749182736451928374615293847561928374651293847561029384756192837465538",
        ),
        emphasis: 0.7,
        stream: true,
      },
      axis: ["-60s", "-40s", "-20s", "now"],
    },
  },
  {
    id: "private",
    icon: ShieldCheckIcon,
    eyebrow: "Private by default",
    title: "Only over your tailnet",
    message: "The app talks to your sandbox over Tailscale and nothing else. No cloud account, no relay in between.",
    panel: {
      title: "Tailnet",
      chip: "7D",
      caret: true,
      stats: [
        { label: "path", value: "100", unit: "% tailnet" },
        { label: "relays", value: "0" },
      ],
      chart: {
        kind: "matrix",
        shape: "square",
        ...grid([
          "012100023101203210",
          "122301213201231*10",
          "23101232*123102312",
          "102321031230213021",
          "3210201230123*0130",
          "012312301231023102",
        ]),
      },
      axis: ["00", "06", "12", "18", "24"],
      legend: { start: "less", end: "more", levels: [[0, 1, 2, 3]] },
    },
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

export const formatPageCount = (count: number) => `${count} pages`;

export const formatPage = (page: number, count: number) =>
  `${String(page).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;

export const SETUP_LABELS = {
  summary: "Setup",
  duration: "~1 min",
  steps: "Steps",
  commands: "Commands",
  network: "Network",
  tailnet: "Tailnet",
  host: "Host",
  phone: "This phone",
  copy: "Copy command",
  copied: "Copied",
} as const;

export const SLIDE_PARALLAX = { hero: 0.3, copy: 0.15 } as const;

export function stepIndex(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export function stepLabel(position: number): string {
  return `Step ${position + 1}`;
}

export function commandLine(command: string): string {
  return `$ ${command}`;
}

export function setupSummary(steps: SetupStep[]): SetupSummary {
  return {
    title: SETUP_LABELS.summary,
    chip: SETUP_LABELS.duration,
    stats: [
      { id: "steps", label: SETUP_LABELS.steps, value: String(steps.length) },
      { id: "commands", label: SETUP_LABELS.commands, value: String(steps.filter((step) => step.command).length) },
      { id: "network", label: SETUP_LABELS.network, value: SETUP_LABELS.tailnet },
    ],
    segments: steps.map((step) => ({
      id: step.id,
      label: step.command ? SETUP_LABELS.host : SETUP_LABELS.phone,
      active: !step.command,
    })),
  };
}
