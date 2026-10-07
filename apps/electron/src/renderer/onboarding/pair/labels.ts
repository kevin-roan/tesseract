import { PAIR_LABELS } from "../../components/PairDialog";

export const PAIR_STEP_LABELS = {
  description:
    "Install the TheOne app and Tailscale on your phone, then scan this code in the app (Agents › Pair a sandbox).",
  instructions: PAIR_LABELS.instructions,
  caption: PAIR_LABELS.sandbox,
  copy: PAIR_LABELS.copy,
  copied: PAIR_LABELS.copied,
  secret: PAIR_LABELS.secret,
  invalid: PAIR_LABELS.invalid,
  retry: PAIR_LABELS.retry,
  loading: "Reading the pairing link…",
  qr: "Pairing QR code",
  localTitle: "Your phone can't reach this sandbox",
  localMessage: "It only listens on 127.0.0.1. Switch to Tailscale to use it from your phone.",
  changeReachability: "Change reachability",
} as const;
