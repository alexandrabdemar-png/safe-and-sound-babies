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
  appId: "com.peaceofmine.app",
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
