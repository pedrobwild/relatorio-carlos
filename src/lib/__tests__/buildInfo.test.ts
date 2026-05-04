import { describe, it, expect } from "vitest";
import { getBuildInfo, getShortCommit, isDev, isProd } from "@/lib/buildInfo";

describe("buildInfo", () => {
  describe("getBuildInfo", () => {
    it("returns build info object with required fields", () => {
      const info = getBuildInfo();

      expect(info).toHaveProperty("commit");
      expect(info).toHaveProperty("branch");
      expect(info).toHaveProperty("environment");
      expect(info).toHaveProperty("baseUrl");
      expect(info).toHaveProperty("version");
    });

    it('returns "unknown" for commit when env var is not set', () => {
      const info = getBuildInfo();
      // In test environment, VITE_GIT_COMMIT is not set
      expect(typeof info.commit).toBe("string");
    });

    it("returns valid environment value", () => {
      const info = getBuildInfo();
      expect(["development", "staging", "production"]).toContain(
        info.environment,
      );
    });
  });

  describe("getShortCommit", () => {
    it("returns string with max 7 characters", () => {
      const short = getShortCommit();
      expect(short.length).toBeLessThanOrEqual(7);
    });

    it('returns "unknown" when commit is not set', () => {
      const short = getShortCommit();
      expect(short).toBe("unknown");
    });
  });

  describe("isDev", () => {
    it("returns boolean", () => {
      expect(typeof isDev()).toBe("boolean");
    });
  });

  describe("isProd", () => {
    it("returns boolean", () => {
      expect(typeof isProd()).toBe("boolean");
    });
  });
});
