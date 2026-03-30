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
};

// Search Stack
export type SearchStackParamList = {
  Search: { query?: string };
  ListingDetail: { listingId: string };
};

// Sell Stack
export type SellStackParamList = {
  PostListing: undefined;
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  ConversationList: undefined;
  ChatThread: { conversationId: string; listingTitle: string };
  UserProfile: { userId: string };
};

// Main Tab Navigator
export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  SellTab: undefined;
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

export type SearchStackScreenProps<T extends keyof SearchStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SearchStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;
