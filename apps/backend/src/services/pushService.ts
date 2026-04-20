import Expo, { ExpoPushMessage, ExpoPushToken } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
  useFcmV1: true,
});

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true, id: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token as ExpoPushToken))
    .map((t) => ({
      to: t.token as ExpoPushToken,
      sound: 'default' as const,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    }));

  if (messages.length === 0) return;

  // Fire-and-forget: chunk and send, handle errors gracefully
  const chunks = expo.chunkPushNotifications(messages);

  // Process async without awaiting — non-blocking
  void (async () => {
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        // Remove invalid tokens
        const invalidTokens: string[] = [];
        tickets.forEach((ticket, i) => {
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            invalidTokens.push(messages[i].to as string);
          }
        });

        if (invalidTokens.length > 0) {
          await prisma.pushToken.deleteMany({
            where: { token: { in: invalidTokens } },
          });
        }
      } catch {
        // Log silently — do not crash the server for push failures
        process.stderr.write('[push] Failed to send notification chunk\n');
      }
    }
  })();
}

export async function sendNewMessageNotification(
  conversationId: string,
  senderId: string,
  messageContent: string,
): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { title: true, sellerId: true } },
      buyer: { select: { id: true, displayName: true } },
    },
  });
  if (!conversation) return;

  const recipientId =
    senderId === conversation.buyerId
      ? conversation.listing.sellerId
      : conversation.buyerId;

  const senderName =
    senderId === conversation.buyerId ? conversation.buyer.displayName : 'Seller';

  const preview =
    messageContent.length > 60 ? messageContent.slice(0, 57) + '...' : messageContent;

  await sendPushToUser(recipientId, {
    title: senderName,
    body: preview,
    data: { conversationId, type: 'new_message' },
  });
}

export async function sendNewReviewNotification(
  revieweeId: string,
  reviewerName: string,
  rating: number,
  listingTitle: string,
): Promise<void> {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  await sendPushToUser(revieweeId, {
    title: 'New review received',
    body: `${reviewerName} rated you ${stars} on "${listingTitle}"`,
    data: { type: 'new_review', revieweeId },
  });
}

export async function sendNewInquiryNotification(
  conversationId: string,
  listingId: string,
): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { title: true, sellerId: true },
  });
  if (!listing) return;

  await sendPushToUser(listing.sellerId, {
    title: 'New inquiry',
    body: `Someone is interested in "${listing.title}"`,
    data: { conversationId, listingId, type: 'new_inquiry' },
  });
}
