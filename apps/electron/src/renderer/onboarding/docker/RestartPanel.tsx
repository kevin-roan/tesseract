import { Notice } from "../../components/Notice";
import { restartCopy } from "./model";

export interface RestartPanelProps {
  kind: "relogin" | "reboot";
  subject: string;
}

export function RestartPanel({ kind, subject }: RestartPanelProps) {
  const copy = restartCopy(kind, subject);
  return <Notice tone="info" title={copy.title} message={copy.message} />;
}
