"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import { BACKEND_URL, JWT_TOKEN, REFRESH_TOKEN } from "@/const";
import GlobeIcon from "@/assets/icons/GlobeIcon";
import { updateSession } from "@/lib/auth.actions";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";

const AVATARS = [
    "/avatars/avatar-1.png",
    "/avatars/avatar-2.png",
    "/avatars/avatar-3.png",
];

const INTERESTS = [
    "Technology", "Crypto", "Art", "Music", "Gaming", 
    "Finance", "Travel", "Food", "Fashion", "Sports"
];

// Mock Suggested Users for Step 3
const SUGGESTED_USERS = [
    { id: "1", username: "crypto_king", name: "Crypto King", avatar: "/avatars/avatar-1.png" },
    { id: "2", username: "art_lover", name: "Art Lover", avatar: "/avatars/avatar-2.png" },
    { id: "3", username: "tech_guru", name: "Tech Guru", avatar: "/avatars/avatar-3.png" },
];

interface OnboardingProps {
    accessToken?: string;
    refreshToken?: string;
    userData?: any;
}

const Onboarding = ({ accessToken, refreshToken, userData    }: OnboardingProps) => {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    // Prioritize prop token (from cookie), then constant
    const [token, setToken] = useState(accessToken || JWT_TOKEN);
    const activeRefreshToken = refreshToken || REFRESH_TOKEN;
    const setUser = useSetAtom(userAtom);


    const [formData, setFormData] = useState({
        username: "",
        bio: "",
        avatar: AVATARS[0],
        interests: [] as string[],
    });

    useEffect(() => {
        if (userData) {
            setFormData((prev) => ({
                ...prev,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role
            }));
        }
    }, [userData]);

    const toggleInterest = (interest: string) => {
        setFormData((prev) => {
            if (prev.interests.includes(interest)) {
                return { ...prev, interests: prev.interests.filter((i) => i !== interest) };
            } else {
                return { ...prev, interests: [...prev.interests, interest] };
            }
        });
    };

    const refreshAndRetry = async (retryAction: (newToken: string) => Promise<void>) => {
        try {
            console.log("Attempting to refresh token...");
            const res = await axios.post("https://api.worldstreetgold.com/api/auth/refresh-token", {
                refreshToken: activeRefreshToken
            });

            if (res.data.success && res.data.data?.tokens) {
                const newAccessToken = res.data.data.tokens.accessToken;
                const newRefreshToken = res.data.data.tokens.refreshToken;
                
                console.log("Token refresh successful");
                setToken(newAccessToken);
                await updateSession(newAccessToken, newRefreshToken);
                
                // Retry the action with the new token
                await retryAction(newAccessToken);
            } else {
                throw new Error("Refresh failed");
            }
        } catch (err) {
            console.error("Refresh Logic Failed:", err);
            setError("Session expired. Please login again.");
        }
    };

    const submitProfile = async (overrideToken?: string) => {
        setLoading(true);
        setError("");
        const activeToken = overrideToken || token;

        try {
            const res = await axios.post(`${BACKEND_URL}/api/users/onboard`, formData, {
                headers: { Authorization: `Bearer ${activeToken}` } 
            });
            
            if (res.data) {
                setUser(res.data);
            }

            setStep(3); // Move to Step 3 (Connect)
        } catch (err: any) {
            console.error("Onboarding Error:", err);
            if (err.response?.status === 401 && !overrideToken) {
                await refreshAndRetry(submitProfile);
            } else {
                setError(err.response?.data?.message || err.message || "Failed to create profile");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId: string) => {
        // Optimistic UI update or simple toast could go here
        console.log("Following", userId);
        // await axios.post ...
    };

    const finishOnboarding = () => {
        router.push("/");
        router.refresh();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-gray-100 overflow-hidden">
                {/* Header / Progress */}
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-full text-primary">
                             <div className="w-5 h-5"><GlobeIcon /></div>
                        </div>
                        <span className="font-bold text-gray-900 tracking-tight">WorldStreet</span>
                    </div>
                    <div className="flex gap-2">
                         {[1, 2, 3].map((s) => (
                             <div key={s} className={`h-2 w-8 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-gray-200"}`} />
                         ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold text-gray-900">Who are you?</h1>
                                <p className="text-gray-500 text-sm mt-1">Choose an avatar and set up your identity.</p>
                            </div>

                            <div className="flex justify-center gap-4">
                                {AVATARS.map((avatar, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setFormData({ ...formData, avatar })}
                                        className={`cursor-pointer relative w-20 h-20 rounded-full overflow-hidden border-2 transition-all ${
                                            formData.avatar === avatar ? "border-primary scale-110 ring-2 ring-primary ring-offset-2" : "border-transparent opacity-60 hover:opacity-100"
                                        }`}
                                    >
                                        <Image src={avatar} alt="Avatar" fill className="object-cover" />
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="@username"
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-1 border-black/10 focus:bg-white focus:ring-0 focus:border-black outline-none transition-all duration-300 placeholder-gray-400 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Tell us about yourself..."
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-1 border-black/10 focus:bg-white focus:ring-0 focus:border-black outline-none transition-all duration-300 placeholder-gray-400 font-medium resize-none"
                                    />
                                </div>
                            </div>
                            
                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.username}
                                className="w-full py-3.5 rounded-full bg-black hover:bg-black/80 text-white font-bold text-base transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-black/50 cursor-pointer"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* STEP 2: INTERESTS */}
                    {step === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                             <div className="text-center">
                                <h1 className="text-2xl font-bold text-gray-900">What are you into?</h1>
                                <p className="text-gray-500 text-sm mt-1">Select topics to personalize your feed.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {INTERESTS.map((interest) => (
                                    <button
                                        key={interest}
                                        onClick={() => toggleInterest(interest)}
                                        className={`cursor-pointer px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border ${
                                            formData.interests.includes(interest)
                                                ? "bg-black text-white border-black"
                                                : "bg-white text-gray-600 border-black/5 hover:border-black/10"
                                        }`}
                                    >
                                        {interest}
                                    </button>
                                ))}
                            </div>

                            {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3.5 rounded-full bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-all cursor-pointer"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => submitProfile()}
                                    disabled={loading}
                                    className="flex-[2] py-3.5 rounded-full bg-black text-white font-bold transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center cursor-pointer"
                                >
                                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Profile"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: SUGGESTIONS */}
                    {step === 3 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold text-gray-900">Follow People</h1>
                                <p className="text-gray-500 text-sm mt-1">Build your community.</p>
                            </div>

                            <div className="space-y-4">
                                {SUGGESTED_USERS.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-full overflow-hidden">
                                                <Image src={user.avatar} alt={user.username} fill className="object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{user.name}</p>
                                                <p className="text-xs text-gray-500">@{user.username}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleFollow(user.id)}
                                            className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:border-primary hover:text-primary transition-all"
                                        >
                                            Follow
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={finishOnboarding}
                                className="w-full py-3.5 rounded-full bg-black text-white font-bold text-sm transition-all active:scale-95 cursor-pointer"
                            >
                                All Done! 🚀
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;