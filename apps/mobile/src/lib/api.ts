import axios, { AxiosInstance } from 'axios';
import { User } from '@marketplace/shared';
import { useAuthStore } from '../store/authStore';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://54.175.34.74/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token on every request.
// For FormData requests, delete the default Content-Type so that React Native's
// fetch layer can set it with the correct multipart boundary.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
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
    apiClient.post('/listings', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  updateListing: (
    id: string,
    data: { title: string; description: string; price: string; condition: string; categoryId: string },
  ) => apiClient.put(`/listings/${id}`, data),
  addListingImages: (listingId: string, formData: FormData) =>
    apiClient.post<{ images: { id: string; url: string; order: number }[] }>(
      `/listings/${listingId}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    ),
  deleteListingImage: (listingId: string, imageId: string) =>
    apiClient.delete<{ success: boolean }>(`/listings/${listingId}/images/${imageId}`),
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

// ── Users API ─────────────────────────────────────────────────────────────────

export type DisplayNameCheckResult = {
  available: boolean;
  reason?: 'taken' | 'invalid_format' | 'reserved';
};

export const usersApi = {
  /**
   * Checks whether a display name is available and valid.
   * Always returns HTTP 200 — inspect `available` and `reason` to determine outcome.
   */
  checkDisplayName: (name: string) =>
    apiClient.get<DisplayNameCheckResult>('/users/check-displayname', { params: { name } }),

  /**
   * Uploads a new avatar image for the authenticated user.
   * Accepts a local file URI (e.g. from expo-image-picker) and POSTs it as
   * multipart/form-data under the field name `avatar`.
   * The Content-Type header is intentionally omitted so React Native can set
   * the correct multipart boundary automatically.
   */
  uploadAvatar: (fileUri: string) => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: fileUri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    return apiClient.post<{ user: User }>('/users/me/avatar', formData, {
      timeout: 60000,
    });
  },
};
