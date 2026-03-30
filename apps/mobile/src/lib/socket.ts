import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinConversationRoom(conversationId: string): void {
  socket?.emit('join_conversation', conversationId);
}
