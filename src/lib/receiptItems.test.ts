import { describe, expect, it } from "vitest";
import { isRecallReady } from "./receiptItems";

describe("isRecallReady", () => {
  it("needs a brand", () => {
    expect(isRecallReady({ name: "Organic Apple Pouch", brand: "" })).toBe(false);
  });
  it("rejects abbreviated receipt names", () => {
    expect(isRecallReady({ name: "GRB PCH", brand: "Gerber" })).toBe(false);
  });
  it("accepts a full brand and product name", () => {
    expect(isRecallReady({ name: "Organic Apple Pouch", brand: "Gerber" })).toBe(true);
  });
});
