import { MessageBox } from "@/components/messages/MessageBox";
import { getConversationsAction } from "@/lib/conversation.actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

// getConversationsAction swallows errors in a try/catch, which also swallows
// Next's DYNAMIC_SERVER_USAGE signal — without this the build logs a bogus
// "couldn't be rendered statically" error while prerendering this route.
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
	const { data: conversations } = await getConversationsAction();

	return <MessageBox initialConversations={conversations || []} />;
}
