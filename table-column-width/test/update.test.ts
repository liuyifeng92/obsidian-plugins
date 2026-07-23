import { describe, expect, it } from "vitest";
import { compareVersions } from "../src/update";

describe("compareVersions", () => {
	it("按数字段比较远端与当前版本", () => {
		expect(compareVersions("1.0.4", "1.0.3")).toBeGreaterThan(0);
		expect(compareVersions("1.0.3", "1.0.3")).toBe(0);
		expect(compareVersions("1.0.2", "1.0.3")).toBeLessThan(0);
	});

	it("支持 v 前缀、多位数字和预发布后缀", () => {
		expect(compareVersions("v1.0.10", "1.0.9")).toBeGreaterThan(0);
		expect(compareVersions("1.1", "1.0.99")).toBeGreaterThan(0);
		expect(compareVersions("1.0.3-beta.1", "1.0.3")).toBe(0);
	});
});
