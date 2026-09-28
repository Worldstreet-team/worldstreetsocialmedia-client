"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "@/components/ui/icons";
import { toast } from "sonner";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useGatewayRead } from "@/hooks/useGateway";
import { postJsonDirect } from "@/lib/upload-direct";

interface Preview {
	id: string;
	name?: string;
	avatar?: string;
	description: string;
	memberCount: number;
	faces: { _id: string; firstName?: string; username: string; avatar?: string }[];
	approval: boolean;
	open: boolean;
	why: "NOT_FOUND" | "REVOKED" | "EXPIRED" | "USED_UP" | null;
	alreadyIn: boolean;
}

const WHY: Record<string, string> = {
	NOT_FOUND: "This link doesn't go anywhere.",
	REVOKED: "This link was revoked by an admin.",
	EXPIRED: "This link has expired.",
	USED_UP: "This link has been used up.",
};

/**
 * A group invite link (audit G35 to G38): the safe preview, then Join, or
 * Ask to join when the group wants approval. Nothing from the room shows
 * until you are in. The path is the one every platform shares,
 * /join/<code> (groupLinkPath in the messaging contracts).
 */
export default function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = use(params);
	const router = useRouter();
	const read = useGatewayRead();
	const [preview, setPreview] = useState<Preview | null | "missing">(null);
	const [busy, setBusy] = useState(false);
	const [requested, setRequested] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const res = await read(`/api/messages/groups/links/${encodeURIComponent(code)}`, (b) => b);
			if (cancelled) return;
			setPreview(res.success && res.data?.id ? (res.data as Preview) : "missing");
		})();
		return () => {
			cancelled = true;
		};
	}, [code, read]);

	const join = async () => {
		if (busy) return;
		setBusy(true);
		const res = await postJsonDirect(`/api/messages/groups/links/${encodeURIComponent(code)}/join`);
		setBusy(false);
		if (!res.success) {
			toast.error(res.message || "Couldn't join");
			return;
		}
		if (res.data?.requested) {
			setRequested(true);
			return;
		}
		router.replace(`/messages/${res.data?.conversationId ?? (preview !== "missing" && preview ? preview.id : "")}`);
	};

	return (
		<main id="main-content" className="mx-auto flex min-h-[70dvh] w-full max-w-[440px] flex-col items-center justify-center px-6 py-10 text-center animate-rise">
			{preview === null ? (
				<Loader2 className="h-6 w-6 animate-spin text-muted" />
			) : preview === "missing" ? (
				<>
					<span className="flex h-20 w-20 items-center justify-center rounded-pill bg-raised">
						<Users className="h-8 w-8 text-muted" />
					</span>
					<h1 className="mt-4 font-display text-[calc(20px*var(--ws-fs))] font-semibold text-primary">
						That link doesn't work
					</h1>
					<p className="mt-1 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
						Ask whoever sent it for a new one.
					</p>
				</>
			) : (
				<>
					<span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised">
						{preview.avatar ? <SafeAvatar src={preview.avatar} eager /> : <Users className="h-8 w-8 text-muted" />}
					</span>
					<h1 className="mt-4 font-display text-[calc(22px*var(--ws-fs))] font-semibold text-primary">
						{preview.name ?? "Group"}
					</h1>
					<p className="mt-1 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
						{preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
						{preview.approval ? " · admins approve who joins" : ""}
					</p>
					{preview.description && (
						<p className="mt-3 max-w-[360px] whitespace-pre-wrap break-words font-sans text-[calc(14px*var(--ws-fs))] text-primary">
							{preview.description}
						</p>
					)}
					{preview.faces.length > 0 && (
						<div className="mt-4 flex items-center gap-2">
							<span className="flex -space-x-2">
								{preview.faces.map((f) => (
									<span
										key={f._id}
										className="relative h-8 w-8 overflow-hidden rounded-pill bg-raised ring-2 ring-page"
									>
										<SafeAvatar src={f.avatar} eager />
									</span>
								))}
							</span>
							<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
								{preview.faces.map((f) => f.firstName || f.username).join(", ")}
								{preview.memberCount > preview.faces.length ? " and others" : ""}
							</span>
						</div>
					)}
					<div className="mt-6 w-full">
						{preview.alreadyIn ? (
							<button
								type="button"
								onClick={() => router.replace(`/messages/${preview.id}`)}
								className="flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on"
							>
								Open the group
							</button>
						) : requested ? (
							<p className="rounded-xl bg-primary/5 px-4 py-3 font-sans text-[calc(14px*var(--ws-fs))] text-primary">
								Your request is in. An admin will let you in.
							</p>
						) : !preview.open ? (
							<p className="rounded-xl bg-primary/5 px-4 py-3 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
								{WHY[preview.why ?? "NOT_FOUND"]}
							</p>
						) : (
							<button
								type="button"
								onClick={() => void join()}
								disabled={busy}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
							>
								{busy && <Loader2 className="h-4 w-4 animate-spin" />}
								{preview.approval ? "Ask to join" : "Join group"}
							</button>
						)}
					</div>
				</>
			)}
		</main>
	);
}
