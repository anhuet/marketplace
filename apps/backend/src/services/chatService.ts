import { prisma } from '../lib/prisma';
import { Message } from '@prisma/client';

export async function findOrCreateConversation(listingId: string, buyerId: string) {
  // Upsert: unique constraint on (listingId, buyerId)
  return prisma.conversation.upsert({
    where: { listingId_buyerId: { listingId, buyerId } },
    create: { listingId, buyerId },
    update: {},
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          status: true,
          sellerId: true,
          images: { orderBy: { order: 'asc' }, take: 1 },
        },
      },
      buyer: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });
}

export async function getUserConversations(userId: string) {
  // Get all conversations where user is buyer or seller
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: userId }, { listing: { sellerId: userId } }],
    },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          status: true,
          sellerId: true,
          images: { orderBy: { order: 'asc' }, take: 1 },
        },
      },
      buyer: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Attach unread count per conversation
  const withUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          readAt: null,
        },
      });
      return { ...conv, unreadCount };
    }),
  );

  return withUnread;
}

export async function getConversationMessages(
  conversationId: string,
  cursor?: string,
  limit = 30,
) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<Message> {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, content },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return message;
}

export async function markMessagesRead(conversationId: string, readerId: string) {
  return prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: readerId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function isConversationParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { listing: { select: { sellerId: true } } },
  });
  if (!conv) return false;
  return conv.buyerId === userId || conv.listing.sellerId === userId;
}
