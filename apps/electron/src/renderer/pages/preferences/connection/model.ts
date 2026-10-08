import { normalizeBaseUrl } from "@tesseract/protocol";
import type { ConnectionConfig, ConnectionInput } from "../../../../shared/contracts/connection";
import { CONNECTION_LABELS, CONNECTION_STATUS_LABELS, CONNECTION_TONES, SOURCE_LABELS, sandboxName, type ConnectionState } from "../../../app/connection";
import type { Tone } from "../../../theme/colors";
import { SECTION_LABELS } from "./labels";

export interface ConnectionForm {
  apiUrl: string;
  token: string;
  name: string;
  pairingUrl: string;
}

export const EMPTY_FORM: ConnectionForm = { apiUrl: "", token: "", name: "", pairingUrl: "" };

export function formFromConfig(config: ConnectionConfig | null | undefined): ConnectionForm {
  if (!config) return EMPTY_FORM;
  return { apiUrl: config.apiUrl, token: config.token, name: config.name ?? "", pairingUrl: config.pairingUrl ?? "" };
}

export function readConnectionForm(form: ConnectionForm): ConnectionInput | null {
  const apiUrl = normalizeBaseUrl(form.apiUrl);
  const token = form.token.trim();
  if (!apiUrl || !token) return null;
  const pairing = form.pairingUrl.trim();
  const pairingUrl = pairing ? normalizeBaseUrl(pairing) : null;
  if (pairing && !pairingUrl) return null;
  return { apiUrl, token, name: form.name.trim() || null, pairingUrl };
}

export interface ConnectionStatusRows {
  badge: { label: string; tone: Tone };
  statusSubtitle: string;
  sourceTitle: string;
  sourceSubtitle: string;
  discovering: boolean;
}

export function connectionStatusRows(state: Pick<ConnectionState, "status" | "errorMessage" | "health" | "config" | "configFile">): ConnectionStatusRows {
  const source = state.config ? SOURCE_LABELS[state.config.source] : null;
  return {
    badge: { label: CONNECTION_STATUS_LABELS[state.status], tone: CONNECTION_TONES[state.status] },
    statusSubtitle: state.errorMessage || sandboxName(state) || "",
    sourceTitle: source ? CONNECTION_LABELS.sourceTitle(source) : SECTION_LABELS.source,
    sourceSubtitle: state.configFile ? CONNECTION_LABELS.configFile(state.configFile) : "",
    discovering: state.status === "discovering",
  };
}
