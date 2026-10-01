import { useInboxNotifications } from "../hooks/use-inbox-notifications";
import { usePushRegistration } from "../hooks/use-push-registration";

export default function InboxNotifier() {
  useInboxNotifications();
  usePushRegistration();
  return null;
}
