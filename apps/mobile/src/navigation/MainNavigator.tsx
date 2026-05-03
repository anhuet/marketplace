import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  MainTabParamList,
  BrowseStackParamList,
  MessagesStackParamList,
  SellStackParamList,
  SavedStackParamList,
  ProfileStackParamList,
} from './types';
import { colors, spacing } from '../theme/tokens';
import { useChatStore } from '../store/chatStore';

import BrowseScreen from '../screens/browse/BrowseScreen';
import ListingDetailScreen from '../screens/browse/ListingDetailScreen';
import PostListingScreen from '../screens/sell/PostListingScreen';
import LocationPickerScreen from '../screens/sell/LocationPickerScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ConversationListScreen from '../screens/chat/ConversationListScreen';
import ChatThreadScreen from '../screens/chat/ChatThreadScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import MyListingsScreen from '../screens/profile/MyListingsScreen';
import WriteReviewScreen from '../screens/profile/WriteReviewScreen';
import SavedScreen from '../screens/saved/SavedScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const BrowseStack = createNativeStackNavigator<BrowseStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const SellStack = createNativeStackNavigator<SellStackParamList>();
const SavedStackNav = createNativeStackNavigator<SavedStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// ─── Stack navigators ─────────────────────────────────────────────────────────

function BrowseNavigator() {
  return (
    <BrowseStack.Navigator>
      <BrowseStack.Screen name="Browse" component={BrowseScreen} options={{ headerShown: false }} />
      <BrowseStack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: '' }} />
      <BrowseStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.listingTitle })}
      />
      <BrowseStack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: '' }} />
      <BrowseStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Write a Review' }}
      />
    </BrowseStack.Navigator>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen name="Messages" component={ConversationListScreen} options={{ title: 'Messages' }} />
      <MessagesStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.listingTitle })}
      />
    </MessagesStack.Navigator>
  );
}

function SellNavigator() {
  return (
    <SellStack.Navigator>
      <SellStack.Screen name="PostListing" component={PostListingScreen} options={{ title: 'New Listing' }} />
      <SellStack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ title: 'Pick Location' }} />
    </SellStack.Navigator>
  );
}

function SavedNavigator() {
  return (
    <SavedStackNav.Navigator>
      <SavedStackNav.Screen name="Saved" component={SavedScreen} options={{ headerShown: false }} />
      <SavedStackNav.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: '' }} />
      <SavedStackNav.Screen name="UserProfile" component={UserProfileScreen} options={{ title: '' }} />
    </SavedStackNav.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen name="ConversationList" component={ConversationListScreen} options={{ title: 'Messages' }} />
      <ProfileStack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params.listingTitle })}
      />
      <ProfileStack.Screen name="MyListings" component={MyListingsScreen} options={{ title: 'My Listings' }} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <ProfileStack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: '' }} />
      <ProfileStack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: '' }} />
      <ProfileStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Write a Review' }}
      />
    </ProfileStack.Navigator>
  );
}

// ─── Tab icons ────────────────────────────────────────────────────────────────

const TAB_ICON_SIZE = 22;

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <Ionicons
      name={focused ? 'home' : 'home-outline'}
      size={TAB_ICON_SIZE}
      color={focused ? colors.primaryDark : colors.secondary}
    />
  );
}

function MessagesIcon({ focused }: { focused: boolean }) {
  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  );

  return (
    <View>
      <Ionicons
        name={focused ? 'chatbubble' : 'chatbubble-outline'}
        size={TAB_ICON_SIZE}
        color={focused ? colors.primaryDark : colors.secondary}
      />
      {totalUnread > 0 && (
        <View style={badgeStyles.container}>
          <Text style={badgeStyles.text}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </Text>
        </View>
      )}
    </View>
  );
}

function SavedIcon({ focused }: { focused: boolean }) {
  return (
    <Ionicons
      name={focused ? 'heart' : 'heart-outline'}
      size={TAB_ICON_SIZE}
      color={focused ? colors.primaryDark : colors.secondary}
    />
  );
}

function ProfileIcon({ focused }: { focused: boolean }) {
  return (
    <Ionicons
      name={focused ? 'person-circle' : 'person-circle-outline'}
      size={TAB_ICON_SIZE + 2}
      color={focused ? colors.primaryDark : colors.secondary}
    />
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={tabBarStyles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isSell = route.name === 'SellTab';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isSell) {
          return (
            <TouchableOpacity
              key={route.key}
              style={tabBarStyles.sellButton}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel="Sell"
              accessibilityState={{ selected: isFocused }}
            >
              <View style={tabBarStyles.sellCircle}>
                <Text style={tabBarStyles.sellIcon}>+</Text>
              </View>
              <Text style={tabBarStyles.sellLabel}>SELL</Text>
            </TouchableOpacity>
          );
        }

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : typeof options.title === 'string'
            ? options.title
            : route.name.replace('Tab', '');

        const icon = options.tabBarIcon
          ? options.tabBarIcon({ focused: isFocused, color: '', size: 24 })
          : null;

        return (
          <TouchableOpacity
            key={route.key}
            style={tabBarStyles.tab}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
          >
            {icon}
            <Text style={[tabBarStyles.label, isFocused && tabBarStyles.labelFocused]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  labelFocused: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  // Sell button — elevated circle
  sellButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: -16,
  },
  sellCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  sellIcon: {
    fontSize: 28,
    color: colors.surface,
    lineHeight: 32,
    fontWeight: '300',
  },
  sellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
});

const badgeStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

// ─── Main navigator ───────────────────────────────────────────────────────────

export default function MainNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="HomeTab"
        component={BrowseNavigator}
        options={{
          title: 'HOME',
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SavedTab"
        component={SavedNavigator}
        options={{
          title: 'SAVED',
          tabBarIcon: ({ focused }) => <SavedIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SellTab"
        component={SellNavigator}
        options={{ title: 'SELL' }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesNavigator}
        options={{
          title: 'MESSAGES',
          tabBarIcon: ({ focused }) => <MessagesIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
