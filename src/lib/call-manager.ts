import type { Realtime } from "ably";
import {
	ConnectionQuality,
	type LocalVideoTrack,
	type RemoteTrack,
	Room,
	RoomEvent,
	Track,
} from "livekit-client";

/**
 * DM calls, for real this time.
 *
 * What was here before was theatre: `sendSignal()` had an empty body, so the
 * invite never left the browser, and `acceptCall()` faked a connection with a
 * 1.5s `setTimeout`. No media was ever captured or negotiated.
 *
 * The split now:
 *  - **Signalling** rides Ably via the gateway (`/api/calls/ring`,
 *    `/api/calls/signal`). That is what makes the other phone ring.
 *  - **Media** rides LiveKit. It owns offer/answer, ICE and renegotiation —
 *    the part the old Cloudflare-Calls scaffold never implemented.
 *
 * Both sides join one room per conversation (`dm-<conversationId>`), so the
 * "who calls whom" question never has to be answered in SDP terms.
 */

export type CallStatus =
	| "idle"
	| "ringing"
	| "connecting"
	| "connected"
	| "ended";

/** Why a call ended — drives the closing line the UI shows. */
export type CallEndReason =
	| "declined"
	| "ended"
	| "cancelled"
	| "unanswered"
	| "failed"
	| "busy"
	| null;

export interface CallPeer {
	id: string;
	name: string;
	avatar: string;
	username: string;
}

export interface CallState {
	status: CallStatus;
	isIncoming: boolean;
	/** The other side of the call — the person whose face/name the UI shows. */
	peer: CallPeer | null;
	conversationId: string | null;
	isVideo: boolean;
	/** Docked to the corner instead of filling the screen. */
	minimized: boolean;
	startedAt: number | null;
	endReason: CallEndReason;
	micOn: boolean;
	camOn: boolean;
	/** Remote side muted their mic — shown as a badge on their tile. */
	remoteMuted: boolean;
	remoteVideoOn: boolean;
	poorConnection: boolean;
	error: string | null;
}

type Listener = (state: CallState) => void;

/** Nobody picked up. Matches what phones do rather than ringing forever. */
const RING_TIMEOUT_MS = 45_000;
/** How long the "Call ended" card lingers before the UI clears. */
const TEARDOWN_MS = 1_800;

const IDLE_STATE: CallState = {
	status: "idle",
	isIncoming: false,
	peer: null,
	conversationId: null,
	isVideo: false,
	minimized: false,
	startedAt: null,
	endReason: null,
	micOn: true,
	camOn: false,
	remoteMuted: false,
	remoteVideoOn: false,
	poorConnection: false,
	error: null,
};

class CallManager {
	private static instance: CallManager;

	private state: CallState = { ...IDLE_STATE };
	private listeners = new Set<Listener>();

	private ably: Realtime | null = null;
	private channel: any = null;
	private myProfileId: string | null = null;

	private room: Room | null = null;
	private ringTimer: ReturnType<typeof setTimeout> | null = null;
	private teardownTimer: ReturnType<typeof setTimeout> | null = null;

	/** Injected by CallProvider so this file stays free of Clerk/axios. */
	private api:
		| ((path: string, body: Record<string, unknown>) => Promise<any>)
		| null = null;

	/** Track handles the UI attaches to <video>/<audio> elements. */
	public localVideoTrack: LocalVideoTrack | null = null;
	public remoteTracks = new Map<string, RemoteTrack>();

	/** The other side's camera, if they have one publishing. */
	get remoteVideo(): RemoteTrack | null {
		for (const t of this.remoteTracks.values()) {
			if (t.kind === Track.Kind.Video) return t;
		}
		return null;
	}

	/**
	 * The other side's microphone. LiveKit does not play remote audio for you —
	 * this has to be attached to an <audio> element or the call is silent.
	 */
	get remoteAudio(): RemoteTrack | null {
		for (const t of this.remoteTracks.values()) {
			if (t.kind === Track.Kind.Audio) return t;
		}
		return null;
	}

