import { describe, it, expect } from "vitest";
import { isAllowedRecallUrl } from "./recallCheck";

describe("isAllowedRecallUrl", () => {
  it("allows an official cpsc.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.cpsc.gov/Recalls/2024/example")).toBe(true);
  });

  it("allows an official saferproducts.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.saferproducts.gov/RestWebServices/Recall?RecallID=1")).toBe(true);
  });

  it("allows an official fda.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example")).toBe(true);
  });

  it("allows a bare (no subdomain) allowed host", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov/Recalls")).toBe(true);
  });

  it("rejects a non-https URL on an otherwise allowed host", () => {
    expect(isAllowedRecallUrl("http://www.cpsc.gov/Recalls/2024/example")).toBe(false);
  });

  it("rejects a lookalike domain with the allowed host as a suffix of a longer label (cpsc.gov.evil.com)", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov.evil.com/Recalls")).toBe(false);
  });

  it("rejects a lookalike domain that merely contains the allowed host as a substring (evilcpsc.gov)", () => {
    expect(isAllowedRecallUrl("https://evilcpsc.gov/Recalls")).toBe(false);
  });

  it("rejects an unrelated domain entirely", () => {
    expect(isAllowedRecallUrl("https://example.com/not-a-recall")).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    expect(() => isAllowedRecallUrl("not a url")).not.toThrow();
    expect(isAllowedRecallUrl("not a url")).toBe(false);
  });

  it("rejects an empty string instead of throwing", () => {
    expect(() => isAllowedRecallUrl("")).not.toThrow();
    expect(isAllowedRecallUrl("")).toBe(false);
  });
});
