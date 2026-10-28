import { relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import {
  CreateIssueCommentSchema,
  CreateIssueSchema,
  isIdOfKind,
  IssueQuerySchema,
  restPaths,
  UpdateIssueSchema,
  validate,
  type Issue,
  type IssueComment,
  type IssueDetail,
  type Schema,
} from "@tesseract/protocol";
import type { Config } from "../config";
import type { Env } from "../core/exec";
import { ISSUE_ENV, issueIdentifier } from "../services/issues";
import { callLocalApi, CliError } from "./local-api";
import type { Output } from "./output";
import { formatAgo, formatLocalTime } from "./tesseract";

export const ISSUE_USAGE = `tesseract-controller issue list [--project <id>] [--status <status>] [--assignee me|claude] [--json]
  tesseract-controller issue show [<id>] [--json]
  tesseract-controller issue create --title <title> [--project <id>] [--description <text>] [--status <status>]
                                     [--priority <priority>] [--assignee me|claude] [--label <label>]... [--json]
  tesseract-controller issue update [<id>] [--title <title>] [--description <text>] [--status <status>]
                                     [--priority <priority>] [--assignee me|claude|none] [--label <label>]... [--json]
  tesseract-controller issue comment [<id>] <text | -> [--json]
                                     project issues (docs/architecture/issues.md); <id> (iss_…) defaults to
                                     $TESSERACT_ISSUE_ID, set in runs Claude works on for an issue; comments post as
                                     claude; create defaults --project to the project of the current directory or issue`;

export type IssueCliOptions = { env: Env; cwd: string; readStdin: () => Promise<string>; now?: () => number };

const STDIN_TEXT = "-";

function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  return rows.map((row) => row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join("  "));
}

function checked<T>(schema: Schema<T>, value: unknown, what: string): T {
  const result = validate(schema, value);
  if (!result.ok) throw new CliError(`Invalid ${what}: ${result.error.message}\n\n${ISSUE_USAGE}`, 2);
  return result.value;
}

function issueId(positional: string | undefined, env: Env): string {
  const id = positional ?? env[ISSUE_ENV] ?? "";
  if (!isIdOfKind("issue", id)) throw new CliError(`Pass an issue id (iss_…) or set ${ISSUE_ENV}\n\n${ISSUE_USAGE}`, 2);
  return id;
}

export function formatIssueList(issues: Issue[]): string[] {
  if (issues.length === 0) return ["No issues"];
  return table([
    ["ISSUE", "STATUS", "PRIORITY", "ASSIGNEE", "ID", "TITLE"],
    ...issues.map((issue) => [issueIdentifier(issue), issue.status, issue.priority, issue.assignee ?? "-", issue.id, issue.title]),
  ]);
}

function formatComment(comment: IssueComment, now: number): string[] {
  return [`${comment.author} · ${formatAgo(comment.createdAt, now)}`, ...comment.body.split("\n").map((line) => `  ${line}`)];
}

export function formatIssue(issue: IssueDetail, now: number): string[] {
  const run = issue.agentRunId ? `${issue.agentRunId} (${issue.agentState ?? "unknown"})` : null;
  return [
    `${issueIdentifier(issue)}  ${issue.title}`,
    `  id         ${issue.id}`,
    `  status     ${issue.status}`,
    `  priority   ${issue.priority}`,
    `  assignee   ${issue.assignee ?? "-"}`,
    ...(issue.labels.length > 0 ? [`  labels     ${issue.labels.join(", ")}`] : []),
    ...(run ? [`  run        ${run}`] : []),
    `  created    ${formatLocalTime(issue.createdAt)} (${formatAgo(issue.createdAt, now)})`,
    `  updated    ${formatLocalTime(issue.updatedAt)} (${formatAgo(issue.updatedAt, now)})`,
    ...(issue.description.trim() ? ["", ...issue.description.trimEnd().split("\n")] : []),
    ...(issue.comments.length > 0 ? ["", "activity:", ...issue.comments.flatMap((comment) => formatComment(comment, now).map((line) => `  ${line}`))] : []),
  ];
}

async function fetchIssue(config: Config, id: string): Promise<IssueDetail> {
  const issue = await callLocalApi<IssueDetail>(config, "GET", restPaths.issue(id));
  if (!issue) throw new CliError("Empty issue response");
  return issue;
}

async function list(config: Config, args: string[], output: Output): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { project: { type: "string" }, status: { type: "string" }, assignee: { type: "string" }, json: { type: "boolean", default: false } },
    strict: true,
  });
  const filter = checked(IssueQuerySchema, { projectId: values.project, status: values.status, assignee: values.assignee }, "filter");
  const issues = (await callLocalApi<Issue[]>(config, "GET", restPaths.issues(filter))) ?? [];
  output.out(values.json ? JSON.stringify(issues, null, 2) : formatIssueList(issues).join("\n"));
  return 0;
}

