"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

import { useRealtime } from "@/components/providers/RealtimeProvider";
import { callManager, type CallPeer, type CallState } from "@/lib/call-manager";
import { CallSurface } from "@/components/messages/CallSurface";
import { useCallTones } from "@/hooks/useCallTones";
import { BACKEND_URL } from "@/const";

interface CallContextType extends CallState {
	startCall: (opts: {
		conversationId: string;
		peer: CallPeer;
		isVideo: boolean;
	}) => void;
	acceptCall: () => void;
	declineCall: () => void;
	endCall: () => void;
	toggleMic: () => void;
	toggleCam: () => void;
	setMinimized: (minimized: boolean) => void;
}

const CallContext = createContext<CallContextType | null>(null);

const API_URL = BACKEND_URL;

export const useCall = () => {
	const context = useContext(CallContext);
	if (!context) {
		throw new Error("useCall must be used within a CallProvider");
	}
	return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
	const { getToken } = useAuth();
	const { client } = useRealtime();
	const [state, setState] = useState<CallState>(callManager.getState());

	// The manager stays framework-free; auth and transport are injected.
	useEffect(() => {
		callManager.setApi(async (path, body) => {
			const token = await getToken();
			const res = await axios.post(`${API_URL}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
				timeout: 15_000,
			});
			return res.data;
		});
	}, [getToken]);

	useEffect(() => {
		if (client) callManager.setAblyClient(client);
	}, [client]);

	useEffect(() => callManager.subscribe(setState), []);

	// Ably's clientId is the caller's profile id (the gateway mints it that
	// way), which is exactly the key call channels are named after.
	//
	// It is NOT known when the client object is created — it arrives with the
	// first token, after connect. This effect used to check it exactly once,
	// at effect time, and the `client` reference never changes afterwards; on
	// any load where the token fetch had not finished yet, the callee simply
	// never subscribed to their own call channel. The phone could not ring
	// because nobody was listening for it. Initialize on every (re)connect —
	// the manager is idempotent per profile id.
	useEffect(() => {
		if (!client) return;
		const init = () => {
			if (client.auth.clientId) callManager.initialize(client.auth.clientId);
		};
		init();
		client.connection.on("connected", init);
		return () => {
			client.connection.off("connected", init);
		};
	}, [client]);

	useCallTones(state);

	// A call you can't see is a call you'll miss — surface it at the OS level
	// when the tab is in the background.
	useEffect(() => {
		if (state.status !== "ringing" || !state.isIncoming || !state.peer) return;
		if (typeof Notification === "undefined") return;
		if (Notification.permission !== "granted") return;
		if (document.visibilityState === "visible") return;

		const notification = new Notification(
			`${state.peer.name} is calling`,
			{
				body: state.isVideo ? "Incoming video call" : "Incoming voice call",
				icon: state.peer.avatar || undefined,
				tag: "ws-incoming-call",
			},
		);
		notification.onclick = () => {
			window.focus();
			notification.close();
		};
		return () => notification.close();
	}, [state.status, state.isIncoming, state.peer, state.isVideo]);

	// Ask once, on the first call of the session, rather than on page load.
	useEffect(() => {
		if (state.status === "idle") return;
		if (typeof Notification === "undefined") return;
		if (Notification.permission === "default") {
			Notification.requestPermission().catch(() => {});
		}
	}, [state.status]);

	// Closing the tab mid-call should hang up, not leave a ghost in the room.
	useEffect(() => {
		const onUnload = () => {
			if (callManager.getState().status !== "idle") callManager.endCall();
		};
		window.addEventListener("beforeunload", onUnload);
		return () => window.removeEventListener("beforeunload", onUnload);
	}, []);

	const startCall = useCallback(
		(opts: { conversationId: string; peer: CallPeer; isVideo: boolean }) => {
			void callManager.startCall(opts);
		},
		[],
	);
	const acceptCall = useCallback(() => void callManager.acceptCall(), []);
	const declineCall = useCallback(() => callManager.declineCall(), []);
	const endCall = useCallback(() => callManager.endCall(), []);
	const toggleMic = useCallback(() => void callManager.toggleMic(), []);
	const toggleCam = useCallback(() => void callManager.toggleCam(), []);
	const setMinimized = useCallback(
		(minimized: boolean) => callManager.setMinimized(minimized),
		[],
	);

	return (
		<CallContext.Provider
			value={{
				...state,
				startCall,
				acceptCall,
				declineCall,
				endCall,
				toggleMic,
				toggleCam,
				setMinimized,
			}}
		>
			{children}
			<CallSurface />
		</CallContext.Provider>
	);
};
