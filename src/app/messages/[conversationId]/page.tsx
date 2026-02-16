import { MessageBox } from "@/components/messages/MessageBox";
import { getConversationsAction } from "@/lib/conversation.actions";

interface PageProps {
	params: Promise<{
		conversationId: string;
	}>;
}

export default async function ConversationPage({ params }: PageProps) {
	const { conversationId } = await params;
	const { data: conversations } = await getConversationsAction();

	return (
		<MessageBox
			initialConversationId={conversationId}
			initialConversations={conversations || []}
		/>
	);
}
