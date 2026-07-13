import { describe, it, expect } from "vitest";
import { isPreviewHost } from "./previewHost";

describe("isPreviewHost", () => {
  it("matches Lovable preview subdomains", () => {
    expect(isPreviewHost("id-preview--abc123.lovable.app")).toBe(true);
    expect(isPreviewHost("id-preview-700a70da--bc8c84ba.lovable.app")).toBe(true);
  });

  it("matches lovable.dev sandbox hosts", () => {
    expect(isPreviewHost("something.lovable.dev")).toBe(true);
    expect(isPreviewHost("lovable.dev")).toBe(true);
  });

  it("matches localhost / 127.0.0.1", () => {
    expect(isPreviewHost("localhost")).toBe(true);
    expect(isPreviewHost("127.0.0.1")).toBe(true);
  });

  it("does NOT match the published production host", () => {
    expect(isPreviewHost("peace-of-mine.lovable.app")).toBe(false);
  });

  it("does NOT match published deployment aliases (project--*.lovable.app)", () => {
    expect(isPreviewHost("project--bc8c84ba-6f03-4794-b4f7-139ad9986d7b.lovable.app")).toBe(false);
  });

  it("does NOT match arbitrary custom domains", () => {
    expect(isPreviewHost("example.com")).toBe(false);
    expect(isPreviewHost("www.example.com")).toBe(false);
    expect(isPreviewHost("evil-lovable.app.attacker.com")).toBe(false);
  });

  it("does NOT match a spoof attempt appending .lovable.app suffix as a subdomain of an attacker origin", () => {
    // hostname is compared exactly; the regex uses ^/$ anchors + subdomain
    // boundaries so an attacker can't just append the preview shape to
    // another domain.
    expect(isPreviewHost("id-preview--x.lovable.app.attacker.com")).toBe(false);
    expect(isPreviewHost("lovable.dev.attacker.com")).toBe(false);
  });

  it("returns false for empty / nullish input", () => {
    expect(isPreviewHost("")).toBe(false);
    expect(isPreviewHost(null)).toBe(false);
    expect(isPreviewHost(undefined)).toBe(false);
  });
});
