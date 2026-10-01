import { useCallback, useMemo } from "react";
import type { AgentRun } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { greetingTitle, PROMPT_SUGGESTIONS, type PromptSuggestion } from "@/features/chat/utils/suggestions";

import { frameworkIcon } from "../utils/icons";
import { profilePerson } from "../utils/profile";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useProjects, useSandboxIdentity } from "./use-sandbox-queries";

export function useNewAgentRun(projectId: string | null) {
  const nav = useSandboxNavigation();
  const projects = useProjects();
  const identity = useSandboxIdentity();
  const onStarted = useCallback((run: AgentRun) => nav.replaceWithAgentRun(run.id), [nav]);

  const projectOptions = useMemo<ChoiceOption[]>(
    () =>
      (projects.data ?? []).map((project) => ({
        id: project.id,
        label: project.name,
        icon: frameworkIcon(project.framework),
      })),
    [projects.data],
  );

  const composer = useChatComposer({ defaultProjectId: projectId, projectOptions, onStarted });
  const { setText } = composer;

  const greeting = greetingTitle(profilePerson(identity.data)?.displayName);
  const selectSuggestion = useCallback((suggestion: PromptSuggestion) => setText(suggestion.label), [setText]);

  const showSuggestions = !composer.text && composer.voice.phase === "idle" && composer.attachments.items.length === 0;

  return {
    nav,
    composer,
    projectOptions,
    greeting,
    suggestions: { visible: showSuggestions, items: PROMPT_SUGGESTIONS, select: selectSuggestion },
  };
}
