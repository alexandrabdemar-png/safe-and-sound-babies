/**
 * Opens a URL in an in-app browser when running inside Capacitor (iOS/Android),
 * falling back to window.open for web browsers.
 */
export async function openUrl(url: string): Promise<void> {
  try {
    // Dynamically import Capacitor Browser plugin — only available in native builds.
    // The import will fail gracefully in web environments.
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    // Web fallback
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
