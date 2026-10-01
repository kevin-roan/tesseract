import type { InboxItem } from "@theone/protocol";

export function prepareNotifications(): void {}

export async function presentInboxNotification(_item: InboxItem, _sandboxId: string): Promise<void> {}

export async function getExpoPushToken(): Promise<string | null> {
  return null;
}

export function subscribePushTokenChanges(_onChange: () => void): () => void {
  return () => {};
}

export function subscribeNotificationTaps(_onTap: (data: unknown) => void): () => void {
  return () => {};
}
