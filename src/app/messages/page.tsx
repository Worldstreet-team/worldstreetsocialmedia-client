"use client";

export default function MessagesPage() {
	return (
		<div className="flex-1 flex flex-col h-full justify-center items-center border-l border-border-gray">
			<div className="max-w-[340px] text-center p-8">
				<h2 className="text-3xl font-extrabold mb-2">Select a message</h2>
				<p className="text-text-light mb-8">
					Choose from your existing conversations, start a new one, or just keep
					swimming.
				</p>
				<button
					className="bg-primary hover:bg-primary-dark text-white font-bold rounded-full px-8 py-3 transition-colors text-lg cursor-pointer"
					type="button"
				>
					New message
				</button>
			</div>
		</div>
	);
}
