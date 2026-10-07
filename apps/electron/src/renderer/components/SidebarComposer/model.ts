export interface PickerProject {
  id: string;
  name?: string | null;
}

export interface PickerOption {
  id: string | null;
  label: string;
}

export interface PickerChoice {
  id: string;
  label: string;
}

const sortKey = (project: PickerProject) => (project.name || project.id).toLowerCase();

export function sortProjects(projects: readonly PickerProject[]): PickerProject[] {
  return [...projects].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export function pickerOptions(projects: readonly PickerProject[], noProjectLabel: string): PickerOption[] {
  return [{ id: null, label: noProjectLabel }, ...sortProjects(projects).map((project) => ({ id: project.id, label: project.name || project.id }))];
}

export function pickerChoices(projects: readonly PickerProject[], noProjectLabel: string): PickerChoice[] {
  return pickerOptions(projects, noProjectLabel).map((option) => ({ id: option.id ?? "", label: option.label }));
}

export function resolveSelection(projects: readonly PickerProject[], selected: string | null): string | null {
  if (selected === null) return null;
  return projects.some((project) => project.id === selected) ? selected : null;
}

export interface SidebarSendState {
  text: string;
  online: boolean;
  hasAttachments?: boolean;
  attachmentsBlocked?: boolean;
}

export function canSendFromSidebar({ text, online, hasAttachments = false, attachmentsBlocked = false }: SidebarSendState): boolean {
  return (text.trim() !== "" || hasAttachments) && online && !attachmentsBlocked;
}
