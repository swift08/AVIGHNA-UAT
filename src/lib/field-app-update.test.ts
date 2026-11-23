import { describe, expect, it } from "vitest";
import { isNewerFieldAppVersion } from "./field-app-update";

describe("field-app-update", () => {
  it("detects a newer remote versionCode", () => {
    expect(isNewerFieldAppVersion(1, 2)).toBe(true);
    expect(isNewerFieldAppVersion(2, 2)).toBe(false);
    expect(isNewerFieldAppVersion(3, 2)).toBe(false);
    expect(isNewerFieldAppVersion(Number.NaN, 2)).toBe(false);
  });
});
