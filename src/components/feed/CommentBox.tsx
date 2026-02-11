"use client";

import { useState, useRef } from "react";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { replyToPostAction } from "@/lib/post.actions";
import { useRouter } from "next/navigation";

interface CommentBoxProps {
	postId: string;
	onCommentAdded?: () => void;
}

export function CommentBox({ postId, onCommentAdded }: CommentBoxProps) {
	const [content, setContent] = useState("");
	const [loading, setLoading] = useState(false);
	const user = useAtomValue(userAtom);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const router = useRouter();

	const handleSubmit = async () => {
		if (!content.trim() || !user) return;

		setLoading(true);
		try {
			const result = await replyToPostAction(postId, content);
			if (result.success) {
				setContent("");
				if (textareaRef.current) {
					textareaRef.current.style.height = "auto";
				}
				if (onCommentAdded) {
					onCommentAdded();
				}
				router.refresh();
			}
		} catch (error) {
			console.error("Failed to post reply:", error);
		} finally {
			setLoading(false);
		}
	};

	if (!user) return null;

	return (
		<div className="flex gap-3 p-4 border-b border-black/10">
			<div
				className="w-10 h-10 mt-3 rounded-full bg-cover bg-center shrink-0"
				style={{ backgroundImage: `url('${user.avatar}')` }}
			/>
			<div className="flex-1">
				<div className="relative">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => {
							setContent(e.target.value);
							e.target.style.height = "auto";
							e.target.style.height = `${e.target.scrollHeight}px`;
						}}
						placeholder="Post your reply"
						className="w-full bg-transparent border-none text-[17px] placeholder:text-text-light/80 resize-none outline-none min-h-[40px] py-3"
						disabled={loading}
					/>
				</div>
				<div className="flex justify-end mt-2 border-t border-black/5 pt-3">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!content.trim() || loading}
						className="bg-black cursor-pointer text-white font-bold rounded-full px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
					>
						{loading ? "Replying..." : "Reply"}
					</button>
				</div>
			</div>
		</div>
	);
}
