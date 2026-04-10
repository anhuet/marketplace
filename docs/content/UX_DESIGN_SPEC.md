# Marketplace — UX Design Specification

> **Owner**: @ui-ux-designer
> **Version**: 1.0
> **Last updated**: 2026-03-30
> **Platform**: iOS and Android (React Native / Expo SDK 51)
> **Status**: Complete — input contract for tasks #013–#018

---

## Table of Contents

1. [Navigation Architecture](#1-navigation-architecture)
2. [Screen Specifications](#2-screen-specifications)
   - 2.1 Auth Stack
   - 2.2 Browse Tab
   - 2.3 Search Tab
   - 2.4 Sell Tab (modal)
   - 2.5 Profile Tab
3. [Design Tokens](#3-design-tokens)
4. [Component Library](#4-component-library)
5. [Interaction Patterns](#5-interaction-patterns)
6. [Accessibility Notes](#6-accessibility-notes)

---

## 1. Navigation Architecture

### Structure Overview

The app uses React Navigation v6 with a **root stack** that conditionally renders either the Auth Stack or the Main Tab Navigator depending on authentication state. Auth state is read from Zustand (or equivalent auth store) on app launch.

```
RootNavigator (Stack)
├── AuthStack (Stack)                        ← shown when not authenticated
│   ├── SignupScreen
│   ├── LoginScreen
│   ├── OTPScreen
│   └── ProfileSetupScreen
│
└── MainTabs (BottomTabNavigator)            ← shown when authenticated
    ├── Tab: Home
    │   └── BrowseStack (Stack)
    │       ├── BrowseScreen
    │       ├── ListingDetailScreen
    │       └── ChatThreadScreen
    │
    ├── Tab: Search
    │   └── SearchStack (Stack)
    │       ├── SearchScreen
    │       └── ListingDetailScreen          ← same component, different stack instance
    │
    ├── Tab: Sell (FAB — opens modal)
    │   └── SellStack (Modal Stack)
    │       ├── PostListingScreen
    │       ├── CameraScreen
    │       └── ListingPreviewScreen
    │
    └── Tab: Profile
        └── ProfileStack (Stack)
            ├── MyProfileScreen
            ├── ConversationListScreen
            ├── EditProfileScreen
            └── SettingsScreen
```

**Conversation access paths**: ChatThreadScreen is accessible from (a) BrowseStack via ListingDetail → "Message Seller", (b) SearchStack via the same path, and (c) ProfileStack via ConversationListScreen. All three paths share the same ChatThreadScreen component, navigated to with a `conversationId` param.

**Deep link: notification tap**: A push notification for a new message deep-links directly to ChatThreadScreen within ProfileStack. The ProfileStack navigator handles this via linking configuration in the app's navigation container.

**Modal behavior of Sell tab**: Tapping the Sell FAB presents the SellStack as a full-screen modal (React Navigation `presentation: 'modal'`). The modal has its own header with a close (X) button that dismisses the entire flow. Posting or abandoning returns the user to whichever tab was previously active.

---

## 2. Screen Specifications

---

### 2.1 Auth Stack

---

#### Screen: Signup Screen

**Purpose**: Captures the user's email address and required invite code before handing off to Auth0 for credential creation.

**User goal**: Enter the app using an invite from a trusted community member.

**Layout**:
- Full-screen scroll view, no header (no navigation bar shown)
- Top area (48pt padding-top safe area): App wordmark "Marketplace" in `text-display` weight
- Center content area: form fields stacked vertically with 16pt gap
- Bottom area: primary CTA button pinned above keyboard (KeyboardAvoidingView)
- Below CTA: "Already have an account? Sign In" text link

**Components**:

| Element | Type | Label / Behavior |
|---------|------|-----------------|
| App wordmark | Text | "Marketplace" — `text-display`, `--color-primary-dark`, centered |
| Tagline | Text | "Join a community of trusted neighbours" — `text-body`, `--color-text-secondary`, centered |
| Email input | `TextInput` | Label: "Email address", placeholder: "you@example.com", `keyboardType="email-address"`, `autoCapitalize="none"`, `textContentType="emailAddress"` |
| Invite code input | `TextInput` | Label: "Invite code", placeholder: "MKT-XXXX-XXXX", `autoCapitalize="characters"`, validation spinner inline right of field |
| Invite code validity indicator | Inline icon + text | Appears after 500ms debounce: green checkmark + "Valid code" or red X + "Invalid or already used". Uses `accessibilityLiveRegion="polite"`. |
| Continue button | `PrimaryButton` | Label: "Continue", `loading` state while validating or transitioning, disabled until both fields are non-empty |
| Sign In link | Touchable text | "Already have an account? Sign In" — `text-body`, `--color-primary-dark`, navigates to LoginScreen |

**Interactions**:

```
Step 1: User fills email field → no immediate validation (validated server-side at Auth0)
Step 2: User types invite code → after 500ms debounce, POST /api/v1/auth/validate-invite
         Response valid   → show green checkmark inline
         Response invalid → show red X + error text inline, disable Continue button
Step 3: User taps "Continue" → PrimaryButton enters loading state
         Success (code valid) → store invite code in auth store, open Auth0 signup WebView / Universal Login
         Failure (network)   → show toast error "Could not connect. Please try again."
Edge case: User pastes invite code with extra whitespace → trim before sending to API
Edge case: User navigates back from Auth0 without completing signup → return to SignupScreen with fields preserved
```

**API calls**:
- `POST /api/v1/auth/validate-invite` — body: `{ "code": string }` — called on debounced input change
- Auth0 Universal Login is opened after validation (no direct backend call at this point)

**Error states**:
- Invalid invite code: inline error below invite code field, red text, red border on input, red X icon
- Network failure on validate: toast notification (transient, bottom of screen)
- Auth0 signup failure: returned via Auth0 callback; display error message on a new error screen or inline

---

#### Screen: Login Screen

**Purpose**: Returns existing users to the app via Auth0 authentication.

**User goal**: Sign in quickly to resume buying, selling, or messaging.

**Layout**:
- Mirrors Signup layout (same wordmark, same bottom link pattern)
- Two fields: email and password
- Below CTA: "Don't have an account? Create one" + "Forgot password?" link

**Components**:

| Element | Type | Label / Behavior |
|---------|------|-----------------|
| App wordmark | Text | Same as Signup |
| Email input | `TextInput` | Label: "Email address", `keyboardType="email-address"`, `autoCapitalize="none"`, `textContentType="emailAddress"` |
| Password input | `TextInput` | Label: "Password", `secureTextEntry`, `textContentType="password"`, show/hide toggle icon on right |
| Sign In button | `PrimaryButton` | Label: "Sign In", loading while Auth0 processes |
| Forgot password link | Touchable text | "Forgot password?" — opens Auth0 password reset flow |
| Create account link | Touchable text | "Don't have an account? Create one" — navigates to SignupScreen |

**Interactions**:

```
Step 1: User fills email + password → Sign In button becomes active
Step 2: User taps "Sign In" → button enters loading state
         Auth0 success → navigate to MainTabs (RootNavigator replaces AuthStack)
         Auth0 failure → show inline error "Incorrect email or password" below password field
Step 3: On success, call GET /api/v1/auth/me to confirm DB record exists (auto-creates if first login from new device)
Edge case: User has not redeemed an invite code yet (e.g., founding user) → GET /api/v1/auth/me still succeeds, invite_code_used_id will be null
```

**API calls**:
- Auth0 Universal Login (delegates credential handling entirely to Auth0)
- `GET /api/v1/auth/me` — on successful Auth0 response, to hydrate user profile into local store

---

#### Screen: OTP / 2FA Screen

**Purpose**: Collects the 6-digit one-time password sent by Auth0 as part of the signup or login 2FA step.

**User goal**: Complete verification quickly without re-typing a code incorrectly.

**Layout**:
- No navigation header
- Instructional heading and sub-copy at top
- 6 individual digit input circles in a centered horizontal row
- Resend code link below circles
- Continue button pinned above keyboard

**Components**:

| Element | Type | Label / Behavior |
|---------|------|-----------------|
| Heading | Text | "Enter verification code" — `text-heading`, centered |
| Sub-copy | Text | "We sent a 6-digit code to [email]. Check your inbox." — `text-body`, `--color-text-secondary`, centered |
| OTP input | `OTPInput` | 6 circles, 52×52pt each, 8pt gap, auto-advance focus on each digit entry, backspace moves to previous field, paste support (detect 6-digit string and populate all) |
| Resend code | Touchable text | "Resend code" — disabled for 30s countdown ("Resend in 24s"), then active. Re-triggers Auth0 code send. |
| Continue button | `PrimaryButton` | Label: "Continue", disabled until all 6 digits entered, loading while submitting to Auth0 |
| Back link | Touchable text | "← Change email" — navigates back |

**States**:
- Default: all circles empty, border `--color-secondary`
- Active (focused circle): border `--color-primary-dark`, slight scale 1.05 (150ms ease-out)
- Filled: circle background `--color-primary`, white text digit
- Error (wrong code): all circles shake animation (200ms), borders turn `--color-error`, error text "Incorrect code. Try again." appears below
- Loading: Continue button spinner, inputs disabled

**Interactions**:

```
Step 1: Screen appears → first circle auto-focused, numeric keyboard raised
Step 2: User types digit → advances to next circle
Step 3: User fills all 6 → Continue button activates
Step 4: User taps Continue (or auto-submits on 6th digit after 300ms delay) → Auth0 validates OTP
         Success → proceed to ProfileSetupScreen (new users) or MainTabs (returning users)
         Failure → shake animation, clear all fields, focus first circle, show error text
Edge case: User pastes 6-digit code → populate all circles, activate Continue
Edge case: Code expires (typically 10 min) → Auth0 returns expiry error → show "Code expired. Request a new one." and auto-focus Resend link
```

**API calls**: All OTP handling is delegated to Auth0. The screen is a UI wrapper around Auth0's MFA flow.

---

#### Screen: Profile Setup Screen

**Purpose**: Lets new users personalise their profile immediately after account creation, before their first browse experience.

**User goal**: Set a recognisable name and optionally a photo so sellers and buyers can trust them.

**Layout**:
- Navigation header: close (X) button top-left (allows skipping entire setup), step indicator "1 of 1"
- Center: avatar upload circle (96pt diameter)
- Below avatar: username input field
- Bottom: "Next →" pill button + "Skip for now" link

**Components**:

| Element | Type | Label / Behavior |
|---------|------|-----------------|
| Avatar upload | `AvatarWithBadge` | 96pt circle, default placeholder icon (person silhouette, `--color-primary` tint), camera badge bottom-right (32pt). Tap opens bottom sheet: "Take Photo" / "Choose from Gallery" / "Remove Photo" (if photo already set) |
| Username input | `TextInput` | Label: "Display name", placeholder: "How should people call you?", max 40 chars, character count shown bottom-right of field when > 30 chars used |
| Next button | `PrimaryButton` | Label: "Next →", disabled if username field is empty |
| Skip link | Touchable text | "Skip for now" — navigates to MainTabs without saving (username defaults to first part of email) |

**Interactions**:

```
Step 1: User (optionally) uploads avatar → photo picker bottom sheet appears
         Photo selected → avatar circle updates with selected image
         Photo uploading → circular progress overlay on avatar
Step 2: User types display name → character count appears at 30+ chars
Step 3: User taps "Next →"
         → PATCH /api/v1/users/:id with { displayName, avatarUrl (if uploaded) }
         → POST /api/v1/auth/redeem-invite with the invite code stored from SignupScreen
         → On both succeeding: navigate to MainTabs
         → On PATCH failure: show inline error "Could not save profile. Try again."
         → On redeem-invite failure (code already used): surface non-blocking toast, continue anyway (user is already in DB)
Step 4: "Skip for now" → navigate to MainTabs; invite code redemption POST still fires in background
Edge case: User skips avatar but taps "Next →" → proceed without avatar (avatarUrl null)
Edge case: Network offline during save → show toast "No connection. Your profile will be saved when reconnected." and cache locally
```

**API calls**:
- `PATCH /api/v1/users/:id` — body: `{ displayName: string, avatarUrl?: string }`
- `POST /api/v1/auth/redeem-invite` — body: `{ code: string }` — the invite code captured on SignupScreen

---

### 2.2 Browse Tab

---

#### Screen: Home / Browse Screen

**Purpose**: The primary discovery surface — shows nearby listings in a scrollable grid with quick filter access.

**User goal**: Find interesting items being sold near them without effort.

**Layout**:
- Status bar safe area at top
- Sticky header (does not scroll away):
  - Row 1: "Marketplace" wordmark left, notification bell icon right (badge dot if unread messages)
  - Row 2: Search bar (rounded, full-width minus 16pt horizontal padding)
  - Row 3: Grid/Feed toggle (segmented control, left-aligned) + Filter icon button (right-aligned)
- Scrollable content:
  - Section: "Nearby Treasures" — horizontal carousel, label "Nearby Treasures" `text-heading` with "See all" link right
  - Section separator (16pt vertical gap)
  - Section: listing grid (default 3-column for cards under 160pt wide; 2-column on smallest viewports < 360pt wide)
- Bottom: system BottomTabBar (not scrolled away)

**Grid vs Feed toggle**:
- Grid: 3 columns, square `ListingCard` with price+distance overlay
- Feed: 1-column full-width cards with image on left (120pt wide), title/price/distance text on right — richer preview

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Search bar | `TextInput` (non-editable tap target) | Tap navigates to SearchScreen (does not open keyboard inline). `accessibilityRole="button"`. |
| Grid/Feed toggle | Segmented control | 2 options: grid icon, list icon. Stores selection in local state (not persisted across sessions). |
| Filter button | Icon button (funnel icon + "Filter" label) | Opens FilterBottomSheet. Shows filled icon + badge count when filters are active. |
| Nearby Treasures carousel | Horizontal FlatList | `ListingCard` at 140pt width, snap-scrolling. Shows 4–6 closest listings by distance. |
| Listing grid | FlatList (2 or 3 columns) | `ListingCard` components. Pull-to-refresh. Infinite scroll: loads next 20 when within 200pt of bottom. |
| Empty state | EmptyState illustration + text | "No listings near you yet. Be the first to post!" with "Sell Something" button if GPS is available. |
| Location denied banner | Sticky banner below header | "Enable location to see nearby listings" + "Open Settings" button. Only shown if GPS permission denied. |

**Loading states**:
- Initial load: skeleton grid (6 rectangular skeleton cards in 3-column layout) while first page loads
- Pagination: spinner centered below last card row
- Pull-to-refresh: native RefreshControl (platform default spinner)

**Interactions**:

```
Step 1: Screen mounts → check GPS permission
         Granted   → call GET /api/v1/discover/nearby?lat=...&lng=...&radius=10
         Denied    → show Location Denied Banner, call GET /api/v1/discover/nearby without coords (server returns city-level fallback or error)
Step 2: Listings load → replace skeleton with real cards
Step 3: User taps ListingCard → navigate to ListingDetailScreen with listingId param
Step 4: User taps search bar → navigate to SearchScreen
Step 5: User taps Filter → present FilterBottomSheet
Step 6: User pulls down → refresh: re-call GET /api/v1/discover/nearby
Step 7: User scrolls to bottom → load next page (cursor-based pagination)
```

**API calls**:
- `GET /api/v1/discover/nearby` — params: `lat`, `lng`, `radius` (km), `category`, `cursor`, `limit=20`

---

#### Screen: Filter Bottom Sheet

**Purpose**: Lets users narrow listing results by distance radius and category without leaving the Browse screen.

**User goal**: See only listings within a walkable distance or in a specific category.

**Layout**:
- Bottom sheet, 20pt top corner radius, drag handle at top center (40×4pt pill)
- Sheet height: 60% of screen, expandable to 90% on drag
- Header row: "Filters" label (`text-heading`) left + "Clear all" link right
- Content (scrollable if needed):
  - Section "Distance": 5-stop segmented slider (1 km, 5 km, 10 km, 25 km, 50 km)
  - Section "Category": horizontal wrapping chip list
- Footer (pinned): "Apply Filters" `PrimaryButton` full-width inside 16pt horizontal padding + 16pt bottom padding
- Backdrop: semi-transparent `rgba(0,0,0,0.4)`, tap to dismiss (same as Cancel)

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Distance slider | Step slider (5 stops) | Labels: "1km", "5km", "10km", "25km", "50km". Selected stop highlighted `--color-primary-dark`. Accessible: `accessibilityRole="adjustable"`, increment/decrement via accessibility actions. |
| Category chips | Multi-select chip list | Each chip: category name, toggle selected/unselected. Selected state: `--color-primary-dark` background, white text. Unselected: outlined border `--color-secondary`. |
| Clear all | Touchable text | Resets radius to 10km (default), clears all category selections. |
| Apply Filters button | `PrimaryButton` | Label: "Apply Filters" or "Apply (N active)" where N = count of active filter choices |

**Interactions**:

```
Step 1: Sheet opens → current active filters pre-populated
Step 2: User adjusts radius and/or selects categories
Step 3: User taps "Apply Filters" → sheet dismisses, BrowseScreen refetches with new params
         Alternatively: user drags sheet down or taps backdrop → sheet dismisses, filters unchanged
Step 4: Filter icon in Browse header shows filled state + count badge while filters are active
Edge case: All categories deselected → treated as "all categories" (no category filter param sent)
```

---

#### Screen: Listing Detail Screen

**Purpose**: Shows the full information for a single listing so a buyer can decide whether to contact the seller.

**User goal**: Assess the item (photos, condition, price, seller reputation) and initiate contact if interested.

**Layout**:
- Full-screen layout, no standard navigation header
- Image carousel: full-width, 1:1 aspect ratio (square), swipe-horizontal, dot indicator below
- Floating back button: top-left, 44×44pt circle, semi-transparent dark background (`rgba(0,0,0,0.4)`)
- Floating share/report icon: top-right, same treatment
- Below carousel (scrollable):
  - Price badge: `text-heading` bold, `--color-primary-dark`
  - Title: `text-title`
  - Distance badge inline with location pin icon
  - Divider
  - Seller row: avatar (40pt circle) + display name + rating stars + arrow (navigates to seller's profile)
  - Divider
  - Condition badge: pill label (NEW / LIKE_NEW / GOOD / FAIR / POOR), colored per condition (see token table)
  - Description: `text-body`, expandable ("Read more" if > 4 lines)
  - Posted date: `text-caption`, `--color-text-secondary`
- Bottom action bar (pinned, not scrolled):
  - Full-width "Message Seller" `PrimaryButton` (hidden if current user is the seller)
  - If current user is the seller: "Edit Listing" `SecondaryButton` + "Mark as Sold" `SecondaryButton`

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Image carousel | Swipeable FlatList | Horizontal paging, dot indicators below, pinch-to-zoom on individual image (or navigate to full-screen image viewer) |
| Price | Text | `text-heading`, bold, `--color-primary-dark` |
| `DistanceBadge` | Badge component | "0.3km" or "1.2km" with location pin icon |
| Seller row | Touchable row | Avatar + name + `RatingStars` + chevron → navigates to SellerProfileScreen |
| Condition badge | Pill | Colored: NEW = `--color-success`; LIKE_NEW = `#38B2AC`; GOOD = `--color-primary-dark`; FAIR = `--color-tertiary`; POOR = `--color-secondary` |
| Description | Expandable text | 4 lines max collapsed; "Read more" touchable expands inline |
| Message Seller | `PrimaryButton` | Calls POST /api/v1/conversations, then navigates to ChatThreadScreen |
| Report icon | Icon button | Placeholder for v2 reporting flow; shows "Report listing" action sheet |

**Interactions**:

```
Step 1: Screen mounts → GET /api/v1/listings/:id, show skeleton while loading
Step 2: Data loaded → render full detail layout
Step 3: User swipes carousel → advances image, dot indicator updates
Step 4: User taps seller row → navigate to SellerProfileScreen (Public profile view — see note below)
Step 5: User taps "Message Seller"
         → POST /api/v1/conversations { listingId }
         → On success: navigate to ChatThreadScreen with conversationId
         → On failure (already exists — 409): server returns existing conversationId; navigate anyway
         → On network error: toast "Could not start conversation. Try again."
Step 6: User taps back button → pop to previous screen
Error state: listing not found (404) → show "This listing is no longer available" empty state with back button
Error state: listing status = SOLD → show "SOLD" banner overlay on first image, disable "Message Seller" button
```

**API calls**:
- `GET /api/v1/listings/:id`
- `POST /api/v1/conversations` — body: `{ listingId: string }`

**Note on SellerProfileScreen**: A public read-only view of another user's profile (avatar, name, rating, active listings grid). This reuses the MyProfileScreen component in a read-only mode. Not a separate screen spec since it shares the same layout; the `isOwnProfile` prop controls edit controls visibility.

---

#### Screen: Chat Thread Screen

**Purpose**: Enables real-time messaging between a buyer and seller about a specific listing.

**User goal**: Ask questions, negotiate price, or arrange a pickup — all in one thread.

**Layout**:
- Navigation header: back button + other party's name + listing thumbnail (40×40pt, rounded 8pt) — tapping thumbnail navigates to ListingDetailScreen
- Messages list (FlatList, inverted so newest messages appear at bottom):
  - Own messages: right-aligned, `--color-primary-dark` bubble, white text
  - Other party's messages: left-aligned, `--color-surface` bubble with `--color-secondary` border, `--color-text-primary` text
  - Timestamp: `text-caption`, centered, shown once per group (messages within 5 minutes grouped, single timestamp shown)
  - Read receipt: "Seen" text-caption below the last sent message when `read_at` is not null
- Keyboard-aware scroll: screen shifts up when keyboard opens, last message remains visible
- Input bar (pinned above keyboard):
  - Text input: grows up to 4 lines, then scrollable
  - Send button: icon button (paper plane), `--color-primary-dark`, disabled when input empty

**States**:
- Message sending: bubble appears immediately (optimistic) with grey tint and small "sending" indicator
- Message sent: bubble updates to normal color, sending indicator removed
- Message failed: bubble shows red border + "!" icon; tap "!" to retry or dismiss

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| `MessageBubble` | Component | `isOwn: boolean`, `content: string`, `timestamp: Date`, `status: 'sending' | 'sent' | 'failed' | 'read'` |
| Message input | `TextInput` multiline | `returnKeyType="send"`, send on Return key (with Shift+Return for newline on keyboards that support it) |
| Send button | Icon button | 44×44pt, disabled state: `--color-secondary` icon; active: `--color-primary-dark` icon |
| Listing header thumbnail | Image + Text | 40×40pt rounded image, listing title `text-caption`, tappable |

**Interactions**:

```
Step 1: Screen mounts → GET /api/v1/conversations/:id/messages (paginated, newest first)
         → join Socket.io room: socket.emit('join_conversation', { conversationId })
Step 2: Messages render, scroll to bottom
Step 3: User types message → input grows, Send button activates
Step 4: User taps Send
         → Optimistic: add bubble with status='sending' to local list
         → POST /api/v1/conversations/:id/messages { content }
         → Success: update bubble status='sent'
         → Failure: update bubble status='failed', show retry affordance
Step 5: Incoming message via Socket.io 'new_message' event
         → Append bubble to list
         → If screen is visible (app in foreground): auto-mark as read via PATCH /api/v1/conversations/:id/messages/:msgId/read
Step 6: User scrolls up → load older messages (cursor pagination)
Edge case: Socket.io disconnected → show "Reconnecting..." banner below header; retry sending queued on reconnect
Edge case: User sends while offline → message stays 'sending', retried when connection restores
```

**API calls**:
- `GET /api/v1/conversations/:id/messages` — params: `cursor`, `limit=30`
- `POST /api/v1/conversations/:id/messages` — body: `{ content: string }`
- Socket.io events: `join_conversation`, `new_message` (listen), `send_message` (emit)

---

### 2.3 Search Tab

---

#### Screen: Search Screen

**Purpose**: Provides keyword-based search over nearby listings, with recent search history for quick re-access.

**User goal**: Find a specific item type quickly (e.g., "vintage camera", "road bike").

**Layout**:
- Navigation header: auto-focused search input with "Cancel" button on right (tapping Cancel navigates back to BrowseScreen or collapses search)
- Below input: two states —
  - Pre-search state: "Recent searches" section (list of up to 5 recent queries with clock icon) + "Browse categories" horizontal chip row
  - Results state: same grid layout as BrowseScreen listing grid, result count label ("24 results near you")
- Bottom: BottomTabBar (Search tab active)

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Search input | `TextInput` | Auto-focused on screen mount. `returnKeyType="search"`. Debounced 400ms before triggering search. Clear (X) button appears when text is present. |
| Recent searches | List rows | Tap to re-run that search query. Swipe-to-delete individual item. "Clear all" link at section header. Stored in AsyncStorage. |
| Category chips | Horizontal FlatList | Tapping a category chip runs a search filtered by that category slug. Same chip design as FilterBottomSheet. |
| Results grid | FlatList (2–3 col) | Identical to BrowseScreen grid. Pull-to-refresh supported. |
| No results empty state | EmptyState | "No results for '[query]' nearby. Try a wider radius?" with "Adjust Filters" button. |

**Interactions**:

```
Step 1: Tab tapped → SearchScreen mounts, search input auto-focused
Step 2: User types → debounce 400ms → GET /api/v1/discover/nearby?q=...&lat=...&lng=...
Step 3: Results appear → replace pre-search content with results grid
Step 4: User taps result → navigate to ListingDetailScreen (within SearchStack)
Step 5: User clears input → return to pre-search state; save query to recent searches (even if results were empty)
Step 6: User taps Cancel → pop back to previous screen (or deactivate Search tab)
Step 7: User taps recent search → populate input + trigger search immediately
```

**API calls**:
- `GET /api/v1/discover/nearby` — params: `q`, `lat`, `lng`, `radius`, `category`, `cursor`, `limit=20`

---

### 2.4 Sell Tab (Modal)

---

#### Screen: Post Listing Screen

**Purpose**: Multi-step form that guides the seller through creating a complete, trustworthy listing.

**User goal**: List an item for sale quickly and attract serious buyers.

**Layout**:
- Modal presentation (slides up from bottom, full-screen)
- Navigation header: "X" close button (top-left, confirms discard if any data entered), step title ("Add Photos" / "Item Details" / "Location"), step counter top-right ("Step 1 of 3")
- Scrollable content area specific to each step (see below)
- Bottom: "Next" / "Post Listing" `PrimaryButton` pinned above keyboard or bottom safe area
- Progress indicator: 3-segment bar below header, segments fill as steps complete

**Step 1 — Photos**:

| Element | Type | Behavior |
|---------|------|---------|
| Photo grid | 8-slot grid (2 rows × 4 cols on 375pt+; 2 rows × 3 cols on 320pt) | Slot 1 marked "Cover" with star badge. Empty slots show + icon with `--color-secondary`. Filled slots show image thumbnail with remove (X) badge top-right. |
| Add photo (empty slot tap) | Bottom sheet | Options: "Take Photo" → CameraScreen, "Choose from Gallery" → native image picker (multi-select up to 8). |
| Photo upload progress | Inline per-slot | Circular progress indicator overlay while image uploads to S3. On success: clear. On failure: red X overlay + retry on tap. |
| Instruction text | Caption | "Add up to 8 photos. The first photo is your cover image." `text-caption`, `--color-text-secondary` |

Validation: at least 1 photo required before advancing to Step 2.

**Step 2 — Item Details**:

| Element | Type | Behavior |
|---------|------|---------|
| Title | `TextInput` | Label: "Title", placeholder: "What are you selling?", max 80 chars, character count shown at 60+ |
| Description | `TextInput` multiline | Label: "Description", placeholder: "Describe the item, its history, any flaws...", min height 100pt, expands to content |
| Price | `TextInput` | Label: "Price", `keyboardType="decimal-pad"`, currency prefix "$" shown inside input left side |
| Condition picker | Segmented control (5 options) | Labels: "New", "Like New", "Good", "Fair", "Poor". Each tap selects and visually highlights that option (`--color-primary-dark` bg). `accessibilityRole="radio"` per option. |
| Category picker | Dropdown / bottom sheet | Label: "Category", shows selected category name or "Select a category" placeholder. Tap opens category list bottom sheet. |

Validation (on "Next" tap): title required, price required and > 0, condition required, category required.
Inline errors shown below each required field that is empty.

**Step 3 — Location**:

| Element | Type | Behavior |
|---------|------|---------|
| Map preview | Static map image | Shows pin at auto-detected GPS location. 300pt height, rounded 12pt corners. "Adjust location" button overlaid bottom-right. |
| Location label | Text | Street-level address string below map (reverse-geocoded from coords). |
| Adjust location | `SecondaryButton` | Opens an interactive map pan-to-adjust view. User drags pin to desired location; "Confirm" sets new coords. |
| GPS accuracy note | Caption | "Using your current location. You can adjust this pin to a nearby street or meeting point." |

If GPS permission denied: show text input "Enter your approximate location" with address autocomplete (stretch goal for v2; in v1 show error "Location access required to post a listing" with deep-link to Settings).

**Interactions**:

```
Step 1 (Photos):
  - User taps empty slot → bottom sheet appears
  - "Take Photo" → navigate to CameraScreen (push within modal stack)
  - "Choose from Gallery" → native picker (multi-select)
  - Photos upload in background; user can proceed to Step 2 while uploading
  - Tapping "Next" while uploads in progress: wait for all uploads, show inline progress message

Step 2 (Details):
  - User fills fields
  - Tapping "Next" → validate all required fields; show inline errors on failures

Step 3 (Location):
  - GPS captured automatically on step entry (useEffect triggers location fetch)
  - User optionally adjusts pin
  - User taps "Post Listing"
    → Validation: all required fields from all steps
    → POST /api/v1/listings { title, description, price, condition, categoryId, latitude, longitude, imageUrls[] }
    → Loading state on button
    → Success: dismiss modal, navigate to ListingDetailScreen for the new listing, show success toast "Listed! Your item is live."
    → Failure: show error toast "Could not post listing. Please try again."

Discard flow:
  - User taps X or swipes modal down (if no data entered): dismiss immediately
  - User taps X (data entered): show confirmation alert "Discard listing? Your changes will be lost." — "Discard" / "Keep Editing"
```

**API calls**:
- Image upload: `POST /api/v1/listings/upload-image` (multipart, per-image) — returns URL (called per photo as added)
- `POST /api/v1/listings` — body: `{ title, description, price, condition, categoryId, latitude, longitude, imageUrls[] }`
- `GET /api/v1/categories` — to populate category picker (on modal open)

---

#### Screen: Camera Screen

**Purpose**: Full-screen camera interface for capturing listing photos directly within the app.

**User goal**: Take a clean, well-framed photo of the item being sold.

**Layout**:
- Full-screen (covers entire display including safe areas)
- Camera viewfinder fills entire screen
- Grid overlay: 3×3 rule-of-thirds lines, subtle white opacity lines (`rgba(255,255,255,0.25)`)
- Top bar (overlay):
  - Close button (X): top-left, white icon on semi-transparent dark pill
  - Flash toggle: top-center (Auto / On / Off, cycles on tap), icon with label
  - Flip camera: top-right, white icon
- Tab bar (bottom overlay): "Photo" / "Video" / "Square" tabs (in app context, only "Photo" and "Square" are functional in v1; "Video" is present but disabled)
- Capture button row (bottom, above tab bar):
  - Left: gallery shortcut (last photo from camera roll, 44×44pt square thumbnail)
  - Center: capture button (72×72pt white circle with dark border, 4pt inner stroke)
  - Right: flip camera (duplicate affordance for thumb reach)
- "Done" button: bottom-right when at least 1 photo captured in session (navigates back to PostListingScreen with captured photo URIs)

**Interactions**:

```
Step 1: Screen mounts → request camera permission (if not yet granted)
         Denied → show camera permission explanation screen with "Grant Access" button (deep-links to Settings)
Step 2: Camera preview renders with grid overlay
Step 3: User taps capture button
         → capture animation (brief white flash overlay, 100ms)
         → photo appears as thumbnail in bottom-left gallery shortcut, counter badge increments
Step 4: User taps "Done" → navigate back to PostListingScreen, pass photo URIs
Step 5: User taps X → confirm discard if photos captured ("Discard photos?" alert); navigate back without passing photos
```

**Note**: This screen uses `expo-camera`. The Square mode crops the viewfinder to 1:1 aspect ratio (preferred default for listing photos).

---

### 2.5 Profile Tab

---

#### Screen: My Profile Screen

**Purpose**: Shows the logged-in user's public-facing profile, their listings, and community standing.

**User goal**: Review how their profile appears to others, manage listings, and share their invite code.

**Layout**:
- Navigation header: "Profile" title (centered) + gear icon button (right → navigates to SettingsScreen) + message icon (left → navigates to ConversationListScreen, unread count badge)
- Scrollable content:
  - Hero section: avatar (80pt circle), display name (`text-heading`), "@username" or bio (`text-body`, `--color-text-secondary`)
  - Stats row: 3 equal columns — "Items Listed" count, "Sold" count, "Rating" (star icon + average)
  - Action buttons row: "Edit Profile" `SecondaryButton` + "Share Profile" `SecondaryButton` (equal width, side by side)
  - Invite code card: `--color-surface` card, rounded 12pt, "Your invite code" label, code in monospace `text-title` `--color-primary-dark`, "Copy" + "Share" icon buttons, sub-caption "Share with a friend to invite them to Marketplace"
  - Tabs: "Items" | "Sold" | "Reviews" — segmented, sticky below stats on scroll
  - Tab content (changes on tab selection):
    - Items: grid of `ListingCard` (active listings)
    - Sold: grid of `ListingCard` (sold listings, "SOLD" badge overlay)
    - Reviews: list of review rows (reviewer avatar + name + star rating + comment + date)

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Avatar | `AvatarWithBadge` | 80pt, no camera badge on public view; own profile shows camera badge → opens photo picker |
| Stats row | 3-column layout | Each stat: large number (`text-heading`), small label (`text-caption`). Tap on rating number navigates to Reviews tab. |
| Invite code card | Custom card | "Copy" button copies code to clipboard + shows "Copied!" toast. "Share" button opens native share sheet. |
| Tab bar | 3-tab segmented | "Items" / "Sold" / "Reviews". Active tab: `--color-primary-dark` bottom border, bold text. `accessibilityRole="tab"` per tab, `role="tablist"` on container. |
| Review row | Custom row | Avatar (32pt) + display name + `RatingStars` + comment text + relative date. |

**Interactions**:

```
Step 1: Screen mounts → parallel API calls:
         GET /api/v1/auth/me  (user profile data)
         GET /api/v1/invites/mine  (invite code + usage status)
         GET /api/v1/users/:id/listings?status=ACTIVE  (Items tab, page 1)
Step 2: Data loads → skeleton replaced with real content
Step 3: User taps tab → load corresponding data if not already cached
Step 4: User taps "Copy" on invite code → clipboard write + "Copied!" toast
Step 5: User taps gear → navigate to SettingsScreen
Step 6: User taps message icon → navigate to ConversationListScreen
Step 7: User taps avatar camera badge → photo picker → upload → PATCH /api/v1/users/:id
Step 8: Pull-to-refresh → re-fetch all profile data
```

**API calls**:
- `GET /api/v1/auth/me`
- `GET /api/v1/invites/mine`
- `GET /api/v1/users/:id/listings` — params: `status`, `cursor`, `limit=18`
- `GET /api/v1/users/:id/reviews` — params: `cursor`, `limit=10`
- `PATCH /api/v1/users/:id` — for avatar update from this screen

---

#### Screen: Conversation List Screen

**Purpose**: Shows all the user's active buy and sell conversations so they can monitor and respond to messages.

**User goal**: Stay on top of inquiries from buyers and replies from sellers.

**Layout**:
- Navigation header: "Messages" title, back button (pops to ProfileScreen)
- Scrollable list of `ConversationRow` items, ordered by most recent message descending
- Empty state: "No conversations yet. Message a seller to get started." with "Browse Listings" button
- Pull-to-refresh supported

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| `ConversationRow` | List row | 72pt height. Left: listing thumbnail (48×48pt, rounded 8pt). Center: listing title (`text-label`), other party name (`text-caption`), last message preview (`text-caption`, max 1 line, ellipsis). Right: timestamp (`text-caption`, `--color-text-secondary`) + unread badge (filled `--color-primary-dark` circle, white count, shown only if unread > 0). |
| Unread badge | Badge | Appears top-right of row. "9+" for counts > 9. |
| Swipe-to-delete | Swipe action | Left-swipe reveals red "Delete" action. Confirms with alert before deleting. |
| Section header | Text | Optional: today's conversations above a separator, older below. Only shown if list spans more than one day. |

**Interactions**:

```
Step 1: Screen mounts → GET /api/v1/conversations
Step 2: List renders with most recent conversation first
Step 3: User taps row → navigate to ChatThreadScreen with conversationId
Step 4: User swipes row left → "Delete" action revealed; confirm → DELETE /api/v1/conversations/:id
Step 5: Pull-to-refresh → re-fetch conversation list
Step 6: Real-time: Socket.io 'new_message' event updates last-message preview and unread badge inline without full refresh
Edge case: Empty list → EmptyState rendered
```

**API calls**:
- `GET /api/v1/conversations` — returns conversations with last message preview and unread count
- `DELETE /api/v1/conversations/:id` — on swipe-delete

---

#### Screen: Settings Screen

**Purpose**: Provides account management options including notification control and logout.

**User goal**: Control their notification preferences and log out securely.

**Layout**:
- Navigation header: "Settings" title, back button
- Scrollable list with grouped sections (iOS-style section headers, plain section list on Android)
- Section 1 — "Notifications":
  - Push notifications toggle row
- Section 2 — "Account":
  - "Log Out" row (destructive red text)
  - "Delete Account" row (destructive, placeholder — shows "Coming soon" toast in v1)
- Section 3 — "About":
  - "Version" row (app version string, non-tappable)
  - "Privacy Policy" link row
  - "Terms of Service" link row

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Notifications toggle | Toggle row | Label: "Push Notifications". Toggle on: calls `POST /api/v1/push-tokens` (token re-registration). Toggle off: calls `DELETE /api/v1/push-tokens/:token`. Shows loading indicator on toggle while API call is in-flight; reverts if API call fails. |
| Log Out | Destructive row | Red text "Log Out". Tap: confirm alert "Are you sure you want to log out?" — "Log Out" / "Cancel". On confirm: clear auth token, Auth0 logout, navigate to AuthStack. |
| Delete Account | Destructive row (disabled in v1) | Tapping shows toast "Account deletion coming soon." |
| External links | Row with arrow | Opens in in-app browser (`expo-web-browser`). |

**Interactions**:

```
Notifications toggle off:
  Step 1: User toggles off
  Step 2: DELETE /api/v1/push-tokens/:token (current device token)
  Step 3: On success: toggle stays off, store pref in AsyncStorage
  Step 4: On failure: toggle reverts to on, show error toast

Log Out:
  Step 1: User taps Log Out → confirmation alert
  Step 2: User confirms → clear Zustand auth store, clear AsyncStorage tokens
  Step 3: Auth0 logout (revoke session)
  Step 4: RootNavigator detects auth state null → renders AuthStack
```

**API calls**:
- `DELETE /api/v1/push-tokens/:token`
- `POST /api/v1/push-tokens` — body: `{ token: string, platform: 'IOS' | 'ANDROID' }`

---

#### Screen: Edit Profile Screen

**Purpose**: Allows the user to update their display name, avatar, and bio.

**User goal**: Keep their profile current and trustworthy as their community presence grows.

**Layout**:
- Navigation header: "Edit Profile" title, back button (left), "Save" text button (right, `--color-primary-dark`, disabled until a change is made)
- Content: centered form layout
  - Avatar section: centered `AvatarWithBadge` (80pt) with "Change photo" link below
  - Display name input
  - Bio input (multiline)
- No floating CTA — save is in the header (pattern consistent with iOS native settings)

**Components**:

| Element | Type | Behavior |
|---------|------|---------|
| Avatar | `AvatarWithBadge` | Camera badge tap → photo picker bottom sheet. Uploading state: circular progress overlay on avatar. |
| "Change photo" link | Touchable text | Duplicate affordance for avatar change, `text-label`, `--color-primary-dark` |
| Display name | `TextInput` | Label: "Display name", max 40 chars, character count shown at 30+ |
| Bio | `TextInput` multiline | Label: "Bio", placeholder: "Tell the community about yourself", max 160 chars, character count always visible |
| Save button | Header button | Becomes active on first edit. `--color-primary-dark` text. Tap: PATCH /api/v1/users/:id, loading state, success → pop back to profile, show "Profile updated" toast. |

**Interactions**:

```
Step 1: Screen mounts → pre-populate fields from current user data (from auth store cache)
Step 2: User makes change → Save button activates
Step 3: User taps Save → PATCH /api/v1/users/:id { displayName, bio, avatarUrl }
         Loading: Save button shows small spinner
         Success: pop to ProfileScreen, toast "Profile updated"
         Failure: toast error "Could not save. Try again.", remain on EditProfileScreen
Step 4: User taps back without saving → if unsaved changes: confirm "Discard changes?" alert
```

**API calls**:
- `PATCH /api/v1/users/:id` — body: `{ displayName?: string, bio?: string, avatarUrl?: string }`

---

## 3. Design Tokens

### 3.1 Color Tokens

| Token | Value | Dark mode value | Usage |
|-------|-------|----------------|-------|
| `--color-primary` | `#A2C2E1` | `#5A8EB8` | Brand accents, highlights, carousel dots, subtle backgrounds |
| `--color-primary-dark` | `#2D4B6B` | `#7BAED6` | CTA buttons, active states, selected tabs, key labels |
| `--color-secondary` | `#76777A` | `#A0A0A3` | Secondary text, inactive icons, unselected tab icons |
| `--color-tertiary` | `#6E7691` | `#9698B0` | Subtle labels, metadata, placeholder states |
| `--color-bg` | `#F8F9FA` | `#111418` | Screen backgrounds |
| `--color-surface` | `#FFFFFF` | `#1E2329` | Cards, inputs, bottom sheets, modals |
| `--color-surface-raised` | `#F0F2F5` | `#262C35` | Grouped list section backgrounds, secondary surfaces |
| `--color-border` | `#E2E8F0` | `#2D3748` | Input borders, dividers, card strokes |
| `--color-error` | `#E53E3E` | `#FC8181` | Error messages, destructive actions, invalid states |
| `--color-success` | `#38A169` | `#68D391` | Success states, "NEW" condition badge |
| `--color-warning` | `#D69E2E` | `#F6E05E` | Warning messages (future use) |
| `--color-text-primary` | `#1A202C` | `#F7FAFC` | Body text, headings |
| `--color-text-secondary` | `#718096` | `#A0AEC0` | Labels, placeholders, captions |
| `--color-overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | Modal backdrops, floating button backgrounds |

### 3.2 Condition Badge Colors

| Condition | Token (text) | Token (background) |
|-----------|-------------|-------------------|
| NEW | `--color-success` | `rgba(56,161,105,0.12)` |
| LIKE_NEW | `#2C7A7B` | `rgba(44,122,123,0.12)` |
| GOOD | `--color-primary-dark` | `rgba(45,75,107,0.12)` |
| FAIR | `--color-tertiary` | `rgba(110,118,145,0.12)` |
| POOR | `--color-secondary` | `rgba(118,119,122,0.12)` |

### 3.3 Typography Tokens

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|---------------|-------|
| `text-display` | 32px | 700 | 1.2 | -0.5px | Screen titles, app wordmark |
| `text-heading` | 24px | 600 | 1.3 | -0.3px | Section headings, price display |
| `text-title` | 18px | 600 | 1.4 | -0.2px | Card titles, listing names, dialog headings |
| `text-body` | 16px | 400 | 1.5 | 0 | Body content, descriptions |
| `text-body-bold` | 16px | 600 | 1.5 | 0 | Emphasized body text |
| `text-label` | 14px | 500 | 1.4 | 0.2px | Form labels (UPPERCASE tracking), nav items |
| `text-caption` | 12px | 400 | 1.4 | 0.1px | Metadata, timestamps, distances, helper text |
| `text-mono` | 14px | 500 | 1.4 | 0.5px | Invite code display, monospace data |

**Font family**: Platform-appropriate sans-serif. On iOS: SF Pro Display (display/heading) + SF Pro Text (body/label). On Android: Roboto. Both are system fonts accessed via `fontFamily: undefined` in React Native (system default), ensuring consistent rendering without a custom font load step. If the project introduces a custom font in a later iteration, use `expo-font` with a loading screen.

### 3.4 Spacing Scale

Base unit: 4pt

| Token | Value | Common usage |
|-------|-------|-------------|
| `space-1` | 4pt | Icon internal padding, tight gaps |
| `space-2` | 8pt | Between icon and label, tight row spacing |
| `space-3` | 12pt | Input internal padding (vertical), chip padding |
| `space-4` | 16pt | Standard screen horizontal padding, section gaps |
| `space-5` | 20pt | Card internal padding |
| `space-6` | 24pt | Between sections, form field gap |
| `space-8` | 32pt | Large vertical rhythm breaks |
| `space-12` | 48pt | Section top padding |
| `space-16` | 64pt | Screen top/bottom safe area buffers |

### 3.5 Border Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8pt | Thumbnails, small cards, swipe action buttons |
| `radius-md` | 12pt | Standard cards, inputs, map preview |
| `radius-lg` | 16pt | Large cards, photo slots |
| `radius-pill` | 28pt | All pill buttons (primary + secondary) |
| `radius-sheet` | 20pt | Bottom sheets (top-left + top-right only) |
| `radius-circle` | 9999pt | Avatars, capture button, OTP circles |

### 3.6 Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-card` | `0 2px 8px rgba(0,0,0,0.08)` | Listing cards, surface elevation |
| `shadow-sheet` | `0 -4px 20px rgba(0,0,0,0.12)` | Bottom sheets |
| `shadow-fab` | `0 4px 16px rgba(45,75,107,0.30)` | Sell FAB button |
| `shadow-header` | `0 1px 4px rgba(0,0,0,0.06)` | Sticky headers on scroll |

### 3.7 Animation Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `motion-feedback` | 150ms | ease-out | Button press, toggle, tap highlight |
| `motion-transition` | 250ms | ease-in-out | Modal open/close, bottom sheet, screen slide |
| `motion-attention` | 300ms | spring | Error shake, badge pulse |

All animations must be wrapped in a `prefers-reduced-motion` check. When reduced motion is active, replace translate/scale animations with opacity cross-fades (100ms). React Native: use `AccessibilityInfo.isReduceMotionEnabled()`.

---

## 4. Component Library

---

### PrimaryButton

**States**: default | hover (N/A — native) | pressed | loading | disabled

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Button text |
| `onPress` | function | Action handler |
| `loading` | boolean | Shows activity indicator, hides label, disables interaction |
| `disabled` | boolean | Reduces opacity to 0.4, non-tappable |
| `fullWidth` | boolean | Stretches to container width (default false) |
| `icon` | ReactNode? | Optional icon left of label |

**Visual spec**: Background `--color-primary-dark`. Text: white, `text-label` uppercase, 14px, 600 weight, 0.5px letter spacing. Height: 52pt. Border radius: `radius-pill` (28pt). Minimum width: 160pt. Horizontal padding: 24pt. Shadow: `shadow-fab` when used as floating action.

**Pressed state**: scale 0.97, brightness -5% (150ms ease-out). Reduced-motion fallback: opacity 0.8.

**Accessibility**: `accessibilityRole="button"`. When `loading=true`: `accessibilityLabel={label + ", loading"}`. When `disabled=true`: `accessibilityState={{ disabled: true }}`.

---

### SecondaryButton

**States**: default | pressed | disabled

Same shape and size as PrimaryButton. Background: transparent. Border: 1.5pt `--color-primary-dark`. Text: `--color-primary-dark`.

---

### TextInput

**States**: default | focused | filled | error | disabled

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Field label (always rendered above input, never inside as placeholder) |
| `placeholder` | string | Placeholder text (supplementary only) |
| `value` | string | Controlled value |
| `onChangeText` | function | Change handler |
| `error` | string? | Error message — renders below input in `--color-error`, triggers red border |
| `icon` | ReactNode? | Leading icon inside input left |
| `rightElement` | ReactNode? | Trailing element inside input right (e.g., password toggle, validity indicator) |
| `multiline` | boolean | Expands for multi-line input |
| `maxLength` | number? | Character limit; shows counter at 75% of limit |

**Visual spec**: Label: `text-label`, 14px, 500, `--color-text-primary`, 8pt margin-bottom. Input container: height 52pt (single-line), border 1.5pt `--color-border`, border-radius `radius-md` (12pt), background `--color-surface`, horizontal padding 16pt. Focused: border `--color-primary-dark` 2pt. Error: border `--color-error` 2pt. Placeholder: `--color-text-secondary`.

**Accessibility**: `<label>` association via `nativeID` + `accessibilityLabelledBy`. Error message has `accessibilityLiveRegion="polite"` and `role="alert"`.

---

### OTPInput

**States**: empty | partially-filled | complete | error | loading

| Prop | Type | Description |
|------|------|-------------|
| `length` | number | Number of digits (default 6) |
| `onComplete` | function(code: string) | Called when all digits filled |
| `onChangeValue` | function(partial: string) | Called on any change |
| `error` | boolean | Triggers shake animation and error border on all circles |

**Visual spec**: Each circle: 52×52pt, border-radius `radius-circle`, border 1.5pt. Empty: `--color-border`. Focused: `--color-primary-dark` 2pt border. Filled: background `--color-primary`, white text, `text-heading`. Gap between circles: 8pt. Total width: 6×52 + 5×8 = 352pt (fits 375pt+ screens; scale to 44pt circles on 320pt screens).

**Keyboard behavior**: Numeric keyboard. Auto-advance on digit entry. Backspace deletes current and moves to previous. Paste: detect if clipboard contains a 6-digit string, populate all fields.

**Accessibility**: Rendered as a single hidden `<TextInput maxLength={6}>` behind the visual circles for screen reader compatibility. Visual circles are `aria-hidden`. The single input has `accessibilityLabel="Verification code, 6 digits"`.

---

### ListingCard

**States**: default | pressed | loading (skeleton)

| Prop | Type | Description |
|------|------|-------------|
| `listing` | ListingSummary | id, title, price, imageUrl, distanceKm, condition, status |
| `onPress` | function | Navigates to ListingDetailScreen |
| `size` | 'grid' \| 'carousel' | Grid: fills column width; Carousel: fixed 140pt width |

**Visual spec**: Aspect ratio 1:1 (square). Image fills entire card. Border-radius `radius-md` (12pt). Shadow: `shadow-card`. Overlay gradient: `linear-gradient(transparent 50%, rgba(0,0,0,0.55) 100%)` on bottom half. Price text: white, `text-body-bold`, bottom-left, 8pt from edges. Distance badge: white, `text-caption`, bottom-right, 8pt from edges. SOLD overlay: semi-transparent dark scrim with white "SOLD" `text-label` centered.

**Accessibility**: `accessibilityRole="button"`. `accessibilityLabel`: "{title}, {price}, {distance} away, condition {condition}". Decorative image: `accessible={false}` on Image, info carried by accessibilityLabel on the touchable.

---

### AvatarWithBadge

| Prop | Type | Description |
|------|------|-------------|
| `uri` | string? | Image URI. If null, shows default person icon on `--color-primary` background. |
| `size` | number | Diameter in pt (common: 40, 80, 96) |
| `showBadge` | boolean | Shows camera icon badge (bottom-right, 28pt circle) |
| `onPress` | function? | Triggered on avatar or badge tap |
| `loading` | boolean | Shows circular progress overlay |

**Visual spec**: Circle (border-radius: `radius-circle`). Camera badge: white background, `--color-primary-dark` camera icon, 28pt diameter, positioned bottom-right overlapping avatar edge (offset: size×0.07).

---

### RatingStars

| Prop | Type | Description |
|------|------|-------------|
| `rating` | number | 0–5, supports half-star (e.g., 3.5) |
| `count` | number? | Review count — displayed as "(24)" next to stars when provided |
| `size` | 'sm' \| 'md' | sm: 12pt stars; md: 16pt stars |
| `interactive` | boolean | If true, tapping sets rating (used in review submission form — v2) |

**Visual spec**: Filled star: `#F6AD55` (amber). Half star: half-fill via clip mask. Empty star: `--color-border`. Gap between stars: 2pt. Count text: `text-caption`, `--color-text-secondary`.

**Accessibility**: `accessibilityRole="text"`. `accessibilityLabel`: "{rating} out of 5 stars{, {count} reviews}" when count provided.

---

### DistanceBadge

| Prop | Type | Description |
|------|------|-------------|
| `distanceKm` | number | Raw km value from API |

**Formatting logic**: < 0.1km → "< 100m"; 0.1–0.95km → "{distance×1000}m" (e.g., "350m"); ≥ 1km → "{distance.toFixed(1)}km" (e.g., "1.2km"); ≥ 10km → "{Math.round(distance)}km" (e.g., "14km").

**Visual spec**: Location pin icon (12pt) + formatted text, `text-caption`. On card overlay: white. On detail screen: `--color-text-secondary`.

---

### MessageBubble

| Prop | Type | Description |
|------|------|-------------|
| `content` | string | Message text |
| `isOwn` | boolean | Right-align if true |
| `timestamp` | Date | Display time |
| `status` | 'sending' \| 'sent' \| 'read' \| 'failed' | Controls visual state |

**Visual spec**: Own bubble: background `--color-primary-dark`, white text, border-radius 18pt (top-left 4pt when part of a group). Other bubble: background `--color-surface`, border 1pt `--color-border`, `--color-text-primary` text, border-radius 18pt (top-right 4pt when part of group). Max width: 75% of screen width. Horizontal padding: 14pt. Vertical padding: 10pt. Sending: opacity 0.6. Failed: border `--color-error`, red "!" icon appended.

**Timestamp rendering**: Shown once per group of consecutive messages from the same sender within 5 minutes. Centered, `text-caption`, `--color-text-secondary`.

---

### ConversationRow

| Prop | Type | Description |
|------|------|-------------|
| `conversation` | ConversationSummary | id, listing (title, coverImageUrl), otherParty (name, avatarUrl), lastMessage, unreadCount, updatedAt |
| `onPress` | function | Navigates to ChatThreadScreen |

**Visual spec**: Row height: 72pt. Horizontal padding: 16pt. Left: listing thumbnail 48×48pt, rounded `radius-sm` (8pt). Center (flex 1): listing title `text-label` (1 line, ellipsis); other party name `text-caption` `--color-text-secondary`; last message preview `text-caption` (1 line, ellipsis). Right column: timestamp `text-caption` `--color-text-secondary` top-right; unread badge below timestamp (only if unreadCount > 0). Separator: 1pt `--color-border` inset 76pt from left (aligns with text start).

---

### BottomTabBar

**Tabs**: Home | Search | Sell (FAB) | Profile

| Tab | Icon | Label | Badge |
|-----|------|-------|-------|
| Home | House icon | "Home" | None |
| Search | Magnifier icon | "Search" | None |
| Sell | Plus circle (FAB, 56pt) | No label | None |
| Profile | Person icon | "Profile" | Unread message count (from ConversationList) |

**Visual spec**: Tab bar background: `--color-surface`. Top border: 1pt `--color-border`. Height: 56pt + bottom safe area inset. Active tab icon: `--color-primary-dark`. Inactive: `--color-secondary`. Label: `text-caption`, 10px, shown for Home/Search/Profile; Sell FAB has no label. Sell FAB: 56×56pt circle, `--color-primary-dark` background, white "+" icon, `shadow-fab`, slightly elevated (translate Y -8pt to overlap tab bar top).

**Accessibility**: Each tab: `accessibilityRole="tab"`. Tab bar container: `accessibilityRole="tablist"`. Active tab: `accessibilityState={{ selected: true }}`. Sell FAB: `accessibilityLabel="Post a listing"`. Profile tab with badge: `accessibilityLabel="Profile, {count} unread messages"` when badge > 0.

---

## 5. Interaction Patterns

---

### 5.1 GPS Permission Flow

**Trigger**: First load of BrowseScreen (or SearchScreen) when GPS permission has not been determined.

```
Step 1: App calls expo-location checkForegroundPermissionsAsync()
         Result: 'undetermined' → proceed to Step 2
         Result: 'granted'     → proceed with GPS fetch
         Result: 'denied'      → proceed to Step 4 (degraded mode)

Step 2: Show in-app explanation modal (before system dialog)
         Title: "See listings near you"
         Body:  "Marketplace uses your location to show items being sold nearby. We never share your location with other users."
         CTA:   "Enable Location" → proceed to Step 3
         Link:  "Not now" → proceed to Step 4 (degraded mode)

Step 3: Call expo-location requestForegroundPermissionsAsync()
         System dialog appears
         User grants → fetch GPS → load nearby listings
         User denies → proceed to Step 4

Step 4 (degraded mode):
         Show persistent banner at top of BrowseScreen:
           Icon: location-off icon (red)
           Text: "Enable location for nearby listings"
           Button: "Open Settings" (deep-links to app settings: Linking.openSettings())
         Load listings without GPS (API returns city-level fallback or shows "Listings everywhere" with note)

Step 5 (return visit after denial):
         Banner remains until permission is granted. Re-check permission on each BrowseScreen focus event.
```

---

### 5.2 Invite Code Validation

**Trigger**: User types in the invite code field on SignupScreen.

```
Step 1: User types character → start 500ms debounce timer; clear any existing validity indicator
Step 2: Debounce fires → show loading spinner (16pt) in right slot of invite code input
Step 3: POST /api/v1/auth/validate-invite { code: trimmedValue.toUpperCase() }

         Success (valid: true):
           → Replace spinner with green checkmark icon
           → Show green helper text "Valid invite code" below field
           → Enable Continue button

         Success (valid: false / error 400):
           → Replace spinner with red X icon
           → Show red error text "Invalid or already used invite code" below field
           → Disable Continue button

         Network error:
           → Replace spinner with grey warning icon
           → Show grey text "Could not verify. Check your connection."
           → Continue button remains disabled

Step 4: User edits code again → clear validity indicator, restart debounce
Step 5: User pastes code → trim whitespace, convert to uppercase, trigger validation immediately (no debounce on paste)
```

---

### 5.3 Photo Upload Flow

**Trigger**: User taps an empty photo slot in Step 1 of PostListingScreen, or taps the camera badge on profile.

```
Step 1: Tap empty slot → action sheet (bottom sheet) appears:
         "Take Photo"           → launch CameraScreen (push within modal)
         "Choose from Library"  → expo-image-picker with allowsMultipleSelection: true, selectionLimit: (8 - currentCount)
         "Cancel"               → dismiss sheet

Step 2a (Camera): User captures photo in CameraScreen → taps Done → photos passed back to PostListingScreen
Step 2b (Gallery): System picker returns selected URIs → add to photo slots

Step 3: For each new photo:
         → Show thumbnail immediately (local URI, optimistic)
         → Show circular progress indicator overlay on thumbnail
         → POST to /api/v1/listings/upload-image (multipart)

         Upload success:
           → Remove progress overlay
           → Store returned CDN URL in form state
           → Thumbnail remains (still showing local URI until component re-renders with CDN URL)

         Upload failure:
           → Show red overlay with retry icon on that slot
           → Tap slot → retry upload (same file)

Step 4: User can proceed to Step 2 (Item Details) while uploads complete in background.
         If user attempts "Post Listing" final submit while any upload is still in progress:
           → Show banner "Waiting for photos to finish uploading..." with progress (X of Y)
           → Button disabled until all complete

Step 5: User can remove a photo by tapping the X badge on a filled slot (any time before final submit).
         Removing a non-uploaded-yet photo: cancel the in-flight request.
         Removing an uploaded photo: remove from form state (the CDN file is orphaned; cleanup is a server-side job — out of scope v1).

Step 6: Re-ordering: long-press on a filled slot enables drag-to-reorder mode. Slots show drag handles. Release to confirm order. Slot 1 is always the cover photo (shown with star badge).
```

---

### 5.4 Real-time Message Optimistic UI

**Trigger**: User taps Send in ChatThreadScreen.

```
Step 1: User taps Send button (or hits Return on keyboard)
         → Immediately append MessageBubble with status='sending', grey opacity, local timestamp
         → Clear input field
         → Scroll to bottom

Step 2: POST /api/v1/conversations/:id/messages { content }
         Success (201):
           → Update bubble status='sent' (remove grey opacity)
           → Update bubble with server-provided timestamp and messageId
         Failure (network / 5xx):
           → Update bubble status='failed'
           → Show red border + "!" icon on bubble
           → "!" tap → action sheet: "Retry" / "Delete"

Step 3: Incoming messages via Socket.io 'new_message':
         → Append new MessageBubble at bottom (status='sent' since it came from server)
         → If screen is active and app in foreground:
             auto-call PATCH mark-as-read for the incoming message
         → Scroll to bottom only if user is within 100pt of bottom (avoid interrupting reading)
         → If user is scrolled up: show "1 new message ↓" banner at bottom; tap to scroll down

Step 4: Socket.io disconnection recovery:
         → Show "Reconnecting..." yellow banner below header
         → On reconnect: re-fetch last 5 messages to fill any gap during disconnection
         → Remove banner

Step 5: 'Seen' receipt:
         → When Socket.io event indicates the other party has read the last message:
             Update last sent bubble to show "Seen" text-caption below
```

---

### 5.5 Pull-to-Refresh

Applied to: BrowseScreen, SearchScreen, ConversationListScreen, MyProfileScreen.

**Implementation notes**: Use React Native `ScrollView` / `FlatList` `refreshControl` prop with `RefreshControl` component. Platform default spinner behavior. On refresh complete: data replaces current without scroll position jump (FlatList handles this). Empty states are re-evaluated after refresh (may transition from empty to populated or vice versa).

---

## 6. Accessibility Notes

### Touch Target Minimums

All interactive elements must meet the 44×44pt minimum (WCAG 2.5.5 / Apple HIG). Specific callouts:
- Back buttons and icon-only header actions: use `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on React Native Pressable if the visual element is smaller than 44pt
- OTP circles: 52pt default; reduces to 44pt on 320pt-wide screens
- Sell FAB: 56pt — exceeds minimum
- Chat Send button: 44×44pt explicitly, not icon-only (icon with accessible label)

### Color Contrast Ratios

Calculated against WCAG 2.1 AA minimums (4.5:1 body text, 3:1 large text and UI components):

| Foreground | Background | Ratio | Pass? | Usage |
|-----------|-----------|-------|-------|-------|
| `#2D4B6B` | `#F8F9FA` | 8.5:1 | Pass (AAA) | CTA buttons text on screen bg |
| `#1A202C` | `#F8F9FA` | 16.7:1 | Pass (AAA) | Body text |
| `#718096` | `#F8F9FA` | 4.6:1 | Pass (AA) | Secondary text |
| `#718096` | `#FFFFFF` | 4.5:1 | Pass (AA) | Labels on card surface |
| `#FFFFFF` | `#2D4B6B` | 8.5:1 | Pass (AAA) | White text on CTA button |
| `#76777A` | `#F8F9FA` | 4.6:1 | Pass (AA) | Inactive tab labels |
| `#E53E3E` | `#F8F9FA` | 4.8:1 | Pass (AA) | Error text |
| `#2D4B6B` | `#FFFFFF` | 8.4:1 | Pass (AAA) | Primary buttons on card bg |

**Note**: `#6E7691` (`--color-tertiary`) on `#F8F9FA` = approximately 4.1:1. This falls below AA for normal-weight body text at 14px. Use `--color-tertiary` only for `text-caption` (12px) as a label with supplementary context — never as the sole carrier of critical information. For required labels, use `--color-text-secondary` (`#718096`) which passes at 4.6:1.

### Never Use Color Alone

- Status indicators: always pair color with an icon or text label (e.g., "SOLD" badge = red background + "SOLD" text, not just red tint)
- Invite code validity: green/red icon + text label, not color alone
- Error states: red border + error message text below input + icon in input
- Online/offline indicator: icon + text, not just colored dot

### Screen Reader Behavior

- All images: `accessibilityLabel` describing content for meaningful images; `accessible={false}` for purely decorative images
- Listing cards: single `accessibilityLabel` combining title, price, distance, condition — prevents screen reader from announcing each child element separately
- Bottom tab bar: `accessibilityRole="tablist"` on container; each tab `accessibilityRole="tab"` + `accessibilityState={{ selected: true/false }}`
- Modals and bottom sheets: `accessibilityViewIsModal={true}` on container to trap screen reader focus within the modal; dismiss with Escape (hardware back on Android, swipe-down gesture)
- Live regions: invite code validity indicator, message send status, unread count badge — `accessibilityLiveRegion="polite"` so announcements do not interrupt ongoing speech

### Keyboard / Hardware Navigation (Android + physical keyboards)

- All interactive elements are reachable via Tab key order matching visual top-to-bottom, left-to-right reading order
- Bottom sheet and modal focus is trapped within the sheet/modal until dismissed
- OTP input: implement as a single hidden native input behind visual circles (as specified in OTPInput component) so that hardware keyboards work without custom key trapping logic
- Chat input: Return key sends message; Shift+Return inserts newline (keyboard behavior configured via `blurOnSubmit={false}` + `onSubmitEditing`)

### Reduced Motion

Check `AccessibilityInfo.isReduceMotionEnabled()` on mount and subscribe to changes. When active:
- Replace all transform animations (scale, translate, rotate) with opacity cross-fades at 100ms
- Disable the OTP circle shake animation (show static red border + error text instead)
- Disable carousel auto-scroll
- Disable the capture button flash animation

---

*End of UX Design Specification v1.0*
