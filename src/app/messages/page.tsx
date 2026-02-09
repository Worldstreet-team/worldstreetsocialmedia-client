"use client";

import { useState } from "react";
import MessageIcon from "@/assets/icons/MessageIcon";
import MoreIcon from "@/assets/icons/MoreIcon";

const conversations = [
    {
        id: 1,
        user: {
            name: "Sarah Jenkins",
            username: "sarahj",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n"
        },
        message: "Hey, are we still on for the meeting tomorrow?",
        time: "2h"
    },
    {
        id: 2,
        user: {
            name: "Marcus Wong",
            username: "mwong_dev",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCXdk5dh86NTCbKe4uLLFK5NqhYzhGpxA4AKvVrCW_HKiw-9qxPrPfb9laqZrDl8Lo2e97tBII8c03MKmx2qk0kVMiqVnvpdSPZda5BIs5KPxs0uwVkNA8ciklAYsXYTHEmVVzTOmFeESPrOyBKl4tq8Wt0JAVkLoLq6-nwtSYAMOqgIpMtKivBasXLe2DdhG4CuUANRO0XlW-a6E9NLpobOgevAw5yu-vRVem1WIBOU-XMHrf2j_liJ5z8--zw8cWW0OzCdxfUuwlF"
        },
        message: "Sent you the files!",
        time: "5h"
    },
    {
        id: 3,
        user: {
            name: "Jordan Smith",
            username: "jordy",
            avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDd-evzsvivS30hlWWhs8NK4GS34z0MFLA5ys1E3Xi1Ze3ANPr33B0eo21EVy-ojF_5DOaAZE0B3oFNEkrr_Mg7yUw5MjBFBPl9K0FqUaqfg7kRqt7THyQOFiT-26kEOsmd3DLbSysRcKBwH-ceObCR6X9heUYmSw5DotEK-maSeeV0OdOCRtH8RLjgLjOwwYcT5GKk3JH4tOlCxbirUsuCk5Kikl9XBPwJXR8-J_VDkcTSowSNq6G-XXTq53J7jarGjNf4ml9v8hFW"
        },
        message: "You: Sounds good.",
        time: "1d"
    }
];

export default function MessagesPage() {
    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
        <>
            {/* Conversation List (Left Pane) */}
            <div className="w-[390px] border-r border-border-gray flex flex-col h-screen">
                <div className="px-4 py-3 h-[53px] flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
                    <h1 className="text-xl font-bold">Messages</h1>
                    <div className="flex gap-2">
                        <button className="w-9 h-9 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[20px]">settings</span>
                        </button>
                        <button className="w-9 h-9 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors">
                            <MessageIcon size={{ width: "20", height: "20" }} color="black" />
                        </button>
                    </div>
                </div>

                <div className="px-4 py-2">
                     <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-search-icon group-focus-within:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[18px]">search</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Search Direct Messages"
                            className="w-full bg-search-bg rounded-full py-2 pl-10 pr-4 outline-none border border-transparent focus:bg-white focus:border-primary/50 transition-all placeholder:text-text-light text-[15px]"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {conversations.map((conv) => (
                        <div 
                            key={conv.id} 
                            onClick={() => setSelectedId(conv.id)}
                            className={`px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer flex gap-3 ${selectedId === conv.id ? 'border-r-2 border-primary bg-black/[0.03]' : ''}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url('${conv.user.avatar}')` }}></div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-baseline">
                                    <div className="flex items-center gap-1 truncate">
                                        <span className="font-bold text-[15px] truncate">{conv.user.name}</span>
                                        <span className="text-text-light text-[15px] truncate">@{conv.user.username}</span>
                                    </div>
                                    <span className="text-text-light text-[13px] flex-shrink-0">{conv.time}</span>
                                </div>
                                <div className="text-text-light text-[15px] truncate">
                                    {conv.message}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area (Right Pane) */}
            <div className="flex-1 hidden md:flex flex-col h-screen justify-center items-center border-r border-border-gray">
                {selectedId ? (
                    <div className="w-full h-full flex flex-col">
                        {/* Placeholder for active chat interface */}
                        <div className="flex-1 flex items-center justify-center text-text-light">
                            Chat with {conversations.find(c => c.id === selectedId)?.user.name}
                        </div>
                        <div className="p-4 border-t border-border-gray">
                            <div className="bg-search-bg rounded-2xl px-4 py-3 text-text-light">
                                Start a new message
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-[340px] text-center p-8">
                        <h2 className="text-3xl font-extrabold mb-2">Select a message</h2>
                        <p className="text-text-light mb-8">Choose from your existing conversations, start a new one, or just keep swimming.</p>
                        <button className="bg-primary hover:bg-primary-dark text-white font-bold rounded-full px-8 py-3 transition-colors text-lg">
                            New message
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
