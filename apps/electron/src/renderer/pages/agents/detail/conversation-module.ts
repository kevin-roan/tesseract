import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { ConversationPaneProps } from "../../../features/agents/types";

type PaneModule = { ConversationPane?: ComponentType<ConversationPaneProps>; default?: ComponentType<ConversationPaneProps> };

const modules = import.meta.glob<PaneModule>(["../conversation/index.ts", "../conversation/ConversationPane.tsx"]);

function loadPane(): LazyExoticComponent<ComponentType<ConversationPaneProps>> | null {
  const loader = modules["../conversation/index.ts"] ?? modules["../conversation/ConversationPane.tsx"];
  if (!loader) return null;
  return lazy(async () => {
    const module = await loader();
    const Pane = module.ConversationPane ?? module.default;
    if (!Pane) throw new Error("conversation/ must export ConversationPane");
    return { default: Pane };
  });
}

export const ConversationPane = loadPane();
