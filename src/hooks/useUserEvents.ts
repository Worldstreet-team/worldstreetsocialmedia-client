"use client";

import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { userAtom } from "@/store/user.atom";

export interface UserEvent {
	type: string;
	postId?: string;
	actor?: string;
	followers?: number;
	[key: string]: unknown;
}

/**
 * Everything aimed at the signed-in person: likes, replies, reposts, follows
 * and mentions as they happen, plus story view counts. The gateway writes the
 * Notification row and publishes here in the same breath, so the bell reacts
 * immediately instead of on the next page load.
 */
export function useUserEvents(
	onNotification: (event: UserEvent) => void,
	onStoryView?: (data: { storyId: string; viewsCount: number }) => void,
) {
	const { client } = useRealtime();
	const me = useAtomValue(userAtom);
	const notifRef = useRef(onNotification);
	notifRef.current = onNotification;
	const viewRef = useRef(onStoryView);
	viewRef.current = onStoryView;

	const myId = me?._id;

	useEffect(() => {
		if (!client || !myId) return;
		const channel = client.channels.get(`user:${myId}`);
		const onNotif = (m: any) => notifRef.current(m?.data ?? {});
		const onView = (m: any) => viewRef.current?.(m?.data ?? {});
		void channel.subscribe("notification", onNotif);
		void channel.subscribe("story:view", onView);
		return () => {
			channel.unsubscribe("notification", onNotif);
			channel.unsubscribe("story:view", onView);
		};
	}, [client, myId]);
}

/**
 * Live counts and replies for one post. Used by the post page so an open
 * thread grows as people reply, and the like count tracks other clients.
 */
export function usePostEvents(
	postId: string | undefined,
	handler: (
		event: "like" | "reply" | "repost",
		data: Record<string, unknown>,
	) => void,
) {
	const { client } = useRealtime();
	const ref = useRef(handler);
	ref.current = handler;

	useEffect(() => {
		if (!client || !postId) return;
		const channel = client.channels.get(`post:${postId}`);
		const onLike = (m: any) => ref.current("like", m?.data ?? {});
		const onReply = (m: any) => ref.current("reply", m?.data ?? {});
		const onRepost = (m: any) => ref.current("repost", m?.data ?? {});
		void channel.subscribe("like", onLike);
		void channel.subscribe("reply", onReply);
		void channel.subscribe("repost", onRepost);
		return () => {
			channel.unsubscribe("like", onLike);
			channel.unsubscribe("reply", onReply);
			channel.unsubscribe("repost", onRepost);
		};
	}, [client, postId]);
}

/** New posts and new stories, for the timeline and the story rail. */
export function useFeedEvents(
	handler: (event: "post" | "story", data: Record<string, unknown>) => void,
) {
	const { client } = useRealtime();
	const ref = useRef(handler);
	ref.current = handler;

	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("feed");
		const onPost = (m: any) => ref.current("post", m?.data ?? {});
		const onStory = (m: any) => ref.current("story", m?.data ?? {});
		void channel.subscribe("post", onPost);
		void channel.subscribe("story", onStory);
		return () => {
			channel.unsubscribe("post", onPost);
			channel.unsubscribe("story", onStory);
		};
	}, [client]);
}
