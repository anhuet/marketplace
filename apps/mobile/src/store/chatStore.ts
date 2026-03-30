import { create } from 'zustand';
import { ConversationWithDetails, Message } from '@marketplace/shared';

interface ChatState {
  conversations: ConversationWithDetails[];
  messagesByConversation: Record<string, Message[]>;
  setConversations: (conversations: ConversationWithDetails[]) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  incrementUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  conversations: [],
  messagesByConversation: {},
  setConversations: (conversations) => set({ conversations }),
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),
  addMessage: (conversationId, message) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), message],
      },
    })),
  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount ?? 0) + 1 } : c,
      ),
    })),
}));
