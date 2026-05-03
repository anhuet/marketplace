import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://54.175.34.74/api/v1';
console.log('[API] BASE_URL =', BASE_URL);

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token on every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear auth and let navigation handle redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

// Typed API helpers
export const api = {
  // Auth
  validateInvite: (code: string) =>
    apiClient.post<{ valid: boolean }>('/auth/validate-invite', { code }),
  redeemInvite: (code: string) =>
    apiClient.post<{ success: boolean }>('/auth/redeem-invite', { code }),
  getMe: () => apiClient.get<{ user: import('@marketplace/shared').User }>('/auth/me'),
  // TODO: backend endpoint needed — PATCH /api/v1/users/me is not yet registered in apps/backend/src/routes/users.ts
  updateMe: (data: { displayName?: string; avatarUrl?: string; bio?: string }) =>
    apiClient.patch('/users/me', data),

  // Invites
  validateInviteCode: (code: string) =>
    apiClient.get<{ valid: boolean; reason?: string }>(`/invites/validate/${code}`),
  getMyInviteCode: () =>
    apiClient.get<{ code: string; usedAt: string | null; isUsed: boolean }>('/invites/mine'),

  // Discovery
  getNearbyListings: (params: {
    lat: number;
    lng: number;
    radiusKm?: number;
    categoryId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/discover/nearby', { params }),
  getCategories: () =>
    apiClient.get<{ categories: import('@marketplace/shared').Category[] }>('/discover/categories'),

  // Listings
  getListing: (id: string) => apiClient.get(`/listings/${id}`),
  getSellerListings: (sellerId: string) => apiClient.get(`/listings/seller/${sellerId}`),
  createListing: (data: FormData) =>
    apiClient.post('/listings', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateListing: (id: string, data: FormData) =>
    apiClient.put(`/listings/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteListing: (id: string) => apiClient.delete(`/listings/${id}`),
  markListingSold: (id: string, buyerId?: string) =>
    apiClient.patch(`/listings/${id}/status`, { status: 'SOLD', ...(buyerId && { buyerId }) }),
  getListingBuyers: (id: string) =>
    apiClient.get<{ buyers: { id: string; displayName: string; avatarUrl: string | null }[] }>(
      `/listings/${id}/buyers`,
    ),

  // Conversations
  startConversation: (listingId: string) => apiClient.post('/conversations', { listingId }),
  getConversations: () => apiClient.get('/conversations'),
  getMessages: (conversationId: string, cursor?: string) =>
    apiClient.get(`/conversations/${conversationId}/messages`, { params: { cursor } }),
  sendMessage: (conversationId: string, content: string) =>
    apiClient.post(`/conversations/${conversationId}/messages`, { content }),

  // Reviews
  createReview: (data: {
    listingId: string;
    revieweeId: string;
    rating: number;
    comment?: string;
  }) => apiClient.post('/reviews', data),
  getUserReviews: (userId: string, page?: number) =>
    apiClient.get(`/users/${userId}/reviews`, { params: { page } }),
  getUserRating: (userId: string) => apiClient.get(`/users/${userId}/rating`),

  // Saved listings
  getSavedListings: (page?: number, limit?: number) =>
    apiClient.get('/saved', { params: { page, limit } }),
  getSavedIds: () =>
    apiClient.get<{ listingIds: string[] }>('/saved/ids'),
  checkSaved: (listingId: string) =>
    apiClient.get<{ isSaved: boolean }>(`/saved/${listingId}`),
  saveListing: (listingId: string) =>
    apiClient.post('/saved', { listingId }),
  unsaveListing: (listingId: string) =>
    apiClient.delete(`/saved/${listingId}`),

  // Push tokens
  registerPushToken: (token: string, platform: 'IOS' | 'ANDROID') =>
    apiClient.post('/push-tokens', { token, platform }),
  deletePushToken: (token: string) =>
    apiClient.delete(`/push-tokens/${encodeURIComponent(token)}`),
};
