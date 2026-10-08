import type { ListeningPort } from "@tesseract/protocol";

import type { SegmentedOption } from "@/components/segmented-pills";

export function siteUrl(site: ListeningPort): string | null {
  return site.url ?? site.dnsUrl;
}

export function siteLabel(site: ListeningPort): string {
  return `:${site.port}`;
}

export function sortSites(sites: readonly ListeningPort[] | undefined): ListeningPort[] {
  return [...(sites ?? [])].sort((a, b) => a.port - b.port);
}

export function projectSites(sites: readonly ListeningPort[] | undefined, projectId: string): ListeningPort[] {
  return sortSites(sites).filter((site) => site.projectId === projectId);
}

export function processSite(sites: readonly ListeningPort[] | undefined, processId: string): ListeningPort | undefined {
  return sortSites(sites).find((site) => site.processId === processId && siteUrl(site) !== null);
}

export type ProjectsView = "projects" | "sites";

export function projectsViewOptions(projectCount: number, siteCount: number): SegmentedOption<ProjectsView>[] {
  return [
    { value: "projects", label: `Projects · ${projectCount}` },
    { value: "sites", label: `Websites · ${siteCount}` },
  ];
}
