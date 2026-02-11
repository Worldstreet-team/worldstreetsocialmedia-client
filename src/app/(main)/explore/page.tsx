"use client";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import SearchIcon from "@/assets/icons/SearchIcon";

const mockPosts: PostProps[] = [
	{
		id: "explore-1",
		author: {
			id: "explore-1",
			firstName: "Tech",
			lastName: "Insider",
			username: "techinsider",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n",
			isVerified: true,
		},
		timestamp: "5h",
		content:
			"The future of AI is here. Check out how these new models are changing the landscape of development. #AI #Tech",
		stats: {
			replies: 45,
			reposts: 120,
			likes: 890,
		},
	},
	{
		id: "explore-2",
		author: {
			id: "explore-2",
			firstName: "Travel",
			lastName: "Diaries",
			username: "traveldiaries",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCXdk5dh86NTCbKe4uLLFK5NqhYzhGpxA4AKvVrCW_HKiw-9qxPrPfb9laqZrDl8Lo2e97tBII8c03MKmx2qk0kVMiqVnvpdSPZda5BIs5KPxs0uwVkNA8ciklAYsXYTHEmVVzTOmFeESPrOyBKl4tq8Wt0JAVkLoLq6-nwtSYAMOqgIpMtKivBasXLe2DdhG4CuUANRO0XlW-a6E9NLpobOgevAw5yu-vRVem1WIBOU-XMHrf2j_liJ5z8--zw8cWW0OzCdxfUuwlF",
		},
		timestamp: "8h",
		content: "Kyoto in autumn is simply magical. 🍁",
		images: [
			"https://lh3.googleusercontent.com/aida-public/AB6AXuDG5uXBy6ddbZYQNZb43b3fa8NYmCX8a3qejtGSMFIAqHL3kSFIACPka2xX7RNs85RQUHaKXegQDBE9VzW-iqQfJC2gxqfGxKGEeZWN8hQioAjddWSf6pI-VR-NWfga6VsbxYmB953BbFDElaS0AfoX6BlTxwrc4nPhMvqjrhdni1XxxadNWaQ68JLvpz_ASE5upUaMHmzCSuv82doEPNqpD58WUo3Wuwl3Nwcea3O6Rz7Q8AA5Ctq4PclYnHKFScei_iiObCIaD34e",
		],
		stats: {
			replies: 12,
			reposts: 55,
			likes: 430,
		},
	},
];

const trendingTopics = [
	{
		category: "Technology • Trending",
		title: "Quantum Computing",
		posts: "12.5K posts",
	},
	{
		category: "Sports • Trending",
		title: "World Cup Finals",
		posts: "540K posts",
	},
	{
		category: "Entertainment • Trending",
		title: "#NewMovieRelease",
		posts: "85K posts",
	},
	{
		category: "Business • Trending",
		title: "Stock Market Rally",
		posts: "22K posts",
	},
];

export default function ExplorePage() {
	return (
		<div className="flex flex-col min-h-screen">
			{/* Search Header */}
			<div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 py-2 border-b border-border-gray">
				<div className="relative group">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-search-icon group-focus-within:text-primary transition-colors">
						<SearchIcon
							size={{ width: "20", height: "20" }}
							color="currentColor"
						/>
					</div>
					<input
						type="text"
						placeholder="Search World Street"
						className="w-full bg-search-bg rounded-full py-2.5 pl-12 pr-4 outline-none border border-transparent focus:bg-white focus:border-primary/50 transition-all placeholder:text-text-light text-[15px]"
					/>
				</div>
			</div>

			{/* Trending Topics */}
			<div className="py-3 border-b border-border-gray">
				<h2 className="px-4 py-2 text-xl font-extrabold">Trends for you</h2>
				<div className="flex flex-col">
					{trendingTopics.map((topic, i) => (
						<div
							key={i}
							className="px-4 py-3 hover:bg-black/3 transition-colors cursor-pointer flex justify-between items-start"
						>
							<div>
								<div className="text-[13px] text-text-light font-medium">
									{topic.category}
								</div>
								<div className="font-bold text-[15px] pt-0.5">
									{topic.title}
								</div>
								<div className="text-[13px] text-text-light pt-0.5">
									{topic.posts}
								</div>
							</div>
							<button
								className="w-8 h-8 rounded-full hover:bg-primary/10 flex items-center justify-center text-text-light group"
								type="button"
							>
								<span className="material-symbols-outlined text-[20px] group-hover:text-primary">
									more_horiz
								</span>
							</button>
						</div>
					))}
				</div>
			</div>

			{/* Posts Feed for Explore */}
			<div className="flex flex-col">
				<h2 className="px-4 py-4 text-xl font-extrabold border-b border-border-gray">
					Popular Tweets
				</h2>
				{mockPosts.map((post) => (
					<PostCard key={post.id} post={post} />
				))}
			</div>
		</div>
	);
}