	private constructor() {}

	static getInstance() {
		if (!CallManager.instance) CallManager.instance = new CallManager();
		return CallManager.instance;
	}

	// ---------------------------------------------------------------- wiring

	setAblyClient(client: Realtime) {
		this.ably = client;
	}

	setApi(fn: (path: string, body: Record<string, unknown>) => Promise<any>) {
		this.api = fn;
	}

	/** Subscribe to my private call channel. Idempotent per profile id. */
	initialize(myProfileId: string) {
		if (!this.ably || !myProfileId) return;
		if (this.myProfileId === myProfileId && this.channel) return;

		this.teardownChannel();
		this.myProfileId = myProfileId;
		this.channel = this.ably.channels.get(`calls:${myProfileId}`);
		this.channel.subscribe(this.onSignal);
	}

	private teardownChannel() {
		if (this.channel) {
			try {
				this.channel.unsubscribe(this.onSignal);
			} catch {
				/* channel already detached */
			}
			this.channel = null;
		}
	}

	subscribe(listener: Listener) {
		this.listeners.add(listener);
		listener({ ...this.state });
		return () => {
			this.listeners.delete(listener);
		};
	}

	getState() {
		return { ...this.state };
	}

	private set(partial: Partial<CallState>) {
		this.state = { ...this.state, ...partial };
		this.listeners.forEach((l) => l({ ...this.state }));
	}

	// --------------------------------------------------------------- actions

	/** Place a call. The caller joins the room immediately, then rings. */
	async startCall(opts: {
		conversationId: string;
		peer: CallPeer;
		isVideo: boolean;
	}) {
		if (this.state.status !== "idle") return;
		const { conversationId, peer, isVideo } = opts;

		this.clearTimers();
		this.set({
			status: "ringing",
			isIncoming: false,
			peer,
			conversationId,
			isVideo,
			minimized: false,
			micOn: true,
			camOn: isVideo,
			endReason: null,
			error: null,
			startedAt: null,
		});

		const joined = await this.joinRoom(conversationId, isVideo);
		if (!joined) return;

		try {
			await this.api?.("/api/calls/ring", {
				conversationId,
				video: isVideo,
			});
		} catch (err: any) {
			// A 403 here is a rule (not mutual, or blocked), not a network
			// problem. Saying "couldn't reach them" for a refusal sends the
			// caller off debugging their connection.
			const reason = err?.response?.data?.message;
			this.fail(reason || "Couldn't reach the other person");
			return;
		}

		// Phones give up; so do we.
		this.ringTimer = setTimeout(() => {
			if (this.state.status === "ringing") {
				this.signal("call:cancel");
				this.finish("unanswered");
			}
		}, RING_TIMEOUT_MS);
	}

	/** Answer an incoming call. */
	async acceptCall() {
		const { status, isIncoming, conversationId, isVideo } = this.state;
		if (status !== "ringing" || !isIncoming || !conversationId) return;

		this.clearTimers();
		this.set({ status: "connecting", camOn: isVideo });

		// Tell the caller to stop ringing before the (slower) media join, so
		// their UI flips promptly instead of after ICE settles.
		this.signal("call:accept");

		const joined = await this.joinRoom(conversationId, isVideo);
		if (!joined) return;

		// The caller is already in the room, so a participant may be present
		// the moment we connect — the event alone would never fire for them.
		this.syncRemote();
	}

	/** Refuse an incoming call. */
	declineCall() {
		if (this.state.status === "idle") return;
		this.signal("call:decline");
		this.finish("declined");
	}

	/** Hang up, from either side, at any stage. */
	endCall() {
		if (this.state.status === "idle") return;
		const wasRinging =
			this.state.status === "ringing" && !this.state.isIncoming;
		this.signal(wasRinging ? "call:cancel" : "call:end");
		this.finish(wasRinging ? "cancelled" : "ended");
	}

