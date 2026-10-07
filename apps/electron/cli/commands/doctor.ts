import { checkAcceleration, hostSupport, listAvds } from "../../src/core/android";
import { describeSdk } from "../../src/core/android/sdk";
import { probeDocker } from "../../src/core/docker";
import { currentStack, findExisting } from "../../src/core/sandbox";
import type { CheckItem } from "../../src/shared/contracts/common";
import { STATUS_MARK } from "../constants";
import { errorMessage, formatBytes, shortDate } from "../format";
import { emit, guarded, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { sdkRootFor } from "../sdk-root";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.doctor;

export const DOCTOR_SECTIONS = ["docker", "image", "kvm", "sdk"] as const;
export type DoctorSectionId = (typeof DOCTOR_SECTIONS)[number];

export interface DoctorSection {
  id: DoctorSectionId;
  title: string;
  checks: CheckItem[];
}

export interface DoctorReport {
  ok: boolean;
  sections: DoctorSection[];
}

function item(id: string, status: CheckItem["status"], title: string, detail: string): CheckItem {
  return { id, status, title, detail };
}

async function dockerChecks(context: CliContext): Promise<CheckItem[]> {
  return (await probeDocker({ env: context.env, signal: context.signal })).checks;
}

async function imageChecks(context: CliContext): Promise<CheckItem[]> {
  const sandbox = await context.runtime.sandboxContext();
  const stack = await currentStack(sandbox);
  if (!stack) return [item("stack", "warning", LABELS.stackMissing, LABELS.stackMissingDetail)];
  const existing = await findExisting(sandbox, stack.project, stack.image);
  const image = existing.image
    ? item(
        "image",
        "ok",
        LABELS.imagePresent(stack.image),
        LABELS.imageDetail(formatBytes(existing.image.sizeBytes), existing.image.version, shortDate(existing.image.createdAt)),
      )
    : item("image", "error", LABELS.imageMissing(stack.image), LABELS.imageMissingDetail);
  const container = existing.container
    ? item(
        "container",
        existing.container.state === "running" ? "ok" : "warning",
        LABELS.containerTitle,
        LABELS.containerState(existing.container.name, existing.container.state),
      )
    : item("container", "warning", LABELS.containerTitle, LABELS.containerMissing);
  return [image, container];
}

async function accelChecks(context: CliContext): Promise<CheckItem[]> {
  const support = hostSupport(context.runtime.paths, context.runtime.arch);
  if (!support.supported) return [item("support", "warning", LABELS.unsupported, support.reason)];
  return (await checkAcceleration(context.runtime.paths, await sdkRootFor(context))).checks;
}

async function sdkChecks(context: CliContext): Promise<CheckItem[]> {
  const sdkRoot = await sdkRootFor(context);
  const sdk = await describeSdk(sdkRoot, "monolith-default", context.runtime.platform);
  const avds = await listAvds(context.runtime.paths).catch(() => []);
  if (sdk.emulatorRevision === null && sdk.systemImages === 0) {
    return [item("sdk", "warning", LABELS.sdkMissing, LABELS.sdkMissingDetail)];
  }
  const status = sdk.emulatorRevision && sdk.systemImages > 0 && avds.length > 0 ? "ok" : "warning";
  return [item("sdk", status, LABELS.sdkFound(sdkRoot), LABELS.sdkDetail(sdk.emulatorRevision || null, sdk.systemImages, avds.length))];
}

const RUNNERS: Record<DoctorSectionId, (context: CliContext) => Promise<CheckItem[]>> = {
  docker: dockerChecks,
  image: imageChecks,
  kvm: accelChecks,
  sdk: sdkChecks,
};

export function selectedSections(args: readonly string[]): DoctorSectionId[] {
  if (args.length === 0) return [...DOCTOR_SECTIONS];
  return args.map((arg) => {
    const id = DOCTOR_SECTIONS.find((section) => section === arg);
    if (!id) usageError(LABELS.unknownSection(arg, DOCTOR_SECTIONS.join(", ")));
    return id;
  });
}

export async function runDoctor(context: CliContext, ids: readonly DoctorSectionId[]): Promise<DoctorReport> {
  const sections = await Promise.all(
    ids.map(async (id): Promise<DoctorSection> => {
      const checks = await RUNNERS[id](context).catch((error: unknown) => [
        item(id, "error", LABELS.failedSection, errorMessage(error)),
      ]);
      return { id, title: LABELS.sections[id], checks };
    }),
  );
  return { ok: sections.every((section) => section.checks.every((check) => check.status !== "error")), sections };
}

export function describeDoctor(report: DoctorReport): string[] {
  const lines: string[] = [];
  for (const section of report.sections) {
    lines.push(section.title);
    for (const check of section.checks) {
      const [first = "", ...rest] = check.detail.split("\n");
      const mark = STATUS_MARK[check.status].padEnd(4);
      lines.push(`  ${mark} ${check.title}${first ? `: ${first}` : ""}`);
      for (const line of rest) lines.push(`       ${line}`);
    }
  }
  const problems = report.sections.flatMap((section) => section.checks).filter((check) => check.status === "error").length;
  lines.push(problems === 0 ? LABELS.allGood : LABELS.problems(problems));
  return lines;
}

export default defineCommand({
  name: "doctor",
  trigger: { subcommand: "doctor" },
  summary: CLI_LABELS.summary.doctor,
  usage: CLI_LABELS.usageLines.doctor,
  valueFlags: ["sdk"],
  run: (context) =>
    guarded(context, async () => {
      const report = await runDoctor(context, selectedSections(context.args));
      emit(context, report, describeDoctor);
      return report.ok ? EXIT.ok : EXIT.error;
    }),
});
