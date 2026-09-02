import type { ProfileBadge } from "@/components/ui/UserBadges";
export interface NotificationSender {
  /**
   * The Mongo profile id. The gateway has always populated it, but this type
   * never declared it, so every follow-back reached for `userId` (the CLERK
   * id) instead — and `followingIdsAtom` is keyed on profile ids everywhere
   * else in the app. The comparison could never match.
   */
  _id: string;
  userId: string;
  /**
   * Whether the VIEWER already follows this sender, answered by the gateway.
   * The client used to infer it from a session-only atom that seeds empty, so
   * after any reload it believed you followed nobody and offered "follow back"
   * for people you had followed months ago.
   */
  isFollowing?: boolean;
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
  | "quote"
  | "follow"
  | "reply"
  | "mention"
  | "live"
  | "sale"
  | "gift"
  | "moderation"
  | "message";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  sender: NotificationSender;
  post?: { _id: string; content?: string; images?: string[] };
  /** USD minor units — money notifications only. */
  amountMinor?: number;
  /** Free text, moderation notices only: what was removed and why. */
  body?: string;
  /** DM notifications: the thread to open. */
  conversation?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationGroup {
  key: string;
  type: NotificationType;
  /** Newest first, deduped by userId. */
  senders: NotificationSender[];
  post?: AppNotification["post"];
  /** Carried up from the newest member, for the money types. */
  amountMinor?: number;
  /** Carried up for moderation notices. */
  body?: string;
  conversation?: string;
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
