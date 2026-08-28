import type { Realtime } from "ably";
import type {
	LocalVideoTrack,
	RemoteTrack,
	Room,
} from "livekit-client";

/**
 * LiveKit is loaded on the first call, never on page load.
 *
 * `CallProvider` is mounted in the root layout, so this module is on every
 * page. A static import therefore shipped the whole ~500KB SDK to every
 * visitor whether or not they ever placed a call — it landed in the two
 * largest chunks in the build. Every other livekit call site in the app was
 * already using `await import()`; this was the one that was not, and being on
 * the root path made it the expensive one.
 *
 * The type imports above are erased at compile time and cost nothing.
 */
type LiveKit = typeof import("livekit-client");
let lk: LiveKit | null = null;
async function loadLiveKit(): Promise<LiveKit> {
	lk ??= await import("livekit-client");
	return lk;
}
/**
 * The loaded module, for the synchronous paths.
 *
 * Every one of them runs downstream of `joinRoom()` — event handlers bound to
 * a live room, or getters iterating tracks that only exist once connected —
 * so by the time any of this evaluates the module is in hand.
 */
function LK(): LiveKit {
	if (!lk) throw new Error("LiveKit was used before a call started");
	return lk;
}

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

/**
 * A recently connected call that a reload interrupted — enough to put the
 * room back together without ringing anyone. Surfaced on the state as
 * `rejoinable`; the UI offers it as a "Rejoin" pill, never auto-joins.
 */
export interface RejoinableCall {
	conversationId: string;
	isVideo: boolean;
	peer: CallPeer;
	/** The original connect time, so a rejoined call's timer is honest. */
	startedAt: number;
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
	/** Which camera is publishing. Only meaningful on a device that has two. */
	facing: "user" | "environment";
	/** True while a flip is in flight, so the button cannot be double-fired. */
	switchingCam: boolean;
	/** Remote side muted their mic — shown as a badge on their tile. */
	remoteMuted: boolean;
	remoteVideoOn: boolean;
	poorConnection: boolean;
	error: string | null;
	/** A reload-interrupted call the user may pick back up. Never auto-joined. */
	rejoinable: RejoinableCall | null;
}

type Listener = (state: CallState) => void;

/** Nobody picked up. Matches what phones do rather than ringing forever. */
const RING_TIMEOUT_MS = 45_000;
/** How long the "Call ended" card lingers before the UI clears. */
const TEARDOWN_MS = 1_800;

/** Where an in-flight call is remembered across a reload. Session-scoped on
 *  purpose: a new tab is a new phone, only *this* tab's reload should offer
 *  the call back. */
const ACTIVE_CALL_KEY = "ws-active-call";
/** How stale the stored record may be and still be worth offering back. */
const REJOIN_WINDOW_MS = 2 * 60_000;
/** While connected, re-stamp the record this often so its `at` stays fresh —
 *  the 2-minute window is meant from the *interruption*, not from pickup. */
const PERSIST_HEARTBEAT_MS = 15_000;
/** A rejoin joins the room silently — nobody is rung. If the other side never
 *  shows up (they hung up while we were gone), stop waiting and end quietly. */
const REJOIN_GRACE_MS = 10_000;

