import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaging } from "@lib/staging";

describe("isStaging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when STAGING is the string 'true'", () => {
    vi.stubEnv("STAGING", "true");
    expect(isStaging()).toBe(true);
  });

  it("returns false when STAGING is 'false'", () => {
    vi.stubEnv("STAGING", "false");
    expect(isStaging()).toBe(false);
  });

  it("returns false when STAGING is unset", () => {
    vi.stubEnv("STAGING", "");
    expect(isStaging()).toBe(false);
  });

  it("treats any non-'true' value as false", () => {
    vi.stubEnv("STAGING", "1");
    expect(isStaging()).toBe(false);
    vi.stubEnv("STAGING", "yes");
    expect(isStaging()).toBe(false);
  });
});
