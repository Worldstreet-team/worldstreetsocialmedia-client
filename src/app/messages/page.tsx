import { MessageBox } from "@/components/messages/MessageBox";
import { getConversationsAction } from "@/lib/conversation.actions";

export default async function MessagesPage() {
	const { data: conversations } = await getConversationsAction();

	return <MessageBox initialConversations={conversations || []} />;
}
