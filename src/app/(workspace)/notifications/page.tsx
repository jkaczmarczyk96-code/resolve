import { requireUser } from "@/lib/auth/session";
import { NotificationInbox } from "@/components/workspace/notification-inbox";
export const metadata = { title: "Notifications" };
export default async function NotificationsPage() {
  await requireUser("/notifications");
  return <NotificationInbox />;
}
