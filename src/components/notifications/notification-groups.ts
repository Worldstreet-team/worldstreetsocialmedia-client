import type { AppNotification, NotificationGroup } from "./types";

/**
 * Content-free acknowledgements. Fifty likes on one post say the same thing
 * fifty times, so they fold into one row.
 *
 * reply, mention and live are never grouped: each carries distinct content
 * that folding would destroy.
 */
const GROUPABLE = new Set(["like", "repost", "follow"]);

/** Local-midnight bucket, so a popular post can resurface on a later day. */
function dayBucket(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Fold an already-sorted (newest first) notification list into groups.
 *
 * Senders are deduped by userId because the gateway has no unique index on
 * (recipient, sender, type, post) and unlike does not delete the row, so a
 * like/unlike/like cycle writes the same person twice.
 */
export function groupNotifications(
  notifications: AppNotification[],
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const index = new Map<string, NotificationGroup>();

  for (const n of notifications) {
    if (!GROUPABLE.has(n.type)) {
      groups.push({
        key: n._id,
        type: n.type,
        senders: [n.sender],
        amountMinor: n.amountMinor,
        body: n.body,
        conversation: n.conversation,
        title: n.title,
        href: n.href,
        post: n.post,
        ids: [n._id],
        createdAt: n.createdAt,
        read: n.read,
      });
      continue;
    }

    const key = `${n.type}:${n.post?._id ?? "-"}:${dayBucket(n.createdAt)}`;
    const existing = index.get(key);

    if (!existing) {
      const group: NotificationGroup = {
        key,
        type: n.type,
        senders: [n.sender],
        amountMinor: n.amountMinor,
        body: n.body,
        conversation: n.conversation,
        title: n.title,
        href: n.href,
        post: n.post,
        ids: [n._id],
        createdAt: n.createdAt,
        read: n.read,
      };
      index.set(key, group);
      groups.push(group);
      continue;
    }

    existing.ids.push(n._id);
    if (!n.read) existing.read = false;
    if (!existing.senders.some((s) => s.userId === n.sender.userId)) {
      existing.senders.push(n.sender);
    }
  }

  return groups;
}
