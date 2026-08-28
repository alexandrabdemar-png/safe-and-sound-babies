import type { CapacitorConfig } from "@capacitor/cli";

// This app is server-rendered (TanStack Start), so the iOS build is a native
// shell that loads the hosted app over https instead of a static bundle. The
// Capacitor JS bridge is still injected into the remote page, so native
// plugins (push notifications, browser, camera) work normally.
//
// Override the hosted URL when testing against preview:
//   CAP_SERVER_URL=https://id-preview--<id>.lovable.app bun run ios:sync
const HOSTED_URL = process.env.CAP_SERVER_URL || "https://peace-of-mine.lovable.app";

const config: CapacitorConfig = {
  appId: "com.peaceofmine.baby",
  appName: "Peace of Mine",
  // Static fallback shown only when the hosted app can't be reached.
  webDir: "ios-shell",
  server: {
    url: HOSTED_URL,
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      "peace-of-mine.lovable.app",
      "*.lovable.app",
      "*.supabase.co",
      "*.stripe.com",
      "*.saferproducts.gov",
      "api.fda.gov",
      // Google Sign-In's OAuth flow (@lovable.dev/cloud-auth-js's
      // signInWithOAuth) does a full-page redirect from this app's own
      // origin (via Lovable's same-origin /~oauth/initiate route) out to
      // Google's consent screen and back — without Google's domain
      // allowlisted here, Capacitor's WKWebView silently blocks that
      // cross-origin navigation and the sign-in flow just stalls with no
      // visible error. Wildcarded like the other trusted third parties
      // above since Google's OAuth handshake can bounce through several
      // subdomains (account chooser, 2FA/"verify it's you" challenges),
      // not just accounts.google.com.
      "*.google.com",
      // Same reasoning, same fix, for "Sign in with Apple" — that flow
      // redirects out to appleid.apple.com for the actual consent/
      // authentication step, and can also touch other apple.com
      // subdomains for two-factor verification.
      "*.apple.com",
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Browser: {
      presentationStyle: "popover",
    },
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#FAF8F5",
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
