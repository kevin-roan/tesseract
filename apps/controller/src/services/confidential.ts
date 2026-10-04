import { REDACTED } from "@theone/protocol";

export type ConfidentialProjects = { isConfidential(projectId: string): boolean };

/** Appended to Claude's system prompt (`--append-system-prompt`) in a confidential project. */
export function confidentialPrompt(projectId: string): string {
  return [
    `This project is confidential and known only by the pseudonym "${projectId}".`,
    "Never reveal or repeat its real name, client, company or product names, people's names, authors, emails, API or base URLs, hostnames, endpoints, keys or other identifying details in replies, commit messages, code comments, docs, logs, summaries or PR text.",
    `Write ${REDACTED} in their place wherever possible.`,
    "Do not share files as artifacts: `theone-controller share` is disabled for this project.",
  ].join(" ");
}
