"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { getAccessToken } from "@/lib/auth.actions";

interface SocketContextType {
	socket: Socket | null;
	onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
	const user = useAtomValue(userAtom);

	// useEffect(() => {
	// 	const initSocket = async () => {
	// 		if (!user) {
	// 			if (socket) {
	// 				socket.close();
	// 				setSocket(null);
	// 			}
	// 			return;
	// 		}
	// 		const token = await getAccessToken();

	// 		if (token) {
	// 			const socketInstance = io("http://localhost:2500", {
	// 				auth: {
	// 					token: token,
	// 				},
	// 			});

	// 			// socketInstance.on("connect", () => {
	// 			// 	console.log("Socket connected:", socketInstance.id);
	// 			// });

	// 			socketInstance.on("get_online_users", (users: string[]) => {
	// 				setOnlineUsers(users);
	// 			});

	// 			setSocket(socketInstance);

	// 			return () => {
	// 				socketInstance.close();
	// 				setSocket(null);
	// 			};
	// 		}
	// 	};

	// 	initSocket();

	// 	return () => {
	// 		if (socket) {
	// 			socket.close();
	// 		}
	// 	};
	// }, [user, socket]);

	return (
		<SocketContext.Provider value={{ socket, onlineUsers }}>
			{children}
		</SocketContext.Provider>
	);
};

export const useSocket = () => {
	const context = useContext(SocketContext);
	if (!context) {
		throw new Error("useSocket must be used within a SocketProvider");
	}
	return context;
};