/** What actually sits in sessionStorage under ACTIVE_CALL_KEY. */
interface StoredActiveCall {
	conversationId: string;
	isVideo: boolean;
	peerJson: string;
	startedAt: number;
	at: number;
}

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
	facing: "user",
	switchingCam: false,
	remoteMuted: false,
	remoteVideoOn: false,
	poorConnection: false,
	error: null,
	rejoinable: null,
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
	/** Re-stamps the stored active-call record while connected. */
	private persistTimer: ReturnType<typeof setInterval> | null = null;
	/** Waits out a silent rejoin before conceding the other side is gone. */
	private rejoinTimer: ReturnType<typeof setTimeout> | null = null;
	/** True while the page is being torn down — see the constructor. */
	private unloading = false;
	/** The stored record is looked at once per page load, on first initialize. */
	private rejoinChecked = false;

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
			if (t.kind === LK().Track.Kind.Video) return t;
		}
		return null;
	}

	/**
	 * The other side's microphone. LiveKit does not play remote audio for you —
	 * this has to be attached to an <audio> element or the call is silent.
	 */
	get remoteAudio(): RemoteTrack | null {
		for (const t of this.remoteTracks.values()) {
			if (t.kind === LK().Track.Kind.Audio) return t;
		}
		return null;
	}

	private constructor() {
		// A reload runs the normal hang-up path (CallProvider ends the call on
		// beforeunload), and finish() clears the stored record — which would
		// erase exactly the record a reload needs. This listener registers at
		// module import, *before* CallProvider's, so by the time that hang-up
		// runs we already know the page is going away and finish() leaves the
		// record alone. If the navigation is cancelled the page lives on and
		// the timer un-sets the flag; timers never run in a page that actually
		// unloaded, so the flag can't stick the wrong way.
		if (typeof window !== "undefined") {
			const markUnloading = () => {
				this.unloading = true;
				// Freshest possible `at` for the record the reload will read.
				if (this.state.status === "connected") this.persistActiveCall();
				setTimeout(() => {
					this.unloading = false;
				}, 1_000);
			};
			window.addEventListener("beforeunload", markUnloading);
			window.addEventListener("pagehide", markUnloading);
		}
	}

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
		// First boot after a reload: see whether a call was interrupted.
		this.restoreRejoinable();
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

	/**
	 * Swap between the front and back camera.
	 *
	 * LiveKit has no "flip" — a camera is a device constraint, so the switch is
	 * a republish of the video track with the other facingMode. Which is why
	 * this is guarded: two taps in flight at once would race two publishes and
	 * can leave the room with no camera at all.
	 *
	 * `switchCamera` does not exist on every version of the SDK's track object,
	 * so the fallback restarts the track with the new constraint. If both fail
	 * the previous facing is restored, since the old track is still publishing.
	 */
	async flipCamera() {
		if (this.state.switchingCam || !this.state.camOn) return;
		const next = this.state.facing === "user" ? "environment" : "user";
		this.set({ switchingCam: true, facing: next });
		try {
			const pub = this.room?.localParticipant.videoTrackPublications
				.values()
				.next().value;
			const track = pub?.track as
				| (LocalVideoTrack & {
						restartTrack?: (c: MediaTrackConstraints) => Promise<void>;
				  })
				| undefined;
			if (track?.restartTrack) {
				await track.restartTrack({ facingMode: next });
			} else {
				// Republish: drop the camera and bring it back facing the other way.
				await this.room?.localParticipant.setCameraEnabled(false);
				await this.room?.localParticipant.setCameraEnabled(true, {
					facingMode: next,
				});
			}
			this.localVideoTrack =
				(this.room?.localParticipant.videoTrackPublications
					.values()
					.next().value?.track as LocalVideoTrack) ?? null;
			// Re-notify: the track handle changed even though no flag did.
			this.set({});
		} catch {
			this.set({ facing: this.state.facing === "user" ? "environment" : "user" });
		} finally {
			this.set({ switchingCam: false });
		}
	}

	setMinimized(minimized: boolean) {
		this.set({ minimized });
	}

	/**
	 * Pick an interrupted call back up. No ring, no signal — the other side
	 * never left (or already hung up); we just mint a token and walk back into
	 * the room. `startedAt` is restored from the record so the timer reads the
	 * whole call, not the part since the reload. If the room turns out to be
	 * empty — they hung up while we were gone — this ends quietly through the
	 * normal "ended" surface rather than erroring.
	 */
	async rejoin() {
		const record = this.state.rejoinable;
		if (!record || this.state.status !== "idle") return;

		this.clearTimers();
		// One shot: a rejoin that fails must not re-offer itself forever.
		this.clearStoredCall();
		this.set({
			status: "connecting",
			// Deliberately `true`: logIfCaller only logs from the caller's side,
			// and the original placement already logged (or never will). A
			// rejoined leg logging a second row would double the call in the
			// thread.
			isIncoming: true,
			peer: record.peer,
			conversationId: record.conversationId,
			isVideo: record.isVideo,
			minimized: false,
			micOn: true,
			camOn: record.isVideo,
			endReason: null,
			error: null,
			startedAt: record.startedAt,
			rejoinable: null,
		});

		const joined = await this.joinRoom(record.conversationId, record.isVideo);
		if (!joined) return; // joinRoom already surfaced the failure.

		// The other side may already be in the room — the connect event alone
		// would never fire for them (same reason acceptCall syncs).
		this.syncRemote();

		// Fresh read: `set()` mutates behind TS's control-flow narrowing.
		if (this.getState().status === "connecting") {
			this.rejoinTimer = setTimeout(() => {
				if (this.state.status === "connecting") this.finish("ended");
			}, REJOIN_GRACE_MS);
		}
	}

	/** Decline the rejoin offer and forget the interrupted call. */
	dismissRejoin() {
		this.clearStoredCall();
		if (this.state.rejoinable) this.set({ rejoinable: null });
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

			const { Room: LiveKitRoom } = await loadLiveKit();
			const room = new LiveKitRoom({
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
			// The token endpoint refuses with a sentence — 503 "Calling is not
			// configured on this server" when LiveKit env is missing, 403 for
			// a rule. Production ran for a day with calls dead and every
			// caller shown "Couldn't connect the call", which reads as *their*
			// network; the real reason was in the discarded response body.
			const reason = err?.response?.data?.message;
			this.fail(
				denied
					? "Microphone permission is blocked"
					: reason || "Couldn't connect the call",
			);
			return false;
		}
	}

	private bindRoom(room: Room) {
		room
			.on(LK().RoomEvent.ParticipantConnected, () => this.syncRemote())
			.on(LK().RoomEvent.ParticipantDisconnected, () => {
				// In a 1:1 call the other side leaving is the call ending.
				if (room.remoteParticipants.size === 0) {
					this.finish("ended");
				}
			})
			.on(LK().RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
				this.remoteTracks.set(track.sid ?? track.kind, track);
				this.syncRemote();
			})
			.on(LK().RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
				this.remoteTracks.delete(track.sid ?? track.kind);
				this.syncRemote();
			})
			.on(LK().RoomEvent.TrackMuted, () => this.syncRemote())
			.on(LK().RoomEvent.TrackUnmuted, () => this.syncRemote())
			.on(LK().RoomEvent.ConnectionQualityChanged, (quality) => {
				this.set({
					poorConnection:
						quality === LK().ConnectionQuality.Poor ||
						quality === LK().ConnectionQuality.Lost,
				});
			})
			.on(LK().RoomEvent.Disconnected, () => {
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
			// A rejoin arrives here with the original `startedAt` restored so
			// the timer stays honest; every other path arrives with null.
			this.set({
				status: "connected",
				startedAt: this.state.startedAt ?? Date.now(),
			});
			// From here a reload should be able to find its way back: remember
			// the call, and keep the record's `at` fresh while it runs.
			this.persistActiveCall();
			this.persistTimer = setInterval(
				() => this.persistActiveCall(),
				PERSIST_HEARTBEAT_MS,
			);
		}

		const mic = remote.getTrackPublication(LK().Track.Source.Microphone);
		const cam = remote.getTrackPublication(LK().Track.Source.Camera);
		this.set({
			remoteMuted: mic ? mic.isMuted : false,
			remoteVideoOn: Boolean(cam && !cam.isMuted && cam.isSubscribed),
		});
	}

	// ---------------------------------------------------- reload persistence

	/** Stamp the connected call into sessionStorage so a reload can offer it back. */
	private persistActiveCall() {
		const { conversationId, isVideo, peer, startedAt, status } = this.state;
		if (status !== "connected" || !conversationId || !peer || !startedAt)
			return;
		try {
			const record: StoredActiveCall = {
				conversationId,
				isVideo,
				peerJson: JSON.stringify(peer),
				startedAt,
				at: Date.now(),
			};
			sessionStorage.setItem(ACTIVE_CALL_KEY, JSON.stringify(record));
		} catch {
			/* storage unavailable — the call just isn't rejoinable */
		}
	}

	private clearStoredCall() {
		try {
			sessionStorage.removeItem(ACTIVE_CALL_KEY);
		} catch {
			/* nothing to clear */
		}
	}

	/**
	 * Once per page load: if a call was connected less than two minutes ago in
	 * this tab, surface it as `rejoinable`. Never auto-joins — walking back
	 * into a room unannounced with a live microphone is the user's call to
	 * make, not ours.
	 */
	private restoreRejoinable() {
		if (this.rejoinChecked) return;
		this.rejoinChecked = true;
		try {
			const raw = sessionStorage.getItem(ACTIVE_CALL_KEY);
			if (!raw) return;
			const record = JSON.parse(raw) as Partial<StoredActiveCall>;
			const fresh =
				typeof record?.at === "number" &&
				Date.now() - record.at < REJOIN_WINDOW_MS;
			const peer = record?.peerJson
				? (JSON.parse(record.peerJson) as CallPeer)
				: null;
			if (!fresh || !peer?.id || !record?.conversationId) {
				this.clearStoredCall();
				return;
			}
			// A call already in progress (e.g. someone rang the instant the
			// page came back) outranks a stale offer.
			if (this.state.status !== "idle") return;
			this.set({
				rejoinable: {
					conversationId: record.conversationId,
					isVideo: Boolean(record.isVideo),
					peer,
					startedAt:
						typeof record.startedAt === "number"
							? record.startedAt
							: Date.now(),
				},
			});
		} catch {
			this.clearStoredCall();
		}
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
		// A finished call is not rejoinable — except when this finish IS the
		// page unloading (CallProvider hangs up on beforeunload): that record
		// is exactly what the reload needs, so it survives.
		if (!this.unloading) this.clearStoredCall();
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
		if (this.persistTimer) clearInterval(this.persistTimer);
		if (this.rejoinTimer) clearTimeout(this.rejoinTimer);
		this.ringTimer = null;
		this.teardownTimer = null;
		this.persistTimer = null;
		this.rejoinTimer = null;
	}

	private reset() {
		this.clearTimers();
		if (!this.unloading) this.clearStoredCall();
		this.disconnectRoom();
		// `error` survives one beat longer than the rest so a failure message
		// isn't wiped before it can be read; the UI clears it on next action.
		this.state = { ...IDLE_STATE, error: this.state.error };
		this.listeners.forEach((l) => l({ ...this.state }));
	}
}

export const callManager = CallManager.getInstance();
