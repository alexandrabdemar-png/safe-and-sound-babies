import { describe, expect, it } from "vitest";
import { isIOSAppWebView, nativeAppSignals } from "./isNativeApp";

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

  it("does not treat social in-app browsers or desktop as the app", () => {
    expect(nativeAppSignals({}, INSTAGRAM_UA).native).toBe(false);
    expect(nativeAppSignals({}, MAC_UA).native).toBe(false);
  });

  it("trusts the Capacitor bridge even with a Safari user agent", () => {
    expect(nativeAppSignals({ Capacitor: { isNativePlatform: () => true } }, SAFARI_UA).native).toBe(true);
    expect(nativeAppSignals({ webkit: { messageHandlers: { bridge: {} } } }, SAFARI_UA).native).toBe(true);
  });
});
