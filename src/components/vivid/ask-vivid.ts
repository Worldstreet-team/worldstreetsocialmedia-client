"use client";

import { getDefaultStore } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { VividPostRef } from "@/lib/vivid.client";
import { vividAskPostAtom } from "@/store/ui.atom";

/**
 * "Ask Vivid" on a post (owner 2026-10-16: "sending it a post having a scan
 * animation"): opens Vivid's chat in Messages with the post already sent.
 * Vivid scans the card while it reads, then answers; nothing to type.
 */
export function useAskVivid() {
	const router = useRouter();
	return useCallback(
		(post: VividPostRef) => {
			getDefaultStore().set(vividAskPostAtom, {
				...post,
				text: post.text.slice(0, 600),
			});
			router.push("/messages/vivid");
		},
		[router],
	);
}
