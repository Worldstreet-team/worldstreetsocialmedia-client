import { InboxThumb } from "@/components/messages/ConversationList";

/**
 * The stand-in while the messages route resolves.
 *
 * It is the inbox's own layout with the data missing (owner 2026-09-20:
 * "let the skeleton loaders match the layout"): the same padded column of
 * frosted blocks, the masthead with its search well, the thumb, the chats
 * block with its heading, the faces rail and rows at the row's own
 * geometry. Anything already known, the titles and the shapes, is drawn
 * for real; only what the network owes is grey.
 */
export default function MessagesLoading() {
	return (
		<div className="flex h-dvh items-stretch" aria-busy="true">
			<div className="flex w-full shrink-0 flex-col gap-2 p-2 md:w-[372px] md:gap-3 md:p-3">
				<div className="shrink-0 rounded-2xl glass-frost backdrop-blur-xl px-4 pb-3 pt-4">
					<div className="mb-3 flex items-center gap-2">
						<h1 className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tracking-tight text-primary">
							Messages
						</h1>
					</div>
					<div className="h-10 w-full rounded-pill bg-primary/5" />
				</div>

				<div className="mx-auto h-1 w-10 shrink-0 rounded-pill bg-primary/15" />

				<div className="flex min-h-0 flex-col rounded-2xl px-2 pb-2 pt-4 glass-frost backdrop-blur-xl">
					<div className="mb-3 px-4">
						<h2 className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tracking-tight text-primary">
							Chats
						</h2>
					</div>
					<div aria-hidden className="mb-1 flex gap-1 overflow-hidden px-2 pb-2">
						{[0, 1, 2, 3, 4].map((i) => (
							<span
								key={i}
								className="flex w-[62px] shrink-0 flex-col items-center gap-1 py-1"
							>
								<span className="skeleton h-12 w-12 rounded-pill" />
								<span className="skeleton h-[11px] w-9 rounded-[4px]" />
							</span>
						))}
					</div>
					<InboxThumb />
					{[0, 1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="flex w-full items-center gap-3 rounded-xl px-3 py-2"
						>
							<span className="skeleton h-12 w-12 shrink-0 rounded-pill" />
							<span className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span
									className="skeleton h-[15px] rounded-[4px]"
									style={{ width: `${[46, 62, 38, 54, 44, 58, 40][i]}%` }}
								/>
								<span
									className="skeleton h-[13px] rounded-[4px]"
									style={{ width: `${[70, 52, 64, 44, 74, 48, 60][i]}%` }}
								/>
							</span>
							<span className="skeleton h-[11px] w-7 shrink-0 rounded-[4px]" />
						</div>
					))}
				</div>
			</div>

			{/* The thread pane: one card, the same one a chat rides in. */}
			<div className="hidden min-w-0 flex-1 p-3 md:block">
				<div className="h-full rounded-2xl glass-frost backdrop-blur-xl" />
			</div>
		</div>
	);
}
