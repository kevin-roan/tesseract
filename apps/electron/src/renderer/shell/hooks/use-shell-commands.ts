import { useEffect } from "react";
import { registerCommandHandler } from "../../app/commands";
import { connectionController } from "../../app/connection";
import { openShellDialog } from "./use-shell-dialogs";

export function useShellCommands(): void {
  useEffect(
    () =>
      registerCommandHandler((command) => {
        if (command.type === "pair" || command.type === "pair-host" || command.type === "about") {
          openShellDialog(command.type);
          return true;
        }
        if (command.type === "rediscover") {
          void connectionController()
            .rediscover()
            .catch(() => undefined);
          return true;
        }
        if (command.type === "refresh") {
          connectionController().refresh();
          return true;
        }
        return false;
      }),
    [],
  );
}
