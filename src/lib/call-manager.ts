import { Realtime } from "ably";

type CallStatus =
	| "idle"
	| "ringing"
	| "connecting"
	| "connected"
	| "maximized"
	| "minimized"
	| "ended";

export interface CallState {
	status: CallStatus;
	isIncoming: boolean;
	caller: {
		id: string;
		name: string;
		avatar: string;
		username: string;
	} | null;
	recipientId: string | null;
	isVideo: boolean;
	channelName: string | null;
	startedAt: number | null;
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
}

type CallEventListener = (state: CallState) => void;

class CallManager {
	private static instance: CallManager;
	private state: CallState = {
		status: "idle",
		isIncoming: false,
		caller: null,
		recipientId: null,
		isVideo: false,
		channelName: null,
		startedAt: null,
		localStream: null,
		remoteStream: null,
	};
	private listeners: Set<CallEventListener> = new Set();
	private ablyClient: Realtime | null = null;
	private channel: any = null; // Ably channel
	private localStream: MediaStream | null = null;
	private remoteStream: MediaStream | null = null;

	private constructor() {}

	public static getInstance(): CallManager {
		if (!CallManager.instance) {
			CallManager.instance = new CallManager();
		}
		return CallManager.instance;
	}

	public setAblyClient(client: Realtime) {
		this.ablyClient = client;
	}

	public subscribe(listener: CallEventListener) {
		this.listeners.add(listener);
		listener(this.state); // Initial state
		return () => this.listeners.delete(listener);
	}

	private notify() {
		this.listeners.forEach((l) => l({ ...this.state }));
	}

	public getState() {
		return { ...this.state };
	}

	// --- Actions ---

	public initialize(myProfileId: string) {
		if (!this.ablyClient) return;

		// Subscribe to MY private channel for incoming calls
		const myChannelName = `calls:${myProfileId}`;
		this.channel = this.ablyClient.channels.get(myChannelName);

		this.channel.subscribe((message: any) => {
			this.handleSignal(message);
		});

		console.log(`[CallManager] Listening on ${myChannelName}`);
	}

	public startCall(
		isVideo: boolean,
		recipientId: string,
		recipientName: string,
		recipientAvatar: string,
		isGroup: boolean, // Added to match
		caller: {
			id: string;
			name: string;
			avatar: string;
			username: string;
		},
	) {
		if (this.state.status !== "idle") return;

		this.updateState({
			status: "ringing",
			isIncoming: false,
			recipientId,
			isVideo,
			caller: caller,
		});

		// Send invite signal mock
		this.sendSignal(recipientId, "call:invite", {
			caller: caller,
			isVideo,
			callId: `call-${Date.now()}`,
		});
	}

	public acceptCall() {
		if (this.state.status !== "ringing" || !this.state.isIncoming) return;

		this.updateState({ status: "connecting" });

		if (this.state.caller) {
			this.sendSignal(this.state.caller.id, "call:accept", {});
		}

		// Mock connection delay
		setTimeout(() => {
			this.updateState({ status: "connected", startedAt: Date.now() });
			// Here we would initialize WebRTC/Cloudflare
		}, 1500);
	}

	public rejectCall() {
		if (this.state.caller) {
			this.sendSignal(this.state.caller.id, "call:reject", {});
		}
		this.reset();
	}

	public endCall() {
		const targetId = this.state.isIncoming
			? this.state.caller?.id
			: this.state.recipientId;
		if (targetId) {
			this.sendSignal(targetId, "call:end", {});
		}
		this.updateState({ status: "ended" });
		setTimeout(() => this.reset(), 2000); // Show "Ended" for 2s
	}

	// --- Helpers ---

	private updateState(partial: Partial<CallState>) {
		this.state = { ...this.state, ...partial };
		this.notify();
	}

	private reset() {
		this.state = {
			status: "idle",
			isIncoming: false,
			caller: null,
			recipientId: null,
			isVideo: false,
			channelName: null,
			startedAt: null,
			localStream: null,
			remoteStream: null,
		};
		this.notify();
	}

	private handleSignal(message: any) {
		const data = message.data;
		console.log("[CallManager] Signal received:", message.name, data);

		switch (message.name) {
			case "call:invite":
				if (this.state.status !== "idle") {
					// Send busy signal?
					return;
				}
				this.updateState({
					status: "ringing",
					isIncoming: true,
					caller: data.caller,
					isVideo: data.isVideo,
				});
				break;
			case "call:accept":
				if (this.state.status === "ringing" && !this.state.isIncoming) {
					this.updateState({ status: "connecting" });
					setTimeout(() => {
						this.updateState({ status: "connected", startedAt: Date.now() });
					}, 1000);
				}
				break;
			case "call:reject":
				this.updateState({ status: "ended" }); // "Declined"
				setTimeout(() => this.reset(), 2000);
				break;
			case "call:end":
				this.updateState({ status: "ended" });
				setTimeout(() => this.reset(), 2000);
				break;
		}
	}

	private async sendSignal(targetId: string, type: string, payload: any) {
		if (!this.ablyClient) return;
		// Check if we can publish directly or need server
		// Frontend clients usually can't publish to other user's private channels unless configured
		// For now, we'll assume we use the server-side proxy we setup earlier calling `POST /api/calls/signal`
		// But honestly, for this refactor, let's use the axios proxy we already built in `useCloudflareCalls`.

		// I will need an async way to call the API.
		// Let's rely on the Provider to pass an API caller or just import axios here.
	}

	// setter for API function
	private signalApiFn:
		| ((targetId: string, type: string, payload: any) => Promise<void>)
		| null = null;

	public setSignalFunction(
		fn: (targetId: string, type: string, payload: any) => Promise<void>,
	) {
		this.signalApiFn = fn;
	}

	private async callSignalApi(targetId: string, type: string, payload: any) {
		if (this.signalApiFn) {
			await this.signalApiFn(targetId, type, payload);
		} else {
			console.warn("[CallManager] Signal function not set");
		}
	}
}

export const callManager = CallManager.getInstance();