async function show(config: Config, args: string[], output: Output, options: IssueCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, allowPositionals: true, strict: true });
  if (positionals.length > 1) throw new CliError(`issue show takes at most one issue id\n\n${ISSUE_USAGE}`, 2);
  const issue = await fetchIssue(config, issueId(positionals[0], options.env));
  output.out(values.json ? JSON.stringify(issue, null, 2) : formatIssue(issue, (options.now ?? Date.now)()).join("\n"));
  return 0;
}

const FIELD_OPTIONS = {
  title: { type: "string" },
  description: { type: "string" },
  status: { type: "string" },
  priority: { type: "string" },
  assignee: { type: "string" },
  label: { type: "string", multiple: true },
  json: { type: "boolean", default: false },
} as const;

type FieldValues = { title?: string; description?: string; status?: string; priority?: string; assignee?: string; label?: string[] };

function fields(values: FieldValues): Record<string, unknown> {
  return {
    ...(values.title !== undefined ? { title: values.title } : {}),
    ...(values.description !== undefined ? { description: values.description } : {}),
    ...(values.status !== undefined ? { status: values.status } : {}),
    ...(values.priority !== undefined ? { priority: values.priority } : {}),
    ...(values.assignee !== undefined ? { assignee: values.assignee === "none" ? null : values.assignee } : {}),
    ...(values.label !== undefined ? { labels: values.label } : {}),
  };
}

async function defaultProject(config: Config, options: IssueCliOptions): Promise<string> {
  const inside = relative(resolve(config.projectsDir), resolve(options.cwd));
  const fromCwd = inside && !inside.startsWith("..") && !inside.startsWith(sep) ? inside.split(sep)[0] : undefined;
  if (fromCwd) return fromCwd;
  const current = options.env[ISSUE_ENV];
  if (current && isIdOfKind("issue", current)) return (await fetchIssue(config, current)).projectId;
  throw new CliError(`Pass --project <id>: the current directory is not inside a project\n\n${ISSUE_USAGE}`, 2);
}

async function create(config: Config, args: string[], output: Output, options: IssueCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { ...FIELD_OPTIONS, project: { type: "string" } }, strict: true });
  if (positionals.length > 0) throw new CliError(`issue create takes options only\n\n${ISSUE_USAGE}`, 2);
  const input = checked(CreateIssueSchema, fields(values), "issue");
  const projectId = values.project ?? (await defaultProject(config, options));
  const issue = await callLocalApi<Issue>(config, "POST", restPaths.projectIssues(projectId), input);
  if (!issue) throw new CliError("Empty issue response");
  output.out(values.json ? JSON.stringify(issue, null, 2) : `created ${issueIdentifier(issue)} (${issue.id}, ${issue.status}): ${issue.title}`);
  return 0;
}

async function update(config: Config, args: string[], output: Output, options: IssueCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: FIELD_OPTIONS, allowPositionals: true, strict: true });
  if (positionals.length > 1) throw new CliError(`issue update takes at most one issue id\n\n${ISSUE_USAGE}`, 2);
  const id = issueId(positionals[0], options.env);
  const input = checked(UpdateIssueSchema, fields(values), "update");
  const issue = await callLocalApi<Issue>(config, "PATCH", restPaths.issue(id), input);
  if (!issue) throw new CliError("Empty issue response");
  output.out(values.json ? JSON.stringify(issue, null, 2) : `updated ${issueIdentifier(issue)} (${issue.status}, ${issue.assignee ?? "unassigned"}): ${issue.title}`);
  return 0;
}

async function comment(config: Config, args: string[], output: Output, options: IssueCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({ args, options: { json: { type: "boolean", default: false } }, allowPositionals: true, strict: true });
  const explicit = positionals.length > 1 && isIdOfKind("issue", positionals[0] ?? "");
  const id = issueId(explicit ? positionals[0] : undefined, options.env);
  const words = explicit ? positionals.slice(1) : positionals;
  if (words.length === 0) throw new CliError(`issue comment needs the text (or - for stdin)\n\n${ISSUE_USAGE}`, 2);
  const body = words.length === 1 && words[0] === STDIN_TEXT ? await options.readStdin() : words.join(" ");
  const input = checked(CreateIssueCommentSchema, { body, author: "claude" }, "comment");
  const posted = await callLocalApi<IssueComment>(config, "POST", restPaths.issueComments(id), input);
  if (!posted) throw new CliError("Empty comment response");
  output.out(values.json ? JSON.stringify(posted, null, 2) : `commented on ${id} (${posted.id})`);
  return 0;
}

/** `tesseract-controller issue …`: the project issues of this controller, also for Claude inside an issue's run. */
export async function issue(config: Config, args: string[], output: Output, options: IssueCliOptions): Promise<number> {
  const [first, ...rest] = args;
  switch (first) {
    case "list":
    case "ls":
      return list(config, rest, output);
    case "show":
      return show(config, rest, output, options);
    case "create":
      return create(config, rest, output, options);
    case "update":
      return update(config, rest, output, options);
    case "comment":
      return comment(config, rest, output, options);
    case "--help":
    case "-h":
      output.out(ISSUE_USAGE);
      return 0;
    default:
      output.err(first === undefined ? ISSUE_USAGE : `Unknown issue command "${first}"\n\n${ISSUE_USAGE}`);
      return 2;
  }
}
