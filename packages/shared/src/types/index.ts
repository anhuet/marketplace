// User types
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  averageRating: number;
  ratingCount: number;
  inviteCodeUsedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  averageRating: number;
  ratingCount: number;
}

// Invite code types
export interface InviteCode {
  id: string;
  code: string;
  createdById: string;
  usedAt: string | null;
  createdAt: string;
}

// Listing types
export type ListingStatus = 'ACTIVE' | 'SOLD' | 'DELETED';
export type Condition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string; // Decimal serialized as string
  condition: Condition;
  status: ListingStatus;
  latitude: number;
  longitude: number;
  categoryId: string;
  sellerId: string;
  buyerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingWithDetails extends Listing {
  seller: PublicUser;
  buyer: PublicUser | null;
  images: ListingImage[];
  category: Category;
  distanceKm?: number; // Computed from GPS query
}

export interface ListingImage {
  id: string;
  listingId: string;
  url: string;
  order: number;
}

// Category types
export interface Category {
  id: string;
  name: string;
  slug: string;
}

// Conversation & Message types
export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationWithDetails extends Conversation {
  listing: Pick<Listing, 'id' | 'title' | 'status'> & { images: ListingImage[] };
  buyer: PublicUser;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

// Review types
export interface Review {
  id: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewWithDetails extends Review {
  reviewer: PublicUser;
}

// Saved listing types
export interface SavedListing {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
}

export interface SavedListingWithDetails extends SavedListing {
  listing: ListingWithDetails;
}

// Push token types
export type Platform = 'IOS' | 'ANDROID';

export interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: Platform;
}

// API response types
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
