import type { ServerWebSocket, WebSocketHandler } from "bun";
import {
  isFinalAgentRunState,
  LIMITS,
  parseJsonWith,
  PROTOCOL_VERSION,
  TerminalClientMessageSchema,
  type AgentStreamMessage,
  type LogStreamMessage,
  type ServerEvent,
  type TerminalServerMessage,
} from "@theone/protocol";
import type { Services } from "../services";
import { EVENTS_TOPIC, type WsData } from "./types";

type Socket = ServerWebSocket<WsData>;
type OutgoingMessage = ServerEvent | TerminalServerMessage | LogStreamMessage | AgentStreamMessage;

const MAX_CLIENT_MESSAGE_BYTES = 1024 * 1024;
export const DEFAULT_WS_BACKPRESSURE_LIMIT_BYTES = 16 * 1024 * 1024;
const NORMAL_CLOSURE = 1000;
const INTERNAL_ERROR = 1011;

const send = (ws: Socket, message: OutgoingMessage) => ws.send(JSON.stringify(message));

function openEvents(ws: Socket, services: Services): void {
  ws.subscribe(EVENTS_TOPIC);
  send(ws, { type: "hello", protocolVersion: PROTOCOL_VERSION, sandboxId: services.config.sandboxId });
}

function openTerminal(ws: Socket, services: Services, id: string): void {
  ws.data.cleanup = services.terminals.attach(id, {
    send: (message) => send(ws, message),
    close: () => ws.close(NORMAL_CLOSURE, "terminal exited"),
  });
}

function openProcessLogs(ws: Socket, services: Services, id: string): void {
  const info = services.processes.get(id);
  const channel = services.logs.get(id);
  if (channel && !channel.ended) {
    for (const line of channel.tail(LIMITS.logReplayLines)) send(ws, { type: "log", line });
    ws.data.cleanup = channel.subscribe((event) => {
      if (event.type === "line") send(ws, { type: "log", line: event.line });
      else {
        send(ws, { type: "exit", code: event.code });
        ws.close(NORMAL_CLOSURE, "process ended");
      }
    });
    return;
  }
  for (const line of services.logs.tail(id, LIMITS.logReplayLines)) send(ws, { type: "log", line });
  send(ws, { type: "exit", code: info.exitCode });
  ws.close(NORMAL_CLOSURE, "process ended");
}

function openBuildLogs(ws: Socket, services: Services, id: string): void {
  const build = services.builds.get(id);
  send(ws, { type: "build", build });
  const channel = services.logs.get(id);
  if (channel && !channel.ended) {
    for (const line of channel.tail(LIMITS.logReplayLines)) send(ws, { type: "log", line });
    const offHub = services.hub.subscribe((event) => {
      if (event.type === "build.updated" && event.build.id === id) send(ws, { type: "build", build: event.build });
    });
    const offChannel = channel.subscribe((event) => {
      if (event.type === "line") send(ws, { type: "log", line: event.line });
      else {
        send(ws, { type: "exit", code: event.code });
        ws.close(NORMAL_CLOSURE, "build ended");
      }
    });
    ws.data.cleanup = () => {
      offHub();
      offChannel();
    };
    return;
  }
  for (const line of services.logs.tail(id, LIMITS.logReplayLines)) send(ws, { type: "log", line });
  send(ws, { type: "exit", code: build.state === "succeeded" ? 0 : null });
  ws.close(NORMAL_CLOSURE, "build ended");
}

function openAgentRun(ws: Socket, services: Services, id: string): void {
  const { run, unsubscribe } = services.agentRuns.follow(id, (event) => send(ws, { type: "event", event }));
  send(ws, { type: "run", run });
  if (isFinalAgentRunState(run.state)) {
    unsubscribe();
    ws.close(NORMAL_CLOSURE, "run ended");
    return;
  }
  const offHub = services.hub.subscribe((event) => {
    if (event.type !== "agent.updated" || event.run.id !== id) return;
    send(ws, { type: "run", run: event.run });
    if (isFinalAgentRunState(event.run.state)) ws.close(NORMAL_CLOSURE, "run ended");
  });
  ws.data.cleanup = () => {
    unsubscribe();
    offHub();
  };
}

export function createWebSocketHandler(
  services: Services,
  backpressureLimit = DEFAULT_WS_BACKPRESSURE_LIMIT_BYTES,
): WebSocketHandler<WsData> {
  const logger = services.logger.child("ws");
  return {
    maxPayloadLength: MAX_CLIENT_MESSAGE_BYTES,
    // Past the limit Bun otherwise drops frames silently, corrupting terminals and log streams;
    // closing makes the client reconnect and replay instead.
    backpressureLimit,
    closeOnBackpressureLimit: true,
    perMessageDeflate: false,
    sendPings: true,
    open(ws) {
      const data = ws.data;
      try {
        switch (data.kind) {
          case "events":
            return openEvents(ws, services);
          case "terminal":
            return openTerminal(ws, services, data.id);
          case "processLogs":
            return openProcessLogs(ws, services, data.id);
          case "buildLogs":
            return openBuildLogs(ws, services, data.id);
          case "agentRun":
            return openAgentRun(ws, services, data.id);
          case "vnc":
            return data.bridge.attach({
              send: (chunk) => ws.send(chunk),
              close: (code, reason) => ws.close(code, reason),
            });
        }
      } catch (error) {
        logger.warn("websocket open failed", { kind: data.kind, error });
        ws.close(INTERNAL_ERROR, "stream unavailable");
      }
    },
    message(ws, message) {
      const data = ws.data;
      if (data.kind === "vnc") {
        data.bridge.fromClient(message);
        return;
      }
      if (data.kind !== "terminal" || typeof message !== "string") return;
      const parsed = parseJsonWith(TerminalClientMessageSchema, message);
      if (!parsed.ok) {
        logger.debug("ignored terminal message", { id: data.id, reason: parsed.error.message });
        return;
      }
      if (parsed.value.type === "input") services.terminals.write(data.id, parsed.value.data);
      else services.terminals.resize(data.id, parsed.value.cols, parsed.value.rows);
    },
    drain(ws) {
      if (ws.data.kind === "vnc") ws.data.bridge.clientDrained();
    },
    close(ws) {
      const data = ws.data;
      data.cleanup?.();
      data.cleanup = null;
      if (data.kind === "vnc") data.bridge.clientClosed();
    },
  };
}
