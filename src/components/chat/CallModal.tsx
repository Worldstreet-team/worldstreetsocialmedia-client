"use client";

import React, { useEffect, useRef } from "react";
import { useCall } from "@/context/CallContext";

export const CallModal = () => {
    const {
        callState,
        incomingCallData,
        answerCall,
        rejectCall,
        endCall,
        localStream,
        remoteStream,
        isVideoCall,
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    if (callState === "idle") return null;

    // Incoming Call UI
    if (callState === "incoming" && incomingCallData) {
        return (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 shadow-2xl w-80 text-center animate-bounce-in">
                    <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
                        {/* Avatar placeholder */}
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                            {incomingCallData.name[0]?.toUpperCase()}
                        </div>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{incomingCallData.name}</h3>
                    <p className="text-gray-500 mb-6">
                        Incoming {isVideoCall ? "Video" : "Audio"} Call...
                    </p>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={rejectCall}
                            className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-colors"
                        >
                            <span className="material-symbols-outlined block text-2xl">
                                call_end
                            </span>
                        </button>
                        <button
                            onClick={answerCall}
                            className="bg-green-500 text-white p-3 rounded-full hover:bg-green-600 transition-colors animate-pulse"
                        >
                            <span className="material-symbols-outlined block text-2xl">
                                call
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Active/Outgoing Call UI
    if (
        callState === "outgoing" ||
        callState === "connected" ||
        callState === "ended"
    ) {
        return (
            <div className="fixed inset-0 z-100 bg-black/90 flex flex-col items-center justify-center">
                <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
                    {/* Remote Video (Large) */}
                    {remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain bg-black"
                        />
                    ) : (
                        <div className="text-white text-xl animate-pulse">
                            {callState === "outgoing"
                                ? "Calling..."
                                : "Waiting for video..."}
                        </div>
                    )}

                    {/* Local Video (Small, PIP) */}
                    {localStream && isVideoCall && (
                        <div className="absolute top-4 right-4 w-32 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                        </div>
                    )}

                    {/* Controls */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900/50 backdrop-blur-md p-4 rounded-full">
                        <button
                            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            onClick={() => {
                                // Toggle Mute logic (needs implementation in context)
                            }}
                        >
                            <span className="material-symbols-outlined block">mic</span>
                        </button>
                        
                        {isVideoCall && (
                            <button
                                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                onClick={() => {
                                    // Toggle Camera logic
                                }}
                            >
                                <span className="material-symbols-outlined block">
                                    videocam
                                </span>
                            </button>
                        )}

                        <button
                            onClick={endCall}
                            className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                        >
                            <span className="material-symbols-outlined block text-2xl">
                                call_end
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
