import { describe, expect, it } from "vitest";
import { hasHttpUrl, wrapKorean } from "../src/utils.js";

describe("utils", () => {
  it("wraps Korean copy without losing text", () => {
    const value = "말랑푸가 알려주는 오늘의 작고 유용한 생활 습관";
    expect(wrapKorean(value, 10).join("")).toBe(value);
  });

  it("accepts only http URLs", () => {
    expect(hasHttpUrl("https://example.com/x")).toBe(true);
    expect(hasHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
