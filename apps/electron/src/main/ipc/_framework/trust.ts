import type { IpcMainInvokeEvent } from "electron";
import { ENV } from "../../../shared/runtime";
import { isInternalUrl } from "../../app/security";

export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  return url ? isInternalUrl(url, process.env[ENV.rendererUrl]) : false;
}
