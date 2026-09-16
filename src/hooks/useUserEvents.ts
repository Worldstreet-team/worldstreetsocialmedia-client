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
		void channel.subscribe("notification", onNotif).catch(() => {});
		void channel.subscribe("story:view", onView).catch(() => {});
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
		void channel.subscribe("like", onLike).catch(() => {});
		void channel.subscribe("reply", onReply).catch(() => {});
		void channel.subscribe("repost", onRepost).catch(() => {});
		return () => {
			channel.unsubscribe("like", onLike);
			channel.unsubscribe("reply", onReply);
			channel.unsubscribe("repost", onRepost);
		};
	}, [client, postId]);
}

/** New posts and new stories, for the timeline and the story rail. */
export function useFeedEvents(
	handler: (
		event: "post" | "story" | "engagement" | "reply",
		data: Record<string, unknown>,
	) => void,
) {
	const { client } = useRealtime();
	const ref = useRef(handler);
	ref.current = handler;

	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("feed");
		const onPost = (m: any) => ref.current("post", m?.data ?? {});
		const onStory = (m: any) => ref.current("story", m?.data ?? {});
		// Likes, replies and reposts for every post on screen, mirrored here
		// by the gateway so a timeline needs one attach rather than one per card.
		const onEngagement = (m: any) => ref.current("engagement", m?.data ?? {});
		// A reply is its own event, never "post": the home timeline filters
		// replies out entirely, so only a surface that lists them reacts.
		const onReply = (m: any) => ref.current("reply", m?.data ?? {});
		// subscribe() returns a promise that rejects when the attach fails (no
		// network, or the token request to the gateway failed). The listener is
		// registered either way and Ably re-attaches on reconnect, so a
		// rejection is transient state, not an error: uncaught, it surfaced as a
		// full-screen runtime error on every page (2026-09-16). Same catch on
		// every subscribe in the app.
		void channel.subscribe("post", onPost).catch(() => {});
		void channel.subscribe("reply", onReply).catch(() => {});
		void channel.subscribe("story", onStory).catch(() => {});
		void channel.subscribe("engagement", onEngagement).catch(() => {});
		return () => {
			channel.unsubscribe("post", onPost);
			channel.unsubscribe("reply", onReply);
			channel.unsubscribe("story", onStory);
			channel.unsubscribe("engagement", onEngagement);
		};
	}, [client]);
}
