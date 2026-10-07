let quitting = false;
let hideOnClose = false;

export function markQuitting(): void {
  quitting = true;
}

export function isQuitting(): boolean {
  return quitting;
}

export function setHideOnClose(value: boolean): void {
  hideOnClose = value;
}

export function shouldHideOnClose(): boolean {
  return hideOnClose && !quitting;
}
