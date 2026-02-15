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
import { BACKEND_URL } from "@/const";

interface RealtimeContextType {
	isConnected: boolean;
	client: Ably.Realtime | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
	isConnected: false,
	client: null,
});

export const useRealtime = () => useContext(RealtimeContext);

export default function RealtimeProvider({ children }: PropsWithChildren) {
	const { user, isLoaded } = useUser();
	const [client, setClient] = useState<Ably.Realtime | null>(null);

	const API_URL =
		(process.env.NEXT_PUBLIC_API_URL || BACKEND_URL).replace(/\/api\/?$/, "") ||
		BACKEND_URL;

	useEffect(() => {
		if (!isLoaded || !user) return;

		console.warn("Initializing Ably Client...");
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
					const response = await fetch(`${API_URL}/api/messages/auth/token`, {
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
