export interface ChoiceOption<T extends string = string> {
  id: T;
  label: string;
  disabled?: boolean;
}

export function resolveChoice<T extends string>(options: readonly ChoiceOption<T>[], value: T | null | undefined): T | null {
  if (value !== null && value !== undefined && options.some((option) => option.id === value)) return value;
  return options[0]?.id ?? null;
}

export function choiceLabel<T extends string>(options: readonly ChoiceOption<T>[], id: T | null): string {
  return options.find((option) => option.id === id)?.label ?? "";
}
