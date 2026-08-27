"use client";

import { useAtom } from "jotai";
import { useEffect } from "react";

import { useRealtime } from "@/components/providers/RealtimeProvider";
import { onlineIdsAtom } from "@/store/ui.atom";

/**
 * Who is online, app-wide.
 *
 * There WAS presence before this, but only on `conversation:<id>`, entered
 * when you opened a thread. That answers "is this person in this thread with
 * me right now" — a different question, and the reason nothing outside an
 * open chat could show an online dot.
 *
 * One channel, entered once on connect. The Ably token mints `clientId` as
 * the profile id, so the presence set *is* the set of online profiles and no
 * payload is needed. Everything else reads it through `onlineIdsAtom`.
 *
 * Scale note, honestly: one global presence set is right for this size of
 * platform and will not stay right forever — every client holds every online
 * member. When that starts to hurt, shard it (presence:<bucket>, hashed on
 * profile id, subscribing only to the buckets whose people you can see).
 */
export function PresenceSync() {
	const { client } = useRealtime();
	const [, setOnline] = useAtom(onlineIdsAtom);

	useEffect(() => {
		if (!client) return;
		let disposed = false;
		const channel = client.channels.get("presence");

		const refresh = async () => {
			try {
				const members = await channel.presence.get();
				if (disposed) return;
				setOnline(
					new Set(
						members
							.map((m: any) => String(m.clientId ?? ""))
							.filter(Boolean),
					),
				);
			} catch {
				// A presence read can fail while the connection is flapping.
				// Keeping the last known set beats blinking everyone offline.
			}
		};

		void channel.presence
			.subscribe(["enter", "leave", "present", "update"], refresh)
			.catch(() => {});
		void channel.presence.enter({}).catch(() => {});
		void refresh();

		return () => {
			disposed = true;
			try {
				channel.presence.unsubscribe();
				void channel.presence.leave().catch(() => {});
			} catch {
				/* already detached */
			}
		};
	}, [client, setOnline]);

	return null;
}
