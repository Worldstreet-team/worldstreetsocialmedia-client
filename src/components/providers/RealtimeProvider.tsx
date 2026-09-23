"use client";

import * as Ably from "ably";
import { AblyProvider } from "ably/react";
import { useUser } from "@clerk/nextjs";
import {
	PropsWithChildren,
	useEffect,
	useState,
	useMemo,
	createContext,
	useContext,
} from "react";
import { BACKEND_ORIGIN } from "@/const";

interface RealtimeContextType {
	isConnected: boolean;
	client: Ably.Realtime | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
	isConnected: false,
	client: null,
});

/**
 * The realtime token names the threads it may attach to (the gateway scopes
 * it per conversation since 2026-09-24), so a thread that did not exist when
 * the token was minted is not in it. When an attach is refused for that
 * reason, the hook below records the thread here and asks for a new token;
 * the next auth request carries it as a hint the gateway honours for a
 * member.
 */
let wantedConversation: string | null = null;
export function requestConversationAccess(id: string) {
	wantedConversation = id;
}

export const useRealtime = () => useContext(RealtimeContext);

export default function RealtimeProvider({ children }: PropsWithChildren) {
	const { user, isLoaded } = useUser();
	const [client, setClient] = useState<Ably.Realtime | null>(null);

	const API_URL = BACKEND_ORIGIN;

	useEffect(() => {
		if (!isLoaded || !user) return;

		const ablyClient = new Ably.Realtime({
			authUrl: `${API_URL}/api/messages/auth/token`,
			authHeaders: {
				// We might need to pass the clerk token here if the auth endpoint requires it
				// But usually standard cookie/header flow works if on same domain or cors configured
				// Actually, we use Clerk, so we need to inject the token or rely on the browser session
			},
			// If we need to pass the token explicitly:
			authCallback: async (tokenParams, callback) => {
				try {
					// Get the session token from Clerk
					const token = await window.Clerk?.session?.getToken();
					const hint = wantedConversation
						? `?conversation=${encodeURIComponent(wantedConversation)}`
						: "";
					wantedConversation = null;
					const response = await fetch(`${API_URL}/api/messages/auth/token${hint}`, {
						headers: {
							Authorization: `Bearer ${token}`,
						},
					});
					const tokenRequest = await response.json();
					callback(null, tokenRequest);
				} catch (err) {
					callback(err as any, null);
				}
			},
		});

		setClient(ablyClient);

		return () => {
			ablyClient.connection.close();
		};
	}, [user, isLoaded]);

	const contextValue = useMemo(
		() => ({
			isConnected: !!client,
			client,
		}),
		[client],
	);

	return (
		<RealtimeContext.Provider value={contextValue}>
			{client ? (
				<AblyProvider client={client}>{children}</AblyProvider>
			) : (
				children
			)}
		</RealtimeContext.Provider>
	);
}
