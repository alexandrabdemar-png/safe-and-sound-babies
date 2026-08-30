import { describe, it, expect } from "vitest";
import { buildOAuthInitiateUrl } from "./oauthBroker";

describe("buildOAuthInitiateUrl", () => {
  it("points at the broker path on the given origin", () => {
    const url = new URL(
      buildOAuthInitiateUrl(
        "https://peace-of-mine.lovable.app",
        "google",
        "https://peace-of-mine.lovable.app/auth/callback",
      ),
    );
    expect(url.origin).toBe("https://peace-of-mine.lovable.app");
    expect(url.pathname).toBe("/~oauth/initiate");
  });

  it("includes the provider and redirect_uri as query params", () => {
    const url = new URL(
      buildOAuthInitiateUrl(
        "https://peace-of-mine.lovable.app",
        "apple",
        "https://peace-of-mine.lovable.app/auth/callback",
      ),
    );
    expect(url.searchParams.get("provider")).toBe("apple");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://peace-of-mine.lovable.app/auth/callback",
    );
  });

  it("includes a non-empty state param that varies between calls", () => {
    const a = new URL(
      buildOAuthInitiateUrl(
        "https://peace-of-mine.lovable.app",
        "google",
        "https://x/auth/callback",
      ),
    ).searchParams.get("state");
    const b = new URL(
      buildOAuthInitiateUrl(
        "https://peace-of-mine.lovable.app",
        "google",
        "https://x/auth/callback",
      ),
    ).searchParams.get("state");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
