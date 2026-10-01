export type PromptSuggestion = {
  id: string;
  label: string;
};

export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  { id: "error", label: "What's causing this error in my code?" },
  { id: "api", label: "Build a REST API with authentication" },
  { id: "typescript", label: "Convert this project to TypeScript" },
  { id: "tests", label: "Write tests for the main screens" },
];

export function greetingTitle(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hello, ${first}\nHow can I help you?` : "Hello\nHow can I help you?";
}
