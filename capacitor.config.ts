import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.peaceofmine.app",
  appName: "Peace of Mine",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: ["*.supabase.co", "*.stripe.com", "*.saferproducts.gov", "api.fda.gov"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
      // iOS Critical Alerts: bypasses Do Not Disturb and muted notifications.
      // Requires Apple entitlement — apply at:
      // https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
      // Once approved, set this to true and re-submit to the App Store.
      // criticalAlerts: true,
    },
    Browser: {
      presentationStyle: "popover",
    },
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#FAF8F5",
  },
};

export default config;
