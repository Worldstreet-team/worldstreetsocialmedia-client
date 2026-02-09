"use client";

import EllipsisIcon from "@/assets/icons/EllipsisIcon";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";

export interface PostProps {
	author: {
		name: string;
		username: string;
		avatar: string;
		isVerified?: boolean;
	};
	content: string;
	timestamp: string;
	stats: {
		replies: number;
		reposts: number;
		likes: number;
	};
	images?: string[];
	id: string;
}

export function PostCard({ post }: { post: PostProps }) {
	const images = post.images || [];

	const getImageGridClass = (count: number) => {
		switch (count) {
			case 1:
				return "grid-cols-1 grid-rows-1 h-auto aspect-[16/9]";
			case 2:
				return "grid-cols-2 grid-rows-1 h-[290px]";
			case 3:
				return "grid-cols-2 grid-rows-2 h-[290px]";
			case 4:
				return "grid-cols-2 grid-rows-2 h-[290px]";
			default:
				return "grid-cols-1";
		}
	};

	const getImageStyle = (index: number, total: number) => {
		if (total === 3) {
			if (index === 0) return "row-span-2";
		}
		return "";
	};

	return (
		<article className="p-4 border-b border-black/10 cursor-pointer transition-colors">
			<div className="flex gap-3">
				<div
					className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0"
					style={{ backgroundImage: `url('${post.author.avatar}')` }}
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1">
						<span className="font-bold hover:underline">
							{post.author.name}
						</span>
						{post.author.isVerified && <VerifiedIcon />}
						<span className="text-text-light font-semibold text-sm truncate">
							@{post.author.username} · {post.timestamp}
						</span>
						<button className="ml-auto text-text-light hover:text-primary hover:bg-primary/10 rounded-full p-1 hover:bg-black/5 transition-all ease-in-out duration-300 cursor-pointer border-black/10 border-[0.5px]">
							<EllipsisIcon />
						</button>
					</div>
					<p className="text-[14px] text-black/75 font-semibold leading-normal mb-3 whitespace-pre-wrap">
						{post.content}
					</p>

					{images.length > 0 && (
						<div
							className={`grid gap-0.5 rounded-2xl overflow-hidden mb-3 w-full border border-black/10 ${getImageGridClass(images.length)}`}
						>
							{images.slice(0, 4).map((src, index) => (
								<div
									key={index}
									className={`relative w-full h-full bg-cover bg-center ${getImageStyle(index, images.length)}`}
									style={{ backgroundImage: `url('${src}')` }}
									onClick={(e) => {
										e.stopPropagation();
										// Handle image click (e.g. open lightbox)
									}}
								/>
							))}
						</div>
					)}

					<div className="flex items-center justify-between text-text-light max-w-md mt-2">
						<div className="flex items-center gap-1 group">
							<div className="p-2 group-hover:bg-primary/10 group-hover:text-primary rounded-full transition-colors">
								<span className="material-symbols-outlined !text-[18px]">
									chat_bubble
								</span>
							</div>
							<span className="text-[13px] group-hover:text-primary">
								{post.stats.replies}
							</span>
						</div>
						<div className="flex items-center gap-1 group">
							<div className="p-2 group-hover:bg-green-500/10 group-hover:text-green-500 rounded-full transition-colors">
								<span className="material-symbols-outlined !text-[18px]">
									repeat
								</span>
							</div>
							<span className="text-[13px] group-hover:text-green-500">
								{post.stats.reposts}
							</span>
						</div>
						<div className="flex items-center gap-1 group">
							<div className="p-2 group-hover:bg-pink-500/10 group-hover:text-pink-500 rounded-full transition-colors">
								<span className="material-symbols-outlined !text-[18px]">
									favorite
								</span>
							</div>
							<span className="text-[13px] group-hover:text-pink-500">
								{post.stats.likes}
							</span>
						</div>
						<div className="flex items-center gap-1 group">
							<div className="p-2 group-hover:bg-primary/10 group-hover:text-primary rounded-full transition-colors">
								<span className="material-symbols-outlined !text-[18px]">
									ios_share
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}
