import { describe, it, expect } from "vitest";
import { classifyRecallSeverity } from "./recallSeverity";

describe("classifyRecallSeverity", () => {
  it("classifies fatal / strangulation / suffocation as life_threatening", () => {
    expect(classifyRecallSeverity({ hazard: "strangulation hazard" })).toBe("life_threatening");
    expect(classifyRecallSeverity({ hazard: "suffocation risk to infants" })).toBe("life_threatening");
    expect(classifyRecallSeverity({ title: "Fatal fall from crib" })).toBe("life_threatening");
    expect(classifyRecallSeverity({ hazard: "entrapment hazard between slats" })).toBe("life_threatening");
  });

  it("classifies cuts / burns / falls as injury", () => {
    expect(classifyRecallSeverity({ hazard: "laceration hazard" })).toBe("injury");
    expect(classifyRecallSeverity({ hazard: "burn hazard from overheating" })).toBe("injury");
    expect(classifyRecallSeverity({ hazard: "fall hazard" })).toBe("injury");
    expect(classifyRecallSeverity({ hazard: "tip-over hazard" })).toBe("injury");
  });

  it("defaults to non_injury for cosmetic / labeling recalls", () => {
    expect(classifyRecallSeverity({ hazard: "printing error on label" })).toBe("non_injury");
    expect(classifyRecallSeverity({})).toBe("non_injury");
  });

  it("prefers life_threatening over injury when both are mentioned", () => {
    expect(classifyRecallSeverity({ hazard: "choking and laceration hazard" })).toBe(
      "life_threatening",
    );
  });
});
