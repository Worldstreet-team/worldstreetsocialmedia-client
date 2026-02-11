"use client";

import { SocketProvider } from "@/context/SocketContext";
import { CallProvider } from "@/context/CallContext";
import { CallModal } from "@/components/chat/CallModal";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SocketProvider>
			<CallProvider>
				<CallModal />
				{children}
			</CallProvider>
		</SocketProvider>
	);
}
