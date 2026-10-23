import { describe, expect, it } from "vitest";
import {
  findExisting,
  groceryStatus,
  groupByWeek,
  startOfWeek,
  type GroceryItem,
} from "./groceries";

const item = (o: Partial<GroceryItem>): GroceryItem => ({
  id: "1",
  name: "Oat Puffs",
  brand: "Happy Baby",
  barcode: null,
  purchased_at: null,
  created_at: "2026-10-01T12:00:00",
  recalled: false,
  recall_checked_at: null,
  ...o,
});

describe("startOfWeek", () => {
  it("starts weeks on Monday", () => {
    expect(startOfWeek(new Date("2026-10-25T15:00:00")).getDate()).toBe(19); // Sunday -> Mon 19th
    expect(startOfWeek(new Date("2026-10-19T00:30:00")).getDate()).toBe(19);
  });
});

describe("groupByWeek", () => {
  const now = new Date("2026-10-23T10:00:00"); // Friday
  it("labels this week, last week, dated weeks and older, newest first", () => {
    const groups = groupByWeek(
      [
        item({ id: "a", purchased_at: "2026-10-20T09:00:00" }),
        item({ id: "b", purchased_at: "2026-10-14T09:00:00" }),
        item({ id: "c", purchased_at: "2026-10-01T09:00:00" }),
        item({ id: "d", purchased_at: "2026-07-01T09:00:00" }),
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(["w0", "w1", "w3", "older"]);
    expect(groups[0]!.label).toBe("This week");
    expect(groups[1]!.label).toBe("Last week");
    expect(groups[2]!.label).toMatch(/^Week of /);
    expect(groups[3]!.label).toBe("Older");
  });
  it("uses created_at when there's no purchase date", () => {
    expect(groupByWeek([item({ created_at: "2026-10-22T09:00:00" })], now)[0]!.key).toBe("w0");
  });
});

describe("findExisting", () => {
  const list = [
    item({ id: "x", name: "Oat Puffs", brand: "Happy Baby", barcode: "0 12345 67890 5" }),
  ];
  it("matches the same food by name and brand, ignoring case and punctuation", () => {
    expect(findExisting(list, { name: "oat puffs", brand: "HAPPY BABY", barcode: null })?.id).toBe(
      "x",
    );
  });
  it("matches by barcode", () => {
    expect(findExisting(list, { name: "Puffs", brand: null, barcode: "012345678905" })?.id).toBe(
      "x",
    );
  });
  it("doesn't match another brand's product", () => {
    expect(
      findExisting(list, { name: "Oat Puffs", brand: "Gerber", barcode: null }),
    ).toBeUndefined();
  });
});

describe("groceryStatus", () => {
  it("flags recalls first", () => {
    expect(groceryStatus(item({ recalled: true })).tone).toBe("alert");
  });
  it("asks for a brand when it can't be checked", () => {
    expect(groceryStatus(item({ brand: null, barcode: "123" })).tone).toBe("warn");
  });
  it("shows pending until the first scan, then the check date", () => {
    expect(groceryStatus(item({})).tone).toBe("pending");
    expect(groceryStatus(item({ recall_checked_at: "2026-10-22T09:00:00Z" })).tone).toBe("ok");
  });
});
