import { describe, expect, it } from "vitest";
import { APP_USER_AGENT_MARKER, isIOSAppWebView, nativeAppSignals } from "./isNativeApp";

const APP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1";
const INSTAGRAM_UA = `${APP_UA} Instagram 300.0.0.0`;
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";

describe("native app detection", () => {
  it("treats the iPhone app's web view as the app", () => {
    expect(isIOSAppWebView(APP_UA)).toBe(true);
    expect(nativeAppSignals({}, APP_UA).native).toBe(true);
  });

  it("does not treat iPhone Safari as the app", () => {
    expect(nativeAppSignals({}, SAFARI_UA).native).toBe(false);
  });

  it("does not treat social in-app browsers or a desktop (non-touch) Mac as the app", () => {
    expect(nativeAppSignals({}, INSTAGRAM_UA).native).toBe(false);
    expect(nativeAppSignals({}, MAC_UA, 0).native).toBe(false);
  });

  // Apple 3.1.1 rejection (Nov 18, 2026) was on an iPad Air: iPadOS web
  // views send a desktop Mac user agent, which used to read as "not the app".
  it("treats the iPad app's desktop-style web view as the app on a touch screen", () => {
    expect(nativeAppSignals({}, MAC_UA, 5).native).toBe(true);
    expect(nativeAppSignals({}, MAC_UA, 0).native).toBe(false);
  });

  it("does not treat iPad Safari (desktop mode) as the app", () => {
    const IPAD_SAFARI =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Safari/605.1.15";
    expect(nativeAppSignals({}, IPAD_SAFARI, 5).native).toBe(false);
  });

  it("trusts the app's own user-agent marker", () => {
    expect(nativeAppSignals({}, `${SAFARI_UA} ${APP_USER_AGENT_MARKER}`, 5).native).toBe(true);
    expect(isIOSAppWebView(`${MAC_UA} ${APP_USER_AGENT_MARKER}`, 0)).toBe(true);
  });

  it("server-side (no touch info) treats any Mac-style web view as possibly the iPad app", () => {
    expect(isIOSAppWebView(MAC_UA)).toBe(true);
    expect(isIOSAppWebView("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36")).toBe(false);
  });

  it("trusts the Capacitor bridge even with a Safari user agent", () => {
    expect(nativeAppSignals({ Capacitor: { isNativePlatform: () => true } }, SAFARI_UA).native).toBe(true);
    expect(nativeAppSignals({ webkit: { messageHandlers: { bridge: {} } } }, SAFARI_UA).native).toBe(true);
  });
});
