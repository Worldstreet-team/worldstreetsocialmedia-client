"use client";

import { SocketProvider } from "@/context/SocketContext";
import { CallProvider } from "@/context/CallContext";
import { CallModal } from "@/components/chat/CallModal";
import { Toast } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SocketProvider>
			<CallProvider>
				<CallModal />
				<Toast />
				{children}
			</CallProvider>
		</SocketProvider>
	);
}
