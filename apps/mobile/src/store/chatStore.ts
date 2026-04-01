import { create } from 'zustand';
import { ConversationWithDetails, Message } from '@marketplace/shared';

// Message with optimistic pending flag
export interface PendingMessage extends Message {
  pending?: boolean;
  failed?: boolean;
}

interface ChatState {
  conversations: ConversationWithDetails[];
  messagesByConversation: Record<string, PendingMessage[]>;
  // Track which conversation is currently open so unread increments are skipped for it
  activeConversationId: string | null;
  setConversations: (conversations: ConversationWithDetails[]) => void;
  setMessages: (conversationId: string, messages: PendingMessage[]) => void;
  addMessage: (conversationId: string, message: PendingMessage) => void;
  replacePendingMessage: (conversationId: string, pendingId: string, confirmed: Message) => void;
  markMessageFailed: (conversationId: string, pendingId: string) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
  setActiveConversation: (conversationId: string | null) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  conversations: [],
  messagesByConversation: {},
  activeConversationId: null,

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

  replacePendingMessage: (conversationId, pendingId, confirmed) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((m) =>
          m.id === pendingId ? { ...confirmed, pending: false } : m,
        ),
      },
    })),

  markMessageFailed: (conversationId, pendingId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((m) =>
          m.id === pendingId ? { ...m, failed: true, pending: false } : m,
        ),
      },
    })),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount ?? 0) + 1 } : c,
      ),
    })),

  clearUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),

  updateConversationLastMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: message, updatedAt: message.createdAt }
          : c,
      ),
    })),

  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
}));
