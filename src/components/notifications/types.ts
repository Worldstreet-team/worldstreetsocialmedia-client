import type { ProfileBadge } from "@/components/ui/UserBadges";
export interface NotificationSender {
  userId: string;
  firstName?: string;
  lastName?: string;
  username: string;
  avatar?: string;
  isVerified?: boolean;
  badges?: ProfileBadge[];
}

export type NotificationType =
  | "like"
  | "repost"
  | "follow"
  | "reply"
  | "mention"
  | "live";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  sender: NotificationSender;
  post?: { _id: string; content?: string; images?: string[] };
  read: boolean;
  createdAt: string;
}

export interface NotificationGroup {
  key: string;
  type: NotificationType;
  /** Newest first, deduped by userId. */
  senders: NotificationSender[];
  post?: AppNotification["post"];
  /** Every member id, so tapping a group marks all of it read. */
  ids: string[];
  createdAt: string;
  /** False if any member is unread. */
  read: boolean;
}

export function senderName(s: NotificationSender) {
  const full = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
  return full || s.username;
}
