import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import {
  findOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  createMessage,
  markMessagesRead,
  isConversationParticipant,
} from '../services/chatService';

export async function startConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listingId } = z.object({ listingId: z.string().uuid() }).parse(req.body);
    const buyerId = req.dbUser!.id;

    // Verify the listing exists and buyer is not the seller
    const { prisma } = await import('../lib/prisma');
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    if (listing.sellerId === buyerId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Cannot start a conversation on your own listing',
      );
    }

    const conversation = await findOrCreateConversation(listingId, buyerId);

    // Fire-and-forget: notify seller of new inquiry — does not block the response
    import('../services/pushService').then(({ sendNewInquiryNotification }) => {
      void sendNewInquiryNotification(conversation.id, listingId);
    });

    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function getMyConversations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const conversations = await getUserConversations(req.dbUser!.id);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { cursor, limit } = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(req.query);

    const allowed = await isConversationParticipant(id, req.dbUser!.id);
    if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Not a participant in this conversation');

    const messages = await getConversationMessages(id, cursor, limit);
    await markMessagesRead(id, req.dbUser!.id);

    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { content } = z
      .object({ content: z.string().min(1).max(2000) })
      .parse(req.body);
    const senderId = req.dbUser!.id;

    const allowed = await isConversationParticipant(id, senderId);
    if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Not a participant in this conversation');

    const message = await createMessage(id, senderId, content);

    // Emit via Socket.io (attached to app by index.ts)
    const io = req.app.get('io') as import('socket.io').Server | undefined;
    if (io) {
      io.to(`conversation:${id}`).emit('new_message', message);
    }

    // Fire-and-forget push notification — does not block the response
    import('../services/pushService').then(({ sendNewMessageNotification }) => {
      void sendNewMessageNotification(id, senderId, content);
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}
