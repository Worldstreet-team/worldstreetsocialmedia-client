"use client";

import { PostCard, type PostProps } from "@/components/feed/PostCard";

const bookmarkedPosts: PostProps[] = [
	{
		id: "bookmark-1",
		author: {
			name: "Design Daily",
			username: "designdaily",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuDQ-g1I6K8e9YpBJKk7qN9QyU7Mh3o4I_5ZpL6XW-8VwT2jSOmR_nE0C1F4bH5D6A3kL9mJ8Gq7O2P-5rS3N4I6X9YZ0QW1E8K7M2vA5U6F4D3H9J1R8T7L6C2X5E9B4A8M3V7K1N0O6P5Q2I4J9H8G3F7E1C5D9B3A2M0K4L6N5O8P1Q0R2S4T6U8V",
		},
		timestamp: "2d",
		content: "Top 10 fonts for 2026. Thread 🧵👇 #typography #design",
		images: [
			"https://lh3.googleusercontent.com/aida-public/AB6AXuCVh8p3iIVB6V8SmlrlYhTYWcYKtbi1qAwIQl3p699QnBtz2ery9QBZekmokbzjOXzYF5frjM8R7ARMtmQB6nxSZi64f7NerLQ7qGEcIt2yl8HmIOmElLD9vvPsDgz-rHHV64QlGEJ_EV4xpBfyYCx1qBycp3FL959LShnq007ra5467_vkjYyUqisNvZKv3m86lX1dZoj63dTuvEzUFto3QRrPkMAK8WMEZAxi0JbbFowvF9pBwhC7djdOs5EkUd44L02u8cE66tM0",
		],
		stats: {
			replies: 56,
			reposts: 230,
			likes: 1200,
		},
	},
	{
		id: "bookmark-2",
		author: {
			name: "Code Master",
			username: "codemaster",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n",
		},
		timestamp: "1w",
		content: "Stop using useEffect for everything. Here is why. 👇",
		stats: {
			replies: 120,
			reposts: 450,
			likes: 3400,
		},
	},
];

export default function BookmarksPage() {
	return (
		<div className="flex flex-col min-h-screen">
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border-gray">
				<div className="px-4 py-3">
					<h1 className="text-xl font-bold">Bookmarks</h1>
					<div className="text-text-light text-[13px]">@alexrivera</div>
				</div>
			</header>

			<div className="flex flex-col">
				{bookmarkedPosts.map((post, index) => (
					<PostCard key={index} post={post} />
				))}
				{bookmarkedPosts.length === 0 && (
					<div className="p-8 text-center">
						<h2 className="text-2xl font-bold mb-2">Save posts for later</h2>
						<p className="text-text-light">
							Bookmark posts to easily find them again in the future.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
