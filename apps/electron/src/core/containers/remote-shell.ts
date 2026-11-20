import type { TerminalConnection, TesseractClient } from "@tesseract/client";
import type { CreateHostTerminal } from "@tesseract/protocol";
import { IpcError } from "../../shared/ipc-types";
import { SHELL } from "./constants";
import { CONTAINERS_MESSAGES } from "./labels";
import { clampGrid, type ShellGrid, type ShellSink } from "./shell";
import { validName } from "./validate";

/** The linked host shell of the active Tesseract server (`HostShellService.withSession`). */
export interface RemoteShellHost {
  withSession<T>(call: (client: TesseractClient) => Promise<T>): Promise<T>;
}

interface RemoteShell {
  client: TesseractClient;
  terminalId: string;
  connection: TerminalConnection;
}

/** Container shells on the server: a host terminal running `docker exec` into `tesseract-ct-<name>`. */
export class RemoteContainerShells {
  private readonly sessions = new Map<string, RemoteShell>();

  constructor(private readonly host: () => RemoteShellHost) {}

  async open(id: string, name: string, grid: ShellGrid, sink: ShellSink): Promise<void> {
    if (!SHELL.idPattern.test(id) || this.sessions.has(id)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidShell);
    const request: CreateHostTerminal = { kind: "shell", container: validName(name), ...clampGrid(grid) };
    const { client, terminalId } = await this.host().withSession(async (client) => ({ client, terminalId: (await client.createTerminal(request)).id }));
    let done = false;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      this.sessions.delete(id);
      sink.exit(code);
    };
    const connection = client.openTerminal(terminalId, {
      onOutput: (data) => sink.data(data),
      onExit: finish,
      onClose: () => finish(null),
    });
    this.sessions.set(id, { client, terminalId, connection });
  }

  write(id: string, data: string): void {
    if (typeof data === "string") this.sessions.get(id)?.connection.send(data);
  }

  resize(id: string, grid: ShellGrid): Promise<void> {
    const { cols, rows } = clampGrid(grid);
    this.sessions.get(id)?.connection.resize(cols, rows);
    return Promise.resolve();
  }

  close(id: string): void {
    const shell = this.sessions.get(id);
    if (!shell) return;
    this.sessions.delete(id);
    shell.connection.close();
    void shell.client.closeTerminal(shell.terminalId).catch(() => undefined);
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }
}
