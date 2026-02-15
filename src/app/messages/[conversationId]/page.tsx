import { MessageBox } from "@/components/messages/MessageBox";

interface PageProps {
	params: Promise<{
		conversationId: string;
	}>;
}

export default async function ConversationPage({ params }: PageProps) {
	const { conversationId } = await params;
	return <MessageBox initialConversationId={conversationId} />;
}
