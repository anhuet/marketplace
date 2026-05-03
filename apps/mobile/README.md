# Marketplace Mobile App

React Native (Expo) app cho iOS và Android.

---

## Yêu cầu

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Yarn | Classic v1 |
| Expo Go | App trên điện thoại (iOS/Android) |
| iOS Simulator | Xcode (Mac only) |
| Android Emulator | Android Studio |

---

## Cài đặt

Chạy từ **thư mục gốc của monorepo** (không phải trong `apps/mobile/`):

```bash
yarn install
```

---

## Cấu hình môi trường

Tạo file `apps/mobile/.env`:

```env
# Backend API URL
EXPO_PUBLIC_API_URL=http://54.175.34.74/api/v1

# Auth0
EXPO_PUBLIC_AUTH0_DOMAIN=dev-htobs7e6.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=<your-auth0-client-id>
EXPO_PUBLIC_AUTH0_AUDIENCE=marketplace-app
```

> **Chạy local backend**: đổi `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1`

---

## Chạy development

```bash
# Từ thư mục gốc monorepo
yarn workspace mobile start
```

Expo sẽ hiện QR code và menu:

```
› Press s │ switch to Expo Go
› Press i │ open iOS simulator
› Press a │ open Android emulator
› Press r │ reload app
```

### Trên điện thoại thật (Expo Go)
1. Cài app **Expo Go** từ App Store / Google Play
2. Scan QR code trên terminal
3. Đảm bảo điện thoại và máy tính **cùng WiFi**

### Trên iOS Simulator (Mac)
```bash
yarn workspace mobile ios
```

### Trên Android Emulator
```bash
yarn workspace mobile android
```

---

## Chạy backend local (tuỳ chọn)

Nếu muốn test với backend chạy trên máy thay vì AWS:

```bash
# Terminal 1 — khởi động PostgreSQL
docker run -d --name marketplace-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=marketplace \
  -p 5432:5432 postgres:15-alpine

# Terminal 2 — chạy backend
yarn workspace backend dev
```

Sau đó đổi `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1` trong `apps/mobile/.env` và restart Expo.

> **Lưu ý iOS Simulator**: dùng `http://localhost:3000/api/v1`
> **Lưu ý Android Emulator**: dùng `http://10.0.2.2:3000/api/v1` (Android map localhost qua IP này)
> **Lưu ý điện thoại thật**: dùng IP máy tính trong LAN, ví dụ `http://192.168.1.x:3000/api/v1`

---

## Build production

Dùng EAS (Expo Application Services):

```bash
# Cài EAS CLI
npm install -g eas-cli
eas login

# Build iOS
yarn workspace mobile build:ios

# Build Android
yarn workspace mobile build:android
```

---

## Cấu trúc thư mục

```
apps/mobile/
├── App.tsx                  # Entry point
├── app.config.js            # Expo config (đọc Auth0 từ env)
├── src/
│   ├── lib/
│   │   ├── api.ts           # Axios client + typed API calls
│   │   └── socket.ts        # Socket.io client
│   ├── navigation/
│   │   ├── RootNavigator.tsx   # Auth ↔ Main switch
│   │   ├── AuthNavigator.tsx   # Login, Signup, ProfileSetup
│   │   └── MainNavigator.tsx   # Bottom tabs
│   ├── screens/
│   │   ├── auth/            # Login, Signup, ProfileSetup
│   │   ├── browse/          # BrowseScreen, ListingDetail
│   │   ├── chat/            # ConversationList, ChatThread
│   │   ├── profile/         # Profile, EditProfile, Settings
│   │   ├── search/          # SearchScreen
│   │   └── sell/            # PostListing
│   ├── store/
│   │   ├── authStore.ts     # Zustand — auth session
│   │   └── chatStore.ts     # Zustand — chat data
│   └── theme/
│       └── tokens.ts        # Colors, spacing, typography
```

---

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|-----------|
| `Network request failed` | Kiểm tra `EXPO_PUBLIC_API_URL` đúng chưa, backend có đang chạy không |
| QR code không scan được | Đảm bảo điện thoại và máy tính cùng WiFi |
| Android emulator không kết nối localhost | Dùng `10.0.2.2` thay cho `localhost` |
| `Metro bundler` lỗi cache | Chạy `yarn workspace mobile start --clear` |
| Expo Go báo version mismatch | Cập nhật Expo Go trên điện thoại lên bản mới nhất |