	async toggleMic() {
		const next = !this.state.micOn;
		this.set({ micOn: next });
		try {
			await this.room?.localParticipant.setMicrophoneEnabled(next);
		} catch {
			this.set({ micOn: !next });
		}
	}

	async toggleCam() {
		const next = !this.state.camOn;
		this.set({ camOn: next });
		try {
			await this.room?.localParticipant.setCameraEnabled(next);
			this.localVideoTrack =
				(this.room?.localParticipant.videoTrackPublications
					.values()
					.next().value?.track as LocalVideoTrack) ?? null;
			this.set({ isVideo: this.state.isVideo || next });
		} catch {
			this.set({ camOn: !next });
		}
	}

	setMinimized(minimized: boolean) {
		this.set({ minimized });
	}

	// ----------------------------------------------------------------- media

	/** Mint a token, connect, publish. Returns false if anything blew up. */
	private async joinRoom(conversationId: string, isVideo: boolean) {
		try {
			const res = await this.api?.("/api/calls/token", { conversationId });
			if (!res?.token || !res?.url) {
				this.fail("Calling isn't available right now");
				return false;
			}

			const room = new Room({
				adaptiveStream: true,
				dynacast: true,
			});
			this.room = room;
			this.bindRoom(room);

			await room.connect(res.url, res.token);

			// Mic first: an audio call must work even if the camera is busy or
			// permission for it is refused.
			await room.localParticipant.setMicrophoneEnabled(true);
			if (isVideo) {
				try {
					await room.localParticipant.setCameraEnabled(true);
					this.localVideoTrack =
						(room.localParticipant.videoTrackPublications
							.values()
							.next().value?.track as LocalVideoTrack) ?? null;
				} catch {
					this.set({ camOn: false, error: "Camera unavailable" });
				}
			}

			this.set({ micOn: true });
			return true;
		} catch (err: any) {
			const denied =
				err?.name === "NotAllowedError" ||
				/permission|denied/i.test(err?.message ?? "");
			this.fail(
				denied
					? "Microphone permission is blocked"
					: "Couldn't connect the call",
			);
			return false;
		}
	}

