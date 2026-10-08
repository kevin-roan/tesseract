import {
  AGENT_RUN_STATES,
  BUILD_PROFILES,
  BUILD_STATES,
  BUILD_TARGETS,
  FRAMEWORKS,
  PROCESS_STATES,
  TERMINAL_KINDS,
  TERMINAL_STATES,
} from "@tesseract/protocol";

import { frameworkIcon } from "@/features/sandbox/utils/icons";
import { buildProfileLabel, buildTargetLabel, frameworkLabel, terminalKindLabel } from "@/features/sandbox/utils/labels";
import { agentRunTone, buildTone, processTone, terminalTone } from "@/features/sandbox/utils/states";

describe("every protocol enum value has a label, tone and icon", () => {
  it.each(PROCESS_STATES)("process state %s", (state) => expect(processTone(state)).toEqual(expect.any(String)));
  it.each(BUILD_STATES)("build state %s", (state) => expect(buildTone(state)).toEqual(expect.any(String)));
  it.each(AGENT_RUN_STATES)("agent run state %s", (state) => expect(agentRunTone(state)).toEqual(expect.any(String)));
  it.each(TERMINAL_STATES)("terminal state %s", (state) => expect(terminalTone(state)).toEqual(expect.any(String)));
  it.each(TERMINAL_KINDS)("terminal kind %s", (kind) => expect(terminalKindLabel(kind)).toEqual(expect.any(String)));
  it.each(BUILD_TARGETS)("build target %s", (target) => expect(buildTargetLabel(target)).toEqual(expect.any(String)));
  it.each(BUILD_PROFILES)("build profile %s", (profile) => expect(buildProfileLabel(profile)).toEqual(expect.any(String)));
  it.each(FRAMEWORKS)("framework %s", (framework) => {
    expect(frameworkLabel(framework)).toEqual(expect.any(String));
    expect(frameworkIcon(framework)).toBeTruthy();
  });

  it("marks interrupted and cancelled work as warnings, not successes", () => {
    expect(processTone("orphaned")).toBe("warning");
    expect(buildTone("cancelled")).toBe("warning");
    expect(agentRunTone("cancelled")).toBe("warning");
    expect(buildTone("queued")).toBe("neutral");
  });
});
