#!/usr/bin/env bun
import { runCli } from "./cli/commands";
import { flushOutput } from "./cli/output";

const code = await runCli(process.argv.slice(2));
if (code !== null) {
  await flushOutput();
  process.exit(code);
}