	private bindRoom(room: Room) {
		room
			.on(RoomEvent.ParticipantConnected, () => this.syncRemote())
			.on(RoomEvent.ParticipantDisconnected, () => {
				// In a 1:1 call the other side leaving is the call ending.
				if (room.remoteParticipants.size === 0) {
					this.finish("ended");
				}
			})
			.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
				this.remoteTracks.set(track.sid ?? track.kind, track);
				this.syncRemote();
			})
			.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
				this.remoteTracks.delete(track.sid ?? track.kind);
				this.syncRemote();
			})
			.on(RoomEvent.TrackMuted, () => this.syncRemote())
			.on(RoomEvent.TrackUnmuted, () => this.syncRemote())
			.on(RoomEvent.ConnectionQualityChanged, (quality) => {
				this.set({
					poorConnection:
						quality === ConnectionQuality.Poor ||
						quality === ConnectionQuality.Lost,
				});
			})
			.on(RoomEvent.Disconnected, () => {
				if (this.state.status === "connected") this.finish("ended");
			});
	}

	/** Recompute remote-derived state from whatever the room currently holds. */
	private syncRemote() {
		const room = this.room;
		if (!room) return;

		const remote = room.remoteParticipants.values().next().value;
		if (!remote) return;

		// First sight of the other participant is the moment a call is real.
		if (this.state.status !== "connected") {
			this.clearTimers();
			this.set({ status: "connected", startedAt: Date.now() });
		}

		const mic = remote.getTrackPublication(Track.Source.Microphone);
		const cam = remote.getTrackPublication(Track.Source.Camera);
		this.set({
			remoteMuted: mic ? mic.isMuted : false,
			remoteVideoOn: Boolean(cam && !cam.isMuted && cam.isSubscribed),
		});
	}

	// ------------------------------------------------------------- lifecycle

	private onSignal = (message: any) => {
		const name = message?.name;
		const data = message?.data ?? {};

		switch (name) {
			case "call:incoming": {
				// Already busy — tell them so instead of silently dropping it.
				if (this.state.status !== "idle") {
					this.api
						?.("/api/calls/signal", {
							conversationId: data.conversationId,
							type: "call:busy",
						})
						.catch(() => {});
					return;
				}
				this.clearTimers();
				this.set({
					status: "ringing",
					isIncoming: true,
					peer: data.caller ?? null,
					conversationId: data.conversationId ?? null,
					isVideo: Boolean(data.isVideo),
					minimized: false,
					micOn: true,
					camOn: Boolean(data.isVideo),
					endReason: null,
					error: null,
					startedAt: null,
				});
				break;
			}
			case "call:accept":
				// Media arrival flips us to "connected"; this just stops the
				// ring tone and closes the 45s window.
				if (this.state.status === "ringing" && !this.state.isIncoming) {
					this.clearTimers();
					this.set({ status: "connecting" });
				}
				break;
			case "call:decline":
				this.finish("declined");
				break;
			case "call:busy":
				this.finish("busy");
				break;
			case "call:cancel":
				if (this.state.isIncoming) this.finish("cancelled");
				break;
			case "call:end":
				this.finish("ended");
				break;
		}
	};

	private async signal(type: string) {
		const conversationId = this.state.conversationId;
		if (!conversationId) return;
		try {
			await this.api?.("/api/calls/signal", { conversationId, type });
		} catch {
			/* the local hang-up still has to happen */
		}
	}

	private fail(message: string) {
		this.set({ error: message });
		this.finish("failed");
	}

	/**
	 * Map an end reason onto the row that belongs in the thread. Only the
	 * caller logs — otherwise both sides would write the same call twice.
	 */
	private logIfCaller(reason: CallEndReason) {
		const { isIncoming, conversationId, isVideo, startedAt } = this.state;
		if (isIncoming || !conversationId) return;

		let outcome: string | null = null;
		if (reason === "ended") outcome = startedAt ? "answered" : "cancelled";
		else if (reason === "declined") outcome = "declined";
		else if (reason === "unanswered" || reason === "busy") outcome = "missed";
		else if (reason === "cancelled") outcome = "cancelled";
		// "failed" is our problem, not a call the other person can see.
		if (!outcome) return;

		const durationSec = startedAt ? (Date.now() - startedAt) / 1000 : 0;
		this.api
			?.("/api/calls/log", {
				conversationId,
				outcome,
				video: isVideo,
				durationSec,
			})
			.catch(() => {
				/* the call still ended; a missing row isn't worth a toast */
			});
	}

	/** Close the media plane, show the outcome briefly, then go idle. */
	private finish(reason: CallEndReason) {
		if (this.state.status === "idle") return;
		this.clearTimers();
		// Before the state is cleared — duration lives on `startedAt`.
		this.logIfCaller(reason);
		this.disconnectRoom();
		this.set({ status: "ended", endReason: reason, startedAt: null });
		this.teardownTimer = setTimeout(() => this.reset(), TEARDOWN_MS);
	}

	private disconnectRoom() {
		try {
			this.room?.disconnect();
		} catch {
			/* already gone */
		}
		this.room = null;
		this.localVideoTrack = null;
		this.remoteTracks.clear();
	}

	private clearTimers() {
		if (this.ringTimer) clearTimeout(this.ringTimer);
		if (this.teardownTimer) clearTimeout(this.teardownTimer);
		this.ringTimer = null;
		this.teardownTimer = null;
	}

	private reset() {
		this.clearTimers();
		this.disconnectRoom();
		// `error` survives one beat longer than the rest so a failure message
		// isn't wiped before it can be read; the UI clears it on next action.
		this.state = { ...IDLE_STATE, error: this.state.error };
		this.listeners.forEach((l) => l({ ...this.state }));
	}
}

export const callManager = CallManager.getInstance();
