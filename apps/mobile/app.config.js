// Dynamic Expo config — reads Auth0 credentials from environment variables.
// Set these in your shell or a .env file before starting the dev server:
//   EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
//   EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id
//   EXPO_PUBLIC_AUTH0_AUDIENCE=https://your-api-identifier

module.exports = ({ config }) => ({
  ...config,
  extra: {
    auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '',
    auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '',
    auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '',
  },
});
