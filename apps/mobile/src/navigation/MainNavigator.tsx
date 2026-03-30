import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  MainTabParamList,
  BrowseStackParamList,
  SearchStackParamList,
  SellStackParamList,
  ProfileStackParamList,
} from './types';
import { colors } from '../theme/tokens';

import BrowseScreen from '../screens/browse/BrowseScreen';
import ListingDetailScreen from '../screens/browse/ListingDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import PostListingScreen from '../screens/sell/PostListingScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ConversationListScreen from '../screens/chat/ConversationListScreen';
import ChatThreadScreen from '../screens/chat/ChatThreadScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const BrowseStack = createNativeStackNavigator<BrowseStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const SellStack = createNativeStackNavigator<SellStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function BrowseNavigator() {
  return (
    <BrowseStack.Navigator>
      <BrowseStack.Screen
        name="Browse"
        component={BrowseScreen}
        options={{ headerShown: false }}
      />
      <BrowseStack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
        options={{ title: '' }}
      />
      <BrowseStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.listingTitle })}
      />
    </BrowseStack.Navigator>
  );
}

function SearchNavigator() {
  return (
    <SearchStack.Navigator>
      <SearchStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <SearchStack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
        options={{ title: '' }}
      />
    </SearchStack.Navigator>
  );
}

function SellNavigator() {
  return (
    <SellStack.Navigator>
      <SellStack.Screen
        name="PostListing"
        component={PostListingScreen}
        options={{ title: 'New Listing' }}
      />
    </SellStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <ProfileStack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Messages' }}
      />
      <ProfileStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.listingTitle })}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <ProfileStack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: '' }}
      />
    </ProfileStack.Navigator>
  );
}

export default function MainNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="HomeTab" component={BrowseNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="SearchTab" component={SearchNavigator} options={{ title: 'Search' }} />
      <Tab.Screen name="SellTab" component={SellNavigator} options={{ title: 'Sell' }} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
