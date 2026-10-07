export type ViewState = "loading" | "empty" | "content";

export function viewState(loading: boolean | undefined, empty: boolean | undefined): ViewState {
  if (loading) return "loading";
  if (empty) return "empty";
  return "content";
}
