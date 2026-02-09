"use client";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PostDetail() {
    const params = useParams();
    const postId = params.id as string;

    // Mock data - in a real app this would fetch based on postId
    const mainPost: PostProps = {
        author: {
            name: "Sarah Jenkins",
            username: "sarahj",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n",
            isVerified: true,
        },
        timestamp: "2h",
        content:
            "Just finished the core architecture for the new Design System. 🎨 It's amazing how much speed you gain when the foundations are solid. Can't wait to share more soon! #designsystems #uiux",
        stats: {
            replies: 24,
            reposts: 12,
            likes: 182,
        },
    };

    const replies: PostProps[] = [
        {
            author: {
                name: "David Chen",
                username: "dchen_ux",
                avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvQfwAsMWplKuoYCcc4GVJ5FYR849Y8SocXb6EgO1Mm359w0Miqnr98R_fHlpjmp5eMq0fTCQI5iGh4UmFm7x2LYXBoOI5pQhDFqNF7ovLMCBgRv9SM3qKvAFRXzerfOLwul912D1c98WE2xFOa7g9-Lc40ytwgh3tT9UvFCnt6R4W3gtHkuGTLMhag6aqiQqPQdWlGOsNHD_Jto1g7I-Hu5vGoKLC2GR3lCZkuO4LUMxjjCfnXR5qpKfUE67yoFKSIq_qcVRi09Qv",
            },
            timestamp: "1h",
            content:
                "Cannot agree more! Consistency is key. Would love to see a write-up on your approach.",
            stats: {
                replies: 2,
                reposts: 0,
                likes: 14,
            },
        },
        {
            author: {
                name: "Elena Rodriguez",
                username: "erodriguez",
                avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDjrb9wqc1laq0I-KSdwIdLuZ045BVBt98QhfwvwDj3xQO6sKwW8TzVO4C9Z6x3z40STRTl8tDEd2XYe6cSB9GouxR2DRBgFgLYmnyDibRuDD5ZU1OnQrnimCAbxOzJa2xnZfzn4gS-rTnt1dhsIOoKuLkg4dkzD-rO2sLSEqTRQci7XE2hY91o3lRik7cWOlP1TumhyIcd4g5SNYUMHEJDei8i1goxejXojYpJyc7yB7o9w8xtR54oIzZkGdLmJS5bwvdx7sAEieDk",
            },
            timestamp: "45m",
            content: "Looking forward to it! 👀",
            stats: {
                replies: 0,
                reposts: 0,
                likes: 8,
            },
        },
    ];

    return (
        <div className="flex flex-col">
            <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border-gray px-4 py-3 flex items-center gap-4">
                <Link
                    href="/"
                    className="p-2 -ml-2 hover:bg-black/10 rounded-full transition-colors"
                >
                    <span className="material-symbols-outlined !text-[20px]">
                        arrow_back
                    </span>
                </Link>
                <h2 className="text-xl font-bold">Post</h2>
            </header>

            <div className="border-b border-border-gray">
                <PostCard post={mainPost} />
            </div>

            <PostComposer />

            {replies.map((reply, index) => (
                <PostCard key={index} post={reply} />
            ))}
        </div>
    );
}
