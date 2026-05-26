import { prisma } from '../lib/prisma';
import { Message } from '@prisma/client';
import { getPresignedUrl } from '../lib/s3';
import { presignAvatarUrl } from '../lib/userPresign';

export async function findOrCreateConversation(listingId: string, buyerId: string) {
  // Upsert: unique constraint on (listingId, buyerId)
  const conv = await prisma.conversation.upsert({
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

  const buyerAvatarUrl = await presignAvatarUrl(conv.buyer.avatarUrl);
  return { ...conv, buyer: { ...conv.buyer, avatarUrl: buyerAvatarUrl } };
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
          seller: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
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

  // Presign cover images, seller avatar, buyer avatar + attach unread count per conversation
  const withPresignedAndUnread = await Promise.all(
    conversations.map(async (conv) => {
      const [unreadCount, images, sellerAvatarUrl, buyerAvatarUrl] = await Promise.all([
        prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            readAt: null,
          },
        }),
        Promise.all(
          conv.listing.images.map(async (img) => {
            let url = img.url;
            try {
              url = await getPresignedUrl(img.url);
            } catch {
              // fall back to stored URL
            }
            return { ...img, url };
          }),
        ),
        presignAvatarUrl(conv.listing.seller?.avatarUrl),
        presignAvatarUrl(conv.buyer.avatarUrl),
      ]);

      return {
        ...conv,
        listing: {
          ...conv.listing,
          images,
          seller: conv.listing.seller
            ? { ...conv.listing.seller, avatarUrl: sellerAvatarUrl }
            : conv.listing.seller,
        },
        buyer: { ...conv.buyer, avatarUrl: buyerAvatarUrl },
        unreadCount,
      };
    }),
  );

  return withPresignedAndUnread;
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
