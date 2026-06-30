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
