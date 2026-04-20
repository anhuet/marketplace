import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProfileSetup: { inviteCode: string };
};

// Browse Stack
export type BrowseStackParamList = {
  Browse: undefined;
  ListingDetail: { listingId: string };
  ChatThread: { conversationId: string; listingTitle: string };
  UserProfile: { userId: string; sellerName?: string; sellerAvatarUrl?: string | null };
  WriteReview: {
    listingId: string;
    revieweeId: string;
    revieweeName: string;
    listingTitle: string;
  };
};

// Messages Stack
export type MessagesStackParamList = {
  Messages: undefined;
  ChatThread: { conversationId: string; listingTitle: string };
};

// Sell Stack
export type SellStackParamList = {
  PostListing: { listingId?: string } | undefined;
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  MyListings: undefined;
  ConversationList: undefined;
  ChatThread: { conversationId: string; listingTitle: string };
  UserProfile: { userId: string; sellerName?: string; sellerAvatarUrl?: string | null };
  ListingDetail: { listingId: string };
  WriteReview: {
    listingId: string;
    revieweeId: string;
    revieweeName: string;
    listingTitle: string;
  };
};

// MyListings Stack
export type MyListingsStackParamList = {
  MyListings: undefined;
  ListingDetail: { listingId: string };
  UserProfile: { userId: string; sellerName?: string; sellerAvatarUrl?: string | null };
};

// Saved Stack
export type SavedStackParamList = {
  Saved: undefined;
  ListingDetail: { listingId: string };
  UserProfile: { userId: string; sellerName?: string; sellerAvatarUrl?: string | null };
};

// Main Tab Navigator
export type MainTabParamList = {
  HomeTab: undefined;
  SavedTab: undefined;
  SellTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

// Root Navigator
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Screen props helpers
export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type BrowseStackScreenProps<T extends keyof BrowseStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BrowseStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type MessagesStackScreenProps<T extends keyof MessagesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MessagesStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type MyListingsStackScreenProps<T extends keyof MyListingsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MyListingsStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type SavedStackScreenProps<T extends keyof SavedStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SavedStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;
