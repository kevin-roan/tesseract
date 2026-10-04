#!/usr/bin/env bun
// Stand-in for `expo start --port <P>`: serves Metro's /message socket and appends every
// message it receives to metro-messages.log in the project. With a `no-metro-socket` file
// in the project, /message refuses the upgrade.
import { appendFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]);
console.log(`ARGS: ${args.join(" ")}`);
console.log(`HOSTNAME: ${process.env.REACT_NATIVE_PACKAGER_HOSTNAME ?? ""} CI: ${process.env.CI ?? ""}`);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch(request, server) {
    if (new URL(request.url).pathname === "/message" && !existsSync("no-metro-socket") && server.upgrade(request)) return;
    return new Response("not found", { status: 404 });
  },
  websocket: {
    message(_ws, message) {
      appendFileSync("metro-messages.log", `${String(message)}\n`);
    },
  },
});
console.log(`Metro listening on ${port}`);
