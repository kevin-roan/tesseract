import { TICKET_QUERY_PARAM } from "./config";

export function webSocketUrl(path: string, ticket: string): string {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}${path}?${TICKET_QUERY_PARAM}=${encodeURIComponent(ticket)}`;
}
